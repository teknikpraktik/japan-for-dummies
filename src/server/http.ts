import { z } from "zod";
import { AdminError } from "./services/accounts";
import { assertSameOrigin, HttpError } from "./authz";
import { ACCOUNTS_ENABLED } from "@/lib/features";

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie, Origin",
  "X-Content-Type-Options": "nosniff",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE } });
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const text = await request.text();
  if (text.length > 100_000) throw new HttpError(400, "too-large", "För stor begäran.");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "bad-json", "Ogiltig JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "invalid-input", "Ogiltiga uppgifter.");
  return parsed.data;
}

/** Gemensam felhantering. Detaljer och interna fel exponeras aldrig. */
export function route(handler: (request: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (request: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    // Kontofunktionerna avstängda: 404 utan att autentisering eller databas initieras.
    if (!ACCOUNTS_ENABLED) return json({ error: "not-found" }, 404);
    try {
      assertSameOrigin(request);
      return await handler(request, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      if (e instanceof AdminError) {
        const status = e.code === "not-found" ? 404 : e.code === "conflict" || e.code === "last-teacher" ? 409 : e.code === "forbidden" ? 403 : 400;
        return json({ error: e.code, message: e.message }, status);
      }
      console.error("Internt fel i API-rutt"); // inga uppgifter om användare eller indata
      return json({ error: "internal", message: "Något gick fel." }, 500);
    }
  };
}
