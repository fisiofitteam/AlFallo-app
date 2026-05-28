import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { CuadroTab } from "./cuadro-tab";
import { FinanzasTab } from "./finanzas-tab";

export const metadata = { title: "Cuadro de mandos · Al Fallo Nutrition" };

const TABS = [
  { key: "panel", label: "Cuadro de mandos" },
  { key: "finanzas", label: "Finanzas" },
] as const;

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const prof = await requireProfessional();
  if (prof.role !== "ceo") redirect("/");

  const active = TABS.find((t) => t.key === searchParams.tab) ?? TABS[0];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold md:text-3xl">Cuadro de mandos</h1>
        <p className="mt-1 text-muted">Métricas del negocio y finanzas del equipo.</p>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/finanzas${t.key === "panel" ? "" : `?tab=${t.key}`}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
              t.key === active.key
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {active.key === "panel" ? <CuadroTab /> : <FinanzasTab />}
    </div>
  );
}
