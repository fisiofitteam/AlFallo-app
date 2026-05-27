import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Al Fallo Nutrition",
  description: "Plataforma de gestión de nutrición deportiva para atletas de CrossFit/Hyrox.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Al Fallo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#e6197e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
