import { requireStudent } from "@/server/authz";
import { json, route } from "@/server/http";
import { getOwnProgress } from "@/server/services/progress";

export const dynamic = "force-dynamic";

/** Elevens egna framsteg. Användar-ID kommer från sessionen, aldrig från begäran. */
export const GET = route(async (request) => {
  const p = await requireStudent(request);
  return json(await getOwnProgress(p.userId));
});
