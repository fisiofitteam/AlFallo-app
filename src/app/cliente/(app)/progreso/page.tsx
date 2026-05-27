import { TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";

export const metadata = { title: "Mi progreso · Al Fallo" };

function WeightChart({ points }: { points: { date: Date; weight: number }[] }) {
  const W = 320;
  const H = 140;
  const pad = 8;
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (p.weight - min) / range) * (H - pad * 2);
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolución del peso">
      <path d={path} fill="none" stroke="#e6197e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill="#e6197e" />
      ))}
    </svg>
  );
}

export default async function ProgressPage() {
  const me = await requireOnboardedClient();

  const logs = await prisma.dailyLog.findMany({
    where: { clientId: me.id, weightKg: { not: null } },
    orderBy: { date: "asc" },
    select: { date: true, weightKg: true },
    take: 60,
  });

  const points = logs.map((l) => ({ date: l.date, weight: l.weightKg as number }));
  const last = points.at(-1);
  const first = points.at(0);
  const diff = last && first ? last.weight - first.weight : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold">Mi progreso</h1>
      <p className="mt-1 text-muted">Evolución de tu peso a partir de tus registros.</p>

      {points.length < 2 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border p-12 text-center">
          <TrendingUp className="text-muted" size={32} />
          <p className="mt-3 font-medium">Necesitas al menos 2 registros con peso</p>
          <p className="mt-1 text-sm text-muted">Apunta tu peso en el registro diario para ver la gráfica.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-baseline gap-3">
              <span className="text-3xl font-bold">{last!.weight} kg</span>
              <span className={`text-sm font-medium ${diff <= 0 ? "text-[#1fa971]" : "text-[#e07b1a]"}`}>
                {diff > 0 ? "+" : ""}
                {Math.round(diff * 10) / 10} kg
              </span>
            </div>
            <WeightChart points={points} />
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
                    <td className="px-4 py-2.5 text-right">{p.weight} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
