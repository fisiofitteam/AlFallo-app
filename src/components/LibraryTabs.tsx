"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LIBRARY_TABS } from "@/app/(panel)/biblioteca/tabs";

/**
 * Barra de tabs horizontal del módulo Biblioteca. Resalta la activa según
 * la ruta. Los tabs se definen en tabs.ts para mantener una sola fuente.
 */
export function LibraryTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Secciones de la biblioteca"
      className="mb-6 -mx-2 flex gap-1 overflow-x-auto px-2 pb-1"
    >
      {LIBRARY_TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition ${
              active
                ? "border-text text-text"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            <span aria-hidden>{t.emoji}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
