import Link from "next/link";
import { CalendarRange } from "lucide-react";
import type { PeriodPreset } from "@/lib/teamMetrics";

const OPTIONS: Array<{ key: PeriodPreset; label: string }> = [
  { key: "mensual", label: "Mensual" },
  { key: "trimestral", label: "Trimestral" },
  { key: "anual", label: "Anual" },
];

export function PeriodSwitcher({
  tab,
  active,
}: {
  tab: string;
  active: PeriodPreset;
}) {
  return (
    <div className="inline-flex items-center gap-0 overflow-hidden rounded-lg border border-border bg-surface text-xs">
      {OPTIONS.map((o) => {
        const href = `/?tab=${encodeURIComponent(tab)}&period=${o.key}`;
        const isActive = active === o.key;
        return (
          <Link
            key={o.key}
            href={href}
            className={`px-3 py-1.5 font-medium transition ${
              isActive ? "bg-primary text-primary-fg" : "text-muted hover:bg-bg"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
      <span
        className="inline-flex items-center gap-1 border-l border-border px-2 py-1.5 text-[10px] text-muted"
        title="Personalizado — próximamente"
      >
        <CalendarRange size={11} /> Personalizado
      </span>
    </div>
  );
}
