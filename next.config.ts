import type { NextConfig } from "next";

// Statisk export: hela utbildningen är förberäknad, saknar server och databas,
// och kan därför cachas fullständigt för offlineläge.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
