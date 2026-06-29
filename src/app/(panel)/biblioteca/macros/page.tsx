import { redirect } from "next/navigation";
import { Calculator, RotateCcw, Activity, Target, PieChart } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { getMacroConfig } from "@/lib/macroConfig";
import { saveMacroConfigAction, resetMacroConfigAction } from "./actions";

export const metadata = { title: "Cálculo macros · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function MacrosTab() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
        Solo el equipo de nutrición puede configurar el cálculo de macros.
      </p>
    );
  }

  const config = await getMacroConfig();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-5 text-sm text-muted">
        Parámetros que usa Harris-Benedict para sugerir los macros objetivo de cada cliente.
        Cambios aquí afectan a futuras generaciones de plan (no recalcula planes ya creados).
        Fórmula base: <strong>Roza-Shizgal (1984)</strong>, la versión revisada de la clásica HB.
      </p>

      <form action={saveMacroConfigAction} className="space-y-6">
        {/* ── Factores de actividad ── */}
        <section className="rounded-2xl border border-border bg-surface">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Activity size={16} className="text-primary" />
              Factores de actividad
            </h2>
            <p className="text-xs text-muted">Por sesiones de entreno a la semana</p>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-bg/40 text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Bracket</th>
                <th className="px-4 py-2 text-right font-medium">Mín d/sem</th>
                <th className="px-4 py-2 text-right font-medium">Máx d/sem</th>
                <th className="px-4 py-2 text-right font-medium">Multiplicador</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config.activityMultipliers).map(([key, b]) => (
                <tr key={key} className="border-t border-border">
                  <td className="px-4 py-2">
                    <span className="font-medium">{b.label}</span>
                    <span className="ml-2 text-xs text-muted">{key}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      name={`act_${key}_min`}
                      type="number"
                      defaultValue={b.minFreq}
                      step="1"
                      min="0"
                      max="14"
                      className="w-16 rounded border border-border bg-bg px-2 py-1 text-right outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      name={`act_${key}_max`}
                      type="number"
                      defaultValue={b.maxFreq}
                      step="1"
                      min="0"
                      max="99"
                      className="w-16 rounded border border-border bg-bg px-2 py-1 text-right outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      name={`act_${key}_factor`}
                      type="number"
                      defaultValue={b.factor}
                      step="0.025"
                      min="1"
                      max="2.5"
                      className="w-20 rounded border border-border bg-bg px-2 py-1 text-right outline-none focus:border-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── Ajuste por objetivo ── */}
        <section className="rounded-2xl border border-border bg-surface">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Target size={16} className="text-primary" />
              Ajuste por objetivo
            </h2>
            <p className="text-xs text-muted">Variación sobre TDEE (%)</p>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-bg/40 text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Objetivo</th>
                <th className="px-4 py-2 text-right font-medium">Δ kcal (%)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config.goalAdjustments).map(([key, g]) => (
                <tr key={key} className="border-t border-border">
                  <td className="px-4 py-2">
                    <span className="font-medium">{g.label}</span>
                    <span className="ml-2 text-xs text-muted">{key}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      name={`goal_${key}_delta`}
                      type="number"
                      defaultValue={g.kcalDeltaPct}
                      step="1"
                      min="-50"
                      max="50"
                      className="w-20 rounded border border-border bg-bg px-2 py-1 text-right outline-none focus:border-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── Distribución de macros ── */}
        <section className="rounded-2xl border border-border bg-surface">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <PieChart size={16} className="text-primary" />
              Distribución de macros
            </h2>
            <p className="text-xs text-muted">% de kcal · debería sumar 100</p>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-bg/40 text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Objetivo</th>
                <th className="px-4 py-2 text-right font-medium">Proteína %</th>
                <th className="px-4 py-2 text-right font-medium">Carbos %</th>
                <th className="px-4 py-2 text-right font-medium">Grasa %</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config.macroDistribution).map(([key, s]) => {
                const sum = s.protein + s.carbs + s.fat;
                return (
                  <tr key={key} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{config.goalAdjustments[key]?.label ?? key}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        name={`split_${key}_protein`}
                        type="number"
                        defaultValue={s.protein}
                        step="1"
                        min="0"
                        max="100"
                        className="w-16 rounded border border-border bg-bg px-2 py-1 text-right outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        name={`split_${key}_carbs`}
                        type="number"
                        defaultValue={s.carbs}
                        step="1"
                        min="0"
                        max="100"
                        className="w-16 rounded border border-border bg-bg px-2 py-1 text-right outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        name={`split_${key}_fat`}
                        type="number"
                        defaultValue={s.fat}
                        step="1"
                        min="0"
                        max="100"
                        className="w-16 rounded border border-border bg-bg px-2 py-1 text-right outline-none focus:border-primary"
                      />
                    </td>
                    <td className={`px-4 py-2 text-right ${sum === 100 ? "text-muted" : "font-semibold text-red-600"}`}>
                      {sum}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            formAction={resetMacroConfigAction}
            className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-primary hover:text-text"
          >
            <RotateCcw size={13} /> Restaurar recomendado
          </button>
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Calculator size={13} /> Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
