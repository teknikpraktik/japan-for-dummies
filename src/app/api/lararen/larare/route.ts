import { z } from "zod";
import { requirePasswordConfirmation, requireTeacher } from "@/server/authz";
import { json, readJson, route } from "@/server/http";
import { inviteTeacher } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

const body = z.object({ displayName: z.string().min(1).max(60), loginEmail: z.string().min(3).max(120), password: z.string().max(256) }).strict();

/** Skapar en lärare via engångslänk. Känslig åtgärd: kräver att läraren bekräftar sitt lösenord. */
export const POST = route(async (request) => {
  const p = await requireTeacher(request);
  const b = await readJson(request, body);
  await requirePasswordConfirmation(p, b.password);
  const inv = await inviteTeacher({ userId: p.userId, groupId: p.groupId }, b.displayName, b.loginEmail);
  return json({ userId: inv.userId, activationPath: `/aktivera/${inv.token}/`, expiresAt: inv.expiresAt.toISOString() }, 201);
});
