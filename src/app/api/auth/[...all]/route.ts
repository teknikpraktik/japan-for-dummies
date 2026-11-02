import { ACCOUNTS_ENABLED } from "@/lib/features";
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";
import { assertAllowedOrigin, HttpError } from "@/server/authz";

export const dynamic = "force-dynamic";

/**
 * Better Auths egna endpoints (inloggning, utloggning, tvåfaktor, lösenordsbyte). Registrering och övrigt
 * är avstängt via disabledPaths (src/server/auth.ts). Parametriserade vägar som biblioteket inte kan stänga
 * via disabledPaths stängs här (återställning via e-post och OAuth-återanrop används aldrig).
 */
const BLOCKED_PREFIXES = ["/api/auth/reset-password", "/api/auth/callback", "/api/auth/delete-user"];

function guard(request: Request): Response | null {
  if (!ACCOUNTS_ENABLED) return deny(404, "not-found");
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return deny(404, "not-found");
  if (request.method === "POST") {
    try {
      assertAllowedOrigin(request);
    } catch (e) {
      if (e instanceof HttpError) return deny(e.status, e.code);
      throw e;
    }
  }
  return null;
}

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  return guard(request) ?? withNoStore(await toNextJsHandler(getAuth()).GET(request));
}
export async function POST(request: Request) {
  return guard(request) ?? withNoStore(await toNextJsHandler(getAuth()).POST(request));
}

function withNoStore(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Vary", "Cookie, Origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
