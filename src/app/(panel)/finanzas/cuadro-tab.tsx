import { Trash2, Plus, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtEur, lastNMonths, monthKey, monthLabel, quarterOf } from "@/lib/finance";
import { LineChart, type ChartPoint } from "@/components/line-chart";
import { Field, TextInput } from "@/components/form-ui";
import { createGoal, deleteGoal } from "./actions";

function KpiCard({
  label,
  value,
  hint,
  tone = "pink",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pink" | "green" | "amber" | "blue";
}) {
  const map: Record<string, string> = {
    pink: "bg-[#fbe9f1] text-[#e6197e]",
    green: "bg-[#e7f6ec] text-[#15803d]",
    amber: "bg-[#fdecd9] text-[#b45309]",
    blue: "bg-[#e0edfd] text-[#1d4ed8]",
  };
  return (
    <div className={`rounded-2xl p-5 ${map[tone]}`}>
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export async function CuadroTab() {
  const now = new Date();
  const months = lastNMonths(6, now);
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { year: thisYear, quarter: thisQuarter } = quarterOf(now);

  const [transactions, activeClients, newClientsThisMonth, goals] = await Promise.all([
    prisma.transaction.findMany({ where: { date: { gte: sixMonthsAgo } } }),
    prisma.client.count({ where: { status: "activo" } }),
    prisma.client.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.quarterlyGoal.findMany({
      where: { year: thisYear, quarter: thisQuarter },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Agregados por mes
  const byMonth: Record<string, { ingresos: number; gastos: number; publicidad: number; sueldos: number }> = {};
  for (const k of months) byMonth[k] = { ingresos: 0, gastos: 0, publicidad: 0, sueldos: 0 };
  for (const t of transactions) {
    const k = monthKey(t.date);
    if (!byMonth[k]) continue;
    if (t.type === "ingreso") byMonth[k].ingresos += t.amount;
    else {
      byMonth[k].gastos += t.amount;
      if (t.category === "publicidad") byMonth[k].publicidad += t.amount;
      if (t.category === "sueldos") byMonth[k].sueldos += t.amount;
    }
  }

  const thisKey = monthKey(now);
  const cur = byMonth[thisKey];
  const beneficio = cur.ingresos - cur.gastos;
  const cacInputs = cur.publicidad + cur.sueldos;
  const cac = newClientsThisMonth > 0 ? cacInputs / newClientsThisMonth : null;

  const revenueSeries: ChartPoint[] = months.map((k) => ({
    label: monthLabel(k),
    value: Math.round(byMonth[k].ingresos),
  }));
  const expenseSeries: ChartPoint[] = months.map((k) => ({
    label: monthLabel(k),
    value: Math.round(byMonth[k].gastos),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs principales del mes en curso */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Este mes ({monthLabel(thisKey)})
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Ingresos" value={fmtEur(cur.ingresos)} tone="green" />
          <KpiCard label="Gastos" value={fmtEur(cur.gastos)} tone="amber" />
          <KpiCard
            label="Beneficio"
            value={fmtEur(beneficio)}
            tone={beneficio >= 0 ? "green" : "amber"}
          />
          <KpiCard
            label="CAC"
            value={cac == null ? "—" : fmtEur(cac)}
            hint={newClientsThisMonth > 0 ? `${newClientsThisMonth} nuevos cliente(s)` : "Sin clientes nuevos este mes"}
            tone="pink"
          />
        </div>
      </section>

      {/* Clientes */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Clientes</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="Clientes activos" value={String(activeClients)} tone="pink" />
          <KpiCard label="Nuevos este mes" value={String(newClientsThisMonth)} tone="blue" />
          <KpiCard
            label="Ingreso medio / activo"
            value={activeClients > 0 ? fmtEur(cur.ingresos / activeClients) : "—"}
            tone="green"
          />
        </div>
      </section>

      {/* Evolución últimos 6 meses */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Evolución (últimos 6 meses)
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-2 font-semibold">Ingresos</p>
            <LineChart points={revenueSeries} color="#1fa971" unit="€" />
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-2 font-semibold">Gastos</p>
            <LineChart points={expenseSeries} color="#e07b1a" unit="€" />
          </div>
        </div>
      </section>

      {/* Objetivos trimestrales */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <Target size={16} className="text-primary" />
          Objetivos Q{thisQuarter} {thisYear}
        </h2>

        <form
          action={createGoal}
          className="mb-3 grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-border p-4 sm:grid-cols-4"
        >
          <input type="hidden" name="year" value={thisYear} />
          <input type="hidden" name="quarter" value={thisQuarter} />
          <Field label="Objetivo" htmlFor="name">
            <TextInput id="name" name="name" placeholder="Ej. 25 clientes nuevos" required />
          </Field>
          <Field label="Importe (€)" htmlFor="targetAmount" hint="Opcional">
            <TextInput id="targetAmount" name="targetAmount" inputMode="decimal" />
          </Field>
          <Field label="Notas" htmlFor="notes">
            <TextInput id="notes" name="notes" />
          </Field>
          <div className="flex items-end">
            <button className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90">
              <Plus size={16} /> Añadir
            </button>
          </div>
        </form>

        {goals.length === 0 ? (
          <p className="text-sm text-muted">Sin objetivos para este trimestre todavía.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4"
              >
                <div>
                  <p className="font-semibold">{g.name}</p>
                  {g.targetAmount != null && (
                    <p className="text-sm text-muted">Objetivo: {fmtEur(g.targetAmount)}</p>
                  )}
                  {g.notes && <p className="text-xs text-muted">{g.notes}</p>}
                </div>
                <form action={deleteGoal}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
