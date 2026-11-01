import { requireTeacher } from "@/server/authz";
import { json, route } from "@/server/http";
import { groupOverview } from "@/server/services/progress";

export const dynamic = "force-dynamic";

/** Gruppens framstegsmatris. Gruppen kommer från lärarens medlemskap, inte från begäran. */
export const GET = route(async (request) => {
  const p = await requireTeacher(request);
  return json({ group: p.groupName, ...(await groupOverview(p.groupId)) });
});
