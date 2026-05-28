import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CRM_ACCESS_ROLES } from "@/lib/crm";
import { isManager } from "@/lib/roles";
import { fmtEur, monthKey, monthLabel, lastNMonths } from "@/lib/finance";
import { LineChart, type ChartPoint } from "@/components/line-chart";
import { CrmNav } from "@/components/CrmNav";

export const metadata = { title: "Ventas · CRM" };

export default async function SalesPage() {
  const me = await requireProfessional();
  if (!CRM_ACCESS_ROLES.includes(me.role)) redirect("/");

  const sales = await prisma.sale.findMany({
    orderBy: { startDate: "desc" },
    take: 200,
    include: {
      lead: { select: { fullName: true } },
      client: { select: { id: true, fullName: true } },
      closer: { select: { fullName: true } },
    },
  });

  const canSeeAmounts = isManager(me.role);

  // Totales y resumen del mes
  const now = new Date();
  const months = lastNMonths(6, now);
  const monthly: Record<string, { count: number; total: number }> = {};
  for (const k of months) monthly[k] = { count: 0, total: 0 };
  let totalAll = 0;
  for (const s of sales) {
    totalAll += s.amount;
    const k = monthKey(s.startDate);
    if (monthly[k]) {
      monthly[k].count++;
      monthly[k].total += s.amount;
    }
  }

  const thisMonth = monthly[monthKey(now)];
  const series: ChartPoint[] = months.map((k) => ({
    label: monthLabel(k),
    value: Math.round(monthly[k].total),
  }));

  // Ranking por closer
  const byCloser: Record<string, { name: string; count: number; total: number }> = {};
  for (const s of sales) {
    const id = s.closerId ?? "sin";
    const name = s.closer?.fullName ?? "Sin asignar";
    if (!byCloser[id]) byCloser[id] = { name, count: 0, total: 0 };
    byCloser[id].count++;
    byCloser[id].total += s.amount;
  }
  const closerRanking = Object.values(byCloser).sort((a, b) => b.total - a.total);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold md:text-3xl">CRM de ventas</h1>
        <p className="mt-1 text-muted">Historial de cierres.</p>
      </header>

      <CrmNav active="sales" />

      {canSeeAmounts && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#e7f6ec] p-5">
            <p className="text-sm text-zinc-600">Ventas este mes</p>
            <p className="mt-1 text-2xl font-bold text-[#15803d]">{fmtEur(thisMonth?.total ?? 0)}</p>
            <p className="text-xs text-zinc-500">{thisMonth?.count ?? 0} cierre(s)</p>
          </div>
          <div className="rounded-2xl bg-[#fbe9f1] p-5">
            <p className="text-sm text-zinc-600">Total acumulado</p>
            <p className="mt-1 text-2xl font-bold text-[#e6197e]">{fmtEur(totalAll)}</p>
            <p className="text-xs text-zinc-500">{sales.length} venta(s)</p>
          </div>
          <div className="rounded-2xl bg-[#e0edfd] p-5">
            <p className="text-sm text-zinc-600">Ticket medio</p>
            <p className="mt-1 text-2xl font-bold text-[#1d4ed8]">
              {sales.length > 0 ? fmtEur(totalAll / sales.length) : "—"}
            </p>
          </div>
        </div>
      )}

      {canSeeAmounts && sales.length >= 2 && (
        <section className="mb-6 rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Evolución (últimos 6 meses)
          </h2>
          <LineChart points={series} color="#1fa971" unit="€" />
        </section>
      )}

      {canSeeAmounts && closerRanking.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Por closer</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Closer</th>
                  <th className="px-5 py-3 text-right font-semibold">Cierres</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {closerRanking.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3 text-right text-muted">{r.count}</td>
                    <td className="px-5 py-3 text-right font-medium">{fmtEur(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Todas las ventas</h2>
      {sales.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted">
          Aún no hay ventas registradas. Las verás aquí cuando cierres un lead.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="hidden px-5 py-3 font-semibold lg:table-cell">Closer</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Plan</th>
                {canSeeAmounts && <th className="px-5 py-3 text-right font-semibold">Importe</th>}
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="px-5 py-3 text-muted">
                    {s.startDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-5 py-3">
                    {s.client ? (
                      <Link href={`/clientes/${s.client.id}`} className="font-medium text-primary hover:underline">
                        {s.client.fullName}
                      </Link>
                    ) : (
                      <span className="font-medium">{s.lead?.fullName ?? "—"}</span>
                    )}
                  </td>
                  <td className="hidden px-5 py-3 text-muted lg:table-cell">{s.closer?.fullName ?? "—"}</td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">
                    {s.planMonths ? `${s.planMonths} meses` : "—"}
                  </td>
                  {canSeeAmounts && (
                    <td className="px-5 py-3 text-right font-medium text-[#15803d]">{fmtEur(s.amount, 2)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
