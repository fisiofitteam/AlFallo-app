import { getTeamSatisfaction, resolvePeriod, type PeriodPreset } from "@/lib/teamMetrics";
import { PeriodSwitcher } from "./PeriodSwitcher";

function fmtScore(v: number | null, digits = 1): string {
  if (v === null) return "—";
  return v.toFixed(digits).replace(".", ",");
}

export async function TabMetricasEquipo({ period }: { period: PeriodPreset }) {
  const resolved = resolvePeriod(period);
  const satisfaction = await getTeamSatisfaction(resolved);
  const activeRows = satisfaction.byProfessional.filter(
    (r) => r.metrics.count > 0 || r.professionalId !== null,
  );

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Métricas del equipo y programa</h2>
          <p className="text-xs capitalize text-muted">{resolved.label}</p>
        </div>
        <PeriodSwitcher tab="metricas" active={resolved.preset} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Satisfacción media</p>
          <p className="mt-2 text-4xl font-bold text-primary">
            {fmtScore(satisfaction.global.average)}
            <span className="ml-1 text-base font-medium text-muted">/ 10</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {satisfaction.global.count === 0
              ? "Sin respuestas puntuadas en este periodo."
              : `sobre ${satisfaction.global.count} ${
                  satisfaction.global.count === 1 ? "respuesta" : "respuestas"
                }`}
          </p>
        </article>

        <article className="rounded-2xl border border-dashed border-border bg-surface/60 p-5">
          <p className="text-xs uppercase tracking-wide text-muted">% Renovación medio</p>
          <p className="mt-2 text-4xl font-bold text-muted">—</p>
          <p className="mt-1 text-xs text-muted">
            Pendiente: sistema para marcar renovaciones desde la app.
          </p>
        </article>
      </div>

      <article className="rounded-2xl border border-border bg-surface">
        <header className="border-b border-border p-4">
          <h3 className="text-sm font-semibold">Métricas por profesional</h3>
          <p className="text-xs text-muted">Nutricionista asignado al cliente.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 text-left font-medium">Nutri</th>
                <th className="px-4 py-2 text-right font-medium">Respuestas</th>
                <th className="px-4 py-2 text-right font-medium">Satisfacción</th>
                <th className="px-4 py-2 text-right font-medium">Renovación</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                    Todavía no hay respuestas puntuadas.
                  </td>
                </tr>
              ) : (
                activeRows.map((r) => (
                  <tr
                    key={r.professionalId ?? "orphan"}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td className="px-4 py-2 font-medium">{r.professionalName}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">
                      {r.metrics.count}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-primary">
                      {r.metrics.count === 0 ? "—" : fmtScore(r.metrics.average)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
