import Link from "next/link";
import { ClipboardCheck, BarChart3, Wallet, type LucideIcon } from "lucide-react";

export type PanelTab = "tareas" | "metricas" | "ventas";

const TABS: Array<{ key: PanelTab; label: string; icon: LucideIcon }> = [
  { key: "tareas", label: "Tareas", icon: ClipboardCheck },
  { key: "metricas", label: "Métricas equipo y programa", icon: BarChart3 },
  { key: "ventas", label: "Ventas", icon: Wallet },
];

export function PanelTabs({ active }: { active: PanelTab }) {
  return (
    <nav className="mb-5 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        const href = t.key === "tareas" ? "/" : `/?tab=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            <Icon size={14} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
