import { requireTeacher } from "@/server/authz";
import { json, route } from "@/server/http";
import { listMembers } from "@/server/services/members";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const p = await requireTeacher(request);
  return json({ group: p.groupName, selfId: p.userId, members: await listMembers(p.groupId) });
});
