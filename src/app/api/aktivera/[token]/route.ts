import { z } from "zod";
import { json, readJson, route } from "@/server/http";
import { activateTeacher, checkActivationToken } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{30,64}$/);

export const GET = route(async (_request, { params }) => {
  const t = tokenSchema.safeParse((await params).token);
  if (!t.success) return json({ valid: false });
  const r = await checkActivationToken(t.data);
  return json(r.valid ? { valid: true, displayName: r.displayName, loginName: r.loginName } : { valid: false });
});

const body = z.object({ password: z.string().min(12).max(128) }).strict();

/** Engångsflöde: läraren sätter eget lösenord. Ger ingen administratörsåtkomst innan tvåfaktor är registrerad. */
export const POST = route(async (request, { params }) => {
  const t = tokenSchema.safeParse((await params).token);
  if (!t.success) return json({ error: "invalid", message: "Länken är ogiltig eller har gått ut." }, 400);
  const { password } = await readJson(request, body);
  const r = await activateTeacher(t.data, password);
  return json({ ok: true, loginName: r.loginName });
});
