import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Kpi } from "@/lib/panelKpis";

export function PanelKpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {kpis.map((k) => {
        const body = (
          <>
            <ChevronRight
              size={16}
              className={`absolute right-3 top-3 text-muted transition ${
                k.href ? "opacity-0 group-hover:opacity-100" : "opacity-0"
              }`}
            />
            <p className="text-xs font-medium text-muted">{k.label}</p>
            <p
              className={`mt-2 text-3xl font-bold ${
                k.tone === "accent"
                  ? "text-[#e07b1a]"
                  : k.tone === "muted"
                  ? "text-muted"
                  : "text-text"
              }`}
            >
              {k.value}
            </p>
            {k.hint ? <p className="mt-1 text-[10px] text-muted">{k.hint}</p> : null}
          </>
        );
        const wrapperClass =
          "group relative rounded-2xl border border-border bg-surface p-4 transition hover:border-primary";
        return k.href ? (
          <Link key={k.key} href={k.href} className={wrapperClass}>
            {body}
          </Link>
        ) : (
          <div key={k.key} className={wrapperClass}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
