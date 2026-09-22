import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { LineChart, type ChartPoint } from "@/components/line-chart";
import {
  addCustomMetric,
  updateCustomMetric,
  toggleCustomMetric,
  deleteCustomMetric,
} from "../actions";

function ChartCard({
  title,
  points,
  color,
  unit,
}: {
  title: string;
  points: ChartPoint[];
  color: string;
  unit: string;
}) {
  if (points.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <LineChart points={points} color={color} unit={unit} />
    </section>
  );
}

export type CustomMetricSeries = {
  id: string;
  name: string;
  unit: string | null;
  type: string;
  active: boolean;
  points: ChartPoint[];
};

// Colores para las gráficas custom — los rotamos cíclicamente.
const CUSTOM_COLORS = ["#7c3aed", "#0ea5e9", "#16a34a", "#f59e0b", "#dc2626", "#0891b2"];

export function EvolucionTab({
  clientId,
  weight,
  waist,
  bodyFat,
  customMetrics,
}: {
  clientId: string;
  weight: ChartPoint[];
  waist: ChartPoint[];
  bodyFat: ChartPoint[];
  customMetrics: CustomMetricSeries[];
}) {
  const hasStandard = weight.length + waist.length + bodyFat.length > 0;
  const activeCustom = customMetrics.filter((m) => m.active);

  return (
    <div className="space-y-6">
      {hasStandard ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ChartCard title="Peso" points={weight} color="#e6197e" unit=" kg" />
          <ChartCard title="Cintura" points={waist} color="#e07b1a" unit=" cm" />
          <ChartCard title="% Grasa" points={bodyFat} color="#1fa971" unit="%" />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">Sin datos de evolución todavía</p>
          <p className="mt-1 text-sm text-muted">
            Se llenan con los check-ins semanales (peso, perímetros, % grasa).
          </p>
        </div>
      )}

      {/* Gráficas de métricas personalizadas activas con datos. */}
      {activeCustom.map((m, i) => (
        <ChartCard
          key={m.id}
          title={m.name}
          points={m.points}
          color={CUSTOM_COLORS[i % CUSTOM_COLORS.length]}
          unit={m.unit ? ` ${m.unit}` : ""}
        />
      ))}

      {/* Gestión de métricas personalizadas */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <header className="mb-3">
          <h3 className="font-semibold">Métricas personalizadas</h3>
          <p className="text-xs text-muted">
            Lo que añadas aquí aparece como pregunta extra en el check-in semanal del cliente
            y como gráfica en esta pestaña y en su app.
          </p>
        </header>

        {customMetrics.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {customMetrics.map((m) => (
              <li
                key={m.id}
                className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${
                  m.active
                    ? "border-border bg-bg/40"
                    : "border-dashed border-border bg-bg/20 opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {m.name}
                    {m.unit ? <span className="text-muted"> ({m.unit})</span> : null}
                  </p>
                  <p className="text-[11px] text-muted">
                    {m.type === "scale" ? "Escala" : "Numérico"} ·{" "}
                    {m.points.length} {m.points.length === 1 ? "registro" : "registros"}
                  </p>
                </div>
                <form action={toggleCustomMetric}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    title={
                      m.active
                        ? "Desactivar (deja de aparecer en el check-in; el histórico se mantiene)"
                        : "Reactivar"
                    }
                    className="rounded-md border border-border p-1.5 text-muted hover:border-primary hover:text-text"
                  >
                    {m.active ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </form>
                <details className="relative">
                  <summary className="cursor-pointer rounded-md border border-border p-1.5 text-muted hover:border-primary hover:text-text">
                    <Pencil size={13} />
                  </summary>
                  <form
                    action={updateCustomMetric}
                    className="absolute right-0 z-10 mt-2 w-72 space-y-2 rounded-xl border border-border bg-surface p-3 shadow-lg"
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <label className="block text-xs">
                      <span className="font-semibold text-muted">Nombre</span>
                      <input
                        name="name"
                        defaultValue={m.name}
                        required
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs">
                        <span className="font-semibold text-muted">Unidad</span>
                        <input
                          name="unit"
                          defaultValue={m.unit ?? ""}
                          placeholder="cm / h / %"
                          className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="font-semibold text-muted">Tipo</span>
                        <select
                          name="type"
                          defaultValue={m.type}
                          className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
                        >
                          <option value="number">Numérico</option>
                          <option value="scale">Escala</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg"
                    >
                      Guardar cambios
                    </button>
                  </form>
                </details>
                <form action={deleteCustomMetric}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    title="Borrar definitivamente (incluye histórico)"
                    className="rounded-md border border-border p-1.5 text-muted hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}

        <form
          action={addCustomMetric}
          className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-border bg-bg/40 p-3 sm:grid-cols-[1fr,120px,140px,auto]"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <input
            name="name"
            required
            placeholder="Nombre (ej. Cuello, Sueño)"
            className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
          <input
            name="unit"
            placeholder="Unidad (cm / h)"
            className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
          <select
            name="type"
            defaultValue="number"
            className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="number">Numérico</option>
            <option value="scale">Escala</option>
          </select>
          <button
            type="submit"
            className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
          >
            <Plus size={12} /> Añadir
          </button>
        </form>
      </section>
    </div>
  );
}
