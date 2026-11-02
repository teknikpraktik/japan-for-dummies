import { z } from "zod";
import { HttpError, requirePasswordConfirmation, requireTeacher } from "@/server/authz";
import { json, readJson, route } from "@/server/http";
import {
  changeRole,
  deactivateUser,
  deleteMember,
  exportStudentData,
  reactivateStudent,
  reissueTeacherActivation,
  resetStudentCode,
} from "@/server/services/accounts";
import { isMemberOfGroup, listMembers } from "@/server/services/members";

export const dynamic = "force-dynamic";

const idSchema = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const confirmBody = z.object({ password: z.string().max(256) }).strict();
const emptyBody = z.object({}).strict();
const roleBody = z.object({ role: z.enum(["student", "teacher"]), loginEmail: z.string().max(120).optional(), password: z.string().max(256) }).strict();

/**
 * Åtgärder på en medlem i lärarens egen grupp. Mål-ID kommer från URL men kontrolleras alltid mot
 * lärarens gruppmedlemskap på servern; konton i andra grupper ger 404.
 */
async function target(request: Request, params: Promise<Record<string, string>>) {
  const p = await requireTeacher(request);
  const { id, action } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success || !(await isMemberOfGroup(p.groupId, parsed.data))) throw new HttpError(404, "not-found", "Kontot finns inte.");
  return { p, id: parsed.data, action: action as string };
}

export const GET = route(async (request, { params }) => {
  const { p, id, action } = await target(request, params);
  if (action !== "export") throw new HttpError(404, "not-found", "Okänd åtgärd.");
  return json(await exportStudentData({ userId: p.userId, groupId: p.groupId }, id));
});

export const POST = route(async (request, { params }) => {
  const { p, id, action } = await target(request, params);
  const actor = { userId: p.userId, groupId: p.groupId };
  switch (action) {
    case "ny-kod": {
      const b = await readJson(request, confirmBody);
      await requirePasswordConfirmation(p, b.password);
      const r = await resetStudentCode(actor, id);
      return json({ username: r.username, displayName: r.displayName, loginCode: r.loginCodeFormatted, group: p.groupName });
    }
    case "aktivera-igen": {
      const b = await readJson(request, confirmBody);
      await requirePasswordConfirmation(p, b.password);
      const members = await listMembers(p.groupId);
      const m = members.find((x) => x.userId === id);
      if (m?.role === "teacher") {
        const inv = await reissueTeacherActivation(actor, id);
        return json({ activationPath: `/aktivera/${inv.token}/`, expiresAt: inv.expiresAt.toISOString() });
      }
      const r = await reactivateStudent(actor, id);
      return json({ username: r.username, displayName: r.displayName, loginCode: r.loginCodeFormatted, group: p.groupName });
    }
    case "aktiveringslank": {
      const b = await readJson(request, confirmBody);
      await requirePasswordConfirmation(p, b.password);
      const inv = await reissueTeacherActivation(actor, id);
      return json({ activationPath: `/aktivera/${inv.token}/`, expiresAt: inv.expiresAt.toISOString() });
    }
    case "avaktivera": {
      const members = await listMembers(p.groupId);
      const m = members.find((x) => x.userId === id);
      // Lärarbehörighet berörs: kräver lösenordsbekräftelse. Elever kräver bara uttrycklig knapptryckning.
      if (m?.role === "teacher") {
        const b = await readJson(request, confirmBody);
        await requirePasswordConfirmation(p, b.password);
      } else {
        await readJson(request, z.object({ password: z.string().max(256).optional() }).strict());
      }
      await deactivateUser(actor, id);
      return json({ ok: true });
    }
    case "roll": {
      const b = await readJson(request, roleBody);
      await requirePasswordConfirmation(p, b.password);
      const r = await changeRole(actor, id, b.role, { loginEmail: b.loginEmail });
      return json({
        ok: true,
        ...(r.loginCodeFormatted ? { username: r.username, loginCode: r.loginCodeFormatted, group: p.groupName } : {}),
        ...(r.invitation ? { activationPath: `/aktivera/${r.invitation.token}/`, expiresAt: r.invitation.expiresAt.toISOString() } : {}),
      });
    }
    case "radera": {
      const b = await readJson(request, confirmBody);
      await requirePasswordConfirmation(p, b.password);
      await deleteMember(actor, id);
      return json({ ok: true });
    }
    default:
      await readJson(request, emptyBody).catch(() => undefined);
      throw new HttpError(404, "not-found", "Okänd åtgärd.");
  }
});
