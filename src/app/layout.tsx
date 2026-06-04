import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter como tipografía base — clean sans-serif moderna, similar al look de
// referencia (FisioFit) que el usuario tomó como guía visual.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html lang="es" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
