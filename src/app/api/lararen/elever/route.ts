import { z } from "zod";
import { requireTeacher } from "@/server/authz";
import { json, readJson, route } from "@/server/http";
import { createStudent } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

const body = z.object({ displayName: z.string().min(1).max(60) }).strict();

/** Skapar en elev. Inloggningskoden returneras en enda gång och lagras aldrig i klartext. */
export const POST = route(async (request) => {
  const p = await requireTeacher(request);
  const { displayName } = await readJson(request, body);
  const s = await createStudent({ userId: p.userId, groupId: p.groupId }, displayName);
  return json({ userId: s.userId, displayName: s.displayName, username: s.username, loginCode: s.loginCodeFormatted, group: p.groupName }, 201);
});
