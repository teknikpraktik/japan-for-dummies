import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader, BottomNav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import { StorageBanner } from "@/components/StorageBanner";
import { AccountProvider } from "@/components/AccountProvider";
import { AccountBanner } from "@/components/AccountBanner";

export const metadata: Metadata = {
  title: { default: "Japan for Dummies", template: "%s – Japan for Dummies" },
  description: "Interaktiv förberedelse inför skolresan till Japan i oktober 2027: korta kapitel, övningar och test.",
  applicationName: "Japan for Dummies",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Japan for Dummies", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#28356b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-dvh flex flex-col">
        <AccountProvider>
        <a href="#innehall" className="sr-only-focusable btn btn-primary" style={{ position: "absolute", left: "1rem", top: "0.5rem", zIndex: 50 }}>
          Hoppa till innehållet
        </a>
        <SiteHeader />
        <StorageBanner />
        <AccountBanner />
        <main id="innehall" tabIndex={-1} className="flex-1 pb-28 md:pb-12 outline-none">
          {children}
        </main>
        <SiteFooter />
        <BottomNav />
        <ServiceWorker />
        </AccountProvider>
      </body>
    </html>
  );
}
