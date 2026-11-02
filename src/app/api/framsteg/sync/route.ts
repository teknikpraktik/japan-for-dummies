import { requireStudent } from "@/server/authz";
import { json, readJson, route } from "@/server/http";
import { applyOps, getOwnProgress, syncBodySchema } from "@/server/services/progress";

export const dynamic = "force-dynamic";

/** Idempotent synkning av elevens egna framsteg. Skriver bara för den inloggade eleven. */
export const POST = route(async (request) => {
  const p = await requireStudent(request);
  const body = await readJson(request, syncBodySchema);
  const results = await applyOps(p.userId, body.ops);
  return json({ results, ...(await getOwnProgress(p.userId)) });
});
