import { NextResponse, type NextRequest } from "next/server";

/**
 * Stänger kontofunktionerna på servern när de är avstängda (standard). Körs före sidor och API-rutter, så inga
 * autentiserings- eller databasmoduler körs och inga kakor sätts. Läser samma inställning som klienten
 * (src/lib/features.ts); den dupliceras här för att proxyn ska vara fristående och snabb.
 */
const ACCOUNTS_ENABLED = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === "true";

export function proxy(request: NextRequest) {
  if (ACCOUNTS_ENABLED) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "not-found" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store, max-age=0" },
    });
  }
  // Kontosidor: samma 404-sida som för alla okända adresser.
  return NextResponse.rewrite(new URL("/finns-inte-konton-avstangda", request.url), { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export const config = {
  matcher: ["/api/:path*", "/logga-in/:path*", "/min-utbildning/:path*", "/lararen/:path*", "/konto/:path*", "/aktivera/:path*"],
};
