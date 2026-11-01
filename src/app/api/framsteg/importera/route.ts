import { requireStudent } from "@/server/authz";
import { json, readJson, route } from "@/server/http";
import { getOwnProgress, importLegacy, importSchema } from "@/server/services/progress";

export const dynamic = "force-dynamic";

/** Uttrycklig import av äldre lokala framsteg (självrapporterade). Kräver confirm: true. */
export const POST = route(async (request) => {
  const p = await requireStudent(request);
  const body = await readJson(request, importSchema);
  const res = await importLegacy(p.userId, body);
  return json({ ...res, ...(await getOwnProgress(p.userId)) });
});
