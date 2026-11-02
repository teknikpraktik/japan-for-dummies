import type { NextConfig } from "next";

const PRIVATE_PAGES = ["/logga-in", "/min-utbildning", "/lararen", "/konto", "/aktivera"];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Delvis CSP: skript tillåts som tidigare (Next.js inline-skript), men inbäddning, formulärmål och objekt begränsas.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const noStore = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Vary", value: "Cookie" },
];

const nextConfig: NextConfig = {
  // Serverdrift (Vercel) för inloggning och skyddade funktioner. Offentligt utbildningsinnehåll genereras statiskt.
  trailingSlash: true,
  // Tillåt API-anrop med och utan avslutande snedstreck utan omdirigering (POST-anrop får inte omdirigeras).
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Innehållet (JSON) läses från disk av API-rutterna (validering av prov); se till att det följer med i funktionspaketet.
  outputFileTracingIncludes: { "/api/**": ["./src/content/**/*"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: noStore },
      ...PRIVATE_PAGES.flatMap((p) => [
        { source: p, headers: noStore },
        { source: `${p}/:path*`, headers: noStore },
      ]),
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/offline-manifest.json", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
