import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Al Fallo Nutrition",
  description: "Plataforma de gestión de nutrición deportiva para atletas de CrossFit/Hyrox.",
};

export const viewport: Viewport = {
  themeColor: "#0f0f12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
