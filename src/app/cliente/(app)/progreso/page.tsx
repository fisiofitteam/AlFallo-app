import { Dumbbell, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { listMarks } from "@/lib/strengthMarks";
import { OwnStrengthMarks } from "@/components/cliente/OwnStrengthMarks";

export const metadata = { title: "Mi progreso · Al Fallo" };
export const dynamic = "force-dynamic";

const CUSTOM_COLORS = ["#7c3aed", "#0ea5e9", "#16a34a", "#f59e0b", "#dc2626", "#0891b2"];

type SeriesPoint = { date: Date; value: number };

function MiniLineChart({ points, color }: { points: SeriesPoint[]; color: string }) {
  const W = 320;
  const H = 140;
  const pad = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (p.value - min) / range) * (H - pad * 2);
    return { x, y };
  });
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill={color} />
      ))}
    </svg>
  );
}

export default async function ProgressPage() {
  const me = await requireOnboardedClient();

  // El peso del cliente sale ahora del check-in semanal — ya no hay registro
  // diario. Si el cliente tiene check-ins históricos con peso, todos cuentan.
  // Mantenemos también los DailyLog antiguos por si quedan logs previos a la
  // retirada de /registro (no se generan nuevos, pero los viejos se ven).
  const [checkIns, legacyLogs] = await Promise.all([
    prisma.checkIn.findMany({
      where: { clientId: me.id, weightKg: { not: null } },
      orderBy: { date: "asc" },
      select: { date: true, weightKg: true },
    }),
    prisma.dailyLog.findMany({
      where: { clientId: me.id, weightKg: { not: null } },
      orderBy: { date: "asc" },
      select: { date: true, weightKg: true },
    }),
  ]);

  const points: SeriesPoint[] = [
    ...checkIns.map((c) => ({ date: c.date, value: c.weightKg as number })),
    ...legacyLogs.map((l) => ({ date: l.date, value: l.weightKg as number })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const last = points.at(-1);
  const first = points.at(0);
  const diff = last && first ? last.value - first.value : 0;

  // Marcas de fuerza / benchmarks (catálogo global) + registros del atleta.
  const [strengthMarks, strengthRecords] = await Promise.all([
    listMarks(),
    prisma.strengthRecord.findMany({
      where: { clientId: me.id },
      orderBy: { date: "desc" },
      select: { id: true, markId: true, value: true, date: true, notes: true },
    }),
  ]);

  // Métricas personalizadas activas + sus valores.
  const customMetrics = await prisma.customMetric.findMany({
    where: { clientId: me.id, active: true },
    orderBy: { order: "asc" },
  });
  const customValues =
    customMetrics.length > 0
      ? await prisma.customMetricValue.findMany({
          where: { metricId: { in: customMetrics.map((m) => m.id) } },
          include: { checkIn: { select: { date: true } } },
        })
      : [];
  const customSeries = customMetrics
    .map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      points: customValues
        .filter((v) => v.metricId === m.id)
        .sort((a, b) => a.checkIn.date.getTime() - b.checkIn.date.getTime())
        .map((v) => ({ date: v.checkIn.date, value: v.value })) as SeriesPoint[],
    }))
    .filter((m) => m.points.length >= 2);

  return (
    <div>
      <h1 className="text-2xl font-bold">Mi progreso</h1>
      <p className="mt-1 text-muted">Evolución de tu peso a partir de tus check-ins.</p>

      {points.length < 2 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border p-12 text-center">
          <TrendingUp className="text-muted" size={32} />
          <p className="mt-3 font-medium">Necesitas al menos 2 check-ins con peso</p>
          <p className="mt-1 text-sm text-muted">Cuando hagas tu check-in semanal verás aquí la gráfica.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-baseline gap-3">
              <span className="text-3xl font-bold">{last!.value} kg</span>
              <span className={`text-sm font-medium ${diff <= 0 ? "text-[#1fa971]" : "text-[#e07b1a]"}`}>
                {diff > 0 ? "+" : ""}
                {Math.round(diff * 10) / 10} kg
              </span>
            </div>
            <MiniLineChart points={points} color="#e6197e" />
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-right font-medium">Peso</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2.5">{p.date.toLocaleDateString("es-ES")}</td>
                    <td className="px-4 py-2.5 text-right">{p.value} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Gráficas de métricas personalizadas. Solo pintamos las que tienen
          al menos 2 lecturas — con un solo punto no hay gráfica útil. */}
      {customSeries.length > 0 ? (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Tus métricas
          </h2>
          {customSeries.map((m, i) => {
            const lastV = m.points.at(-1)!;
            const firstV = m.points.at(0)!;
            const d = lastV.value - firstV.value;
            const color = CUSTOM_COLORS[i % CUSTOM_COLORS.length];
            return (
              <div key={m.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="text-lg font-bold">{m.name}</span>
                  <span className="text-2xl font-bold" style={{ color }}>
                    {lastV.value}
                    {m.unit ? ` ${m.unit}` : ""}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      d <= 0 ? "text-[#1fa971]" : "text-[#e07b1a]"
                    }`}
                  >
                    {d > 0 ? "+" : ""}
                    {Math.round(d * 10) / 10}
                    {m.unit ? ` ${m.unit}` : ""}
                  </span>
                </div>
                <MiniLineChart points={m.points} color={color} />
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Marcas de fuerza y benchmarks. El catálogo lo define el equipo en
          Biblioteca › Marcas de fuerza. Cada atleta lleva sus registros
          desde aquí y ve la evolución. */}
      <section className="mt-8">
        <header className="mb-3 flex items-center gap-2">
          <Dumbbell size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Marcas de fuerza y benchmarks</h2>
        </header>
        <p className="mb-4 text-sm text-muted">
          Registra tus 1RM, benchmarks y récords. Pulsa una marca para ver la evolución.
        </p>
        <OwnStrengthMarks
          marks={strengthMarks.map((m) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            unit: m.unit,
            direction: m.direction,
          }))}
          records={strengthRecords.map((r) => ({
            id: r.id,
            markId: r.markId,
            value: r.value,
            date: r.date.toISOString(),
            notes: r.notes,
          }))}
        />
      </section>
    </div>
  );
}
