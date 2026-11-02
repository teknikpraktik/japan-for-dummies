import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Japan for Dummies",
    short_name: "Japan for Dummies",
    description: "Interaktiv förberedelse inför skolresan till Japan i oktober 2027.",
    lang: "sv",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#fbf6ec",
    theme_color: "#28356b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
