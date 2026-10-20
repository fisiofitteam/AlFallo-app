"use client";

import Link from "next/link";

type Tab = { key: string; label: string; href: string; ceoOnly?: boolean; external?: boolean };

const TABS: Tab[] = [
  { key: "calendar", label: "📅 Calendario", href: "/contenido/calendario" },
  { key: "dossier", label: "📄 Dossier", href: "/contenido/dossier" },
  { key: "historias", label: "📱 Historias", href: "/contenido/historias" },
  { key: "marketer", label: "🧠 Marketer IA", href: "/contenido/marketer", ceoOnly: true },
  { key: "template", label: "🧩 Plantillas", href: "/contenido/plantilla" },
  // El editor Story Maker vive en /contenido/story-maker (page Next
  // con iframe embebido a /storymaker). Así se queda dentro de la app.
  { key: "story-maker", label: "🎨 Story Maker", href: "/contenido/story-maker" },
  { key: "carousel-maker", label: "🎞 Carrusel Maker", href: "/contenido/carrusel-maker" },
  { key: "metrics", label: "📈 Métricas", href: "/contenido/metricas" },
  { key: "bank", label: "🗂 Banco recursos", href: "/contenido/banco" },
  { key: "lead-magnets", label: "🧲 Lead magnets", href: "/contenido/lead-magnets", ceoOnly: true },
  { key: "brief-ia", label: "✨ Brief IA", href: "/contenido/brief-ia", ceoOnly: true },
];

export function ContentNav({ active, role, showMarketer = false }: { active: string; role?: string; showMarketer?: boolean }) {
  const visibleTabs = TABS.filter((t) => t.key === "marketer" ? showMarketer : !t.ceoOnly || role === "ceo");
  return (
    <div className="mb-3 flex min-w-0 max-w-full gap-1 border-b border-neutral-200 overflow-x-auto">
      {visibleTabs.map((tab) => {
        const isActive = active === tab.key;
        const className = `px-3 py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
          isActive ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900"
        }`;
        // external=true → <a> normal (fuerza full-page navigation al HTML
        // servido por route handler, sin router SPA de Next intentando
        // hidratarlo como page.tsx).
        if (tab.external) {
          return (
            <a key={tab.key} href={tab.href} className={className}>
              {tab.label}
            </a>
          );
        }
        return (
          <Link key={tab.key} href={tab.href} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
