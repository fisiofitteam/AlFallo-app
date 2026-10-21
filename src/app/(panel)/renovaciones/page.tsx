import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { ensureRenewalNotifications, periodProgress } from "@/lib/subscriptions";
import { withHeartbeatCache } from "@/lib/heartbeat-cache";

export const metadata = { title: "Renovaciones · Al Fallo" };
export const dynamic = "force-dynamic";

const MS_DAY = 86_400_000;

function daysUntil(target: Date, from = new Date()): number {
  return Math.round((target.getTime() - from.getTime()) / MS_DAY);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

const BUCKETS: {
  key: string;
  label: string;
  hint: string;
  test: (d: number) => boolean;
  tone: string;
}[] = [
  { key: "expired", label: "Vencidos", hint: "Ya venció, sin renovación registrada", test: (d) => d < 0, tone: "text-rose-700 bg-rose-50 border-rose-200" },
  { key: "d21", label: "Vencen en ≤ 21 días", hint: "Ventana de aviso — agenda ya la llamada de renovación", test: (d) => d >= 0 && d <= 21, tone: "text-amber-800 bg-amber-50 border-amber-200" },
  { key: "d30", label: "22-30 días", hint: "Planifica hueco en calendario", test: (d) => d > 21 && d <= 30, tone: "text-orange-800 bg-orange-50 border-orange-200" },
  { key: "d60", label: "31-60 días", hint: "Contexto de fidelización", test: (d) => d > 30 && d <= 60, tone: "text-sky-800 bg-sky-50 border-sky-200" },
  { key: "d90", label: "61-90 días", hint: "Vista larga", test: (d) => d > 60 && d <= 90, tone: "text-emerald-800 bg-emerald-50 border-emerald-200" },
  { key: "later", label: "Más adelante", hint: "> 90 días", test: (d) => d > 90, tone: "text-neutral-700 bg-neutral-50 border-neutral-200" },
];

export default async function RenovacionesPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const now = new Date();
  await withHeartbeatCache(
    `renewal-notifications:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`,
    5 * 60 * 1000,
    () => ensureRenewalNotifications(now),
  );

  const periods = await prisma.subscriptionPeriod.findMany({
    where: { status: "active" },
    orderBy: { endDate: "asc" },
    include: {
      client: {
        select: {
          id: true,
          fullName: true,
          email: true,
          nutritionist: { select: { fullName: true } },
        },
      },
    },
  });

  const rows = periods.map((p) => ({
    period: p,
    daysLeft: daysUntil(p.endDate, now),
    progress: periodProgress({ startDate: p.startDate, endDate: p.endDate }),
  }));

  const grouped = BUCKETS.map((b) => ({
    ...b,
    items: rows.filter((r) => b.test(r.daysLeft)),
  }));

  const totalActive = periods.length;
  const expiring21 = rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 21).length;
  const expired = rows.filter((r) => r.daysLeft < 0).length;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold md:text-3xl">Renovaciones</h1>
        <p className="mt-1 text-sm text-muted">
          Todos los periodos activos ordenados por vencimiento. Pulsa un cliente para abrir su
          pestaña de programa y registrar la renovación.
        </p>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <SummaryCard label="Periodos activos" value={totalActive} tone="text-text" />
        <SummaryCard label="Vencen en 21 días" value={expiring21} tone="text-[#e07b1a]" />
        <SummaryCard label="Vencidos" value={expired} tone="text-rose-600" />
      </section>

      {totalActive === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center text-sm text-muted">
          Ningún cliente tiene periodo activo todavía.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((bucket) => {
            if (bucket.items.length === 0) return null;
            return (
              <section key={bucket.key}>
                <header className={`mb-2 rounded-xl border px-3 py-2 ${bucket.tone}`}>
                  <p className="text-sm font-bold">
                    {bucket.label}{" "}
                    <span className="ml-1 text-xs opacity-70">({bucket.items.length})</span>
                  </p>
                  <p className="text-[11px] opacity-70">{bucket.hint}</p>
                </header>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                  {bucket.items.map(({ period, daysLeft, progress }) => (
                    <li key={period.id}>
                      <Link
                        href={`/clientes/${period.client.id}?tab=programa`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                          {period.client.fullName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{period.client.fullName}</p>
                          <p className="text-[11px] text-muted">
                            {period.periodMonths} {period.periodMonths === 1 ? "mes" : "meses"}
                            {period.amountPaid != null ? ` · ${period.amountPaid.toFixed(2)} €` : ""}
                            {period.client.nutritionist?.fullName
                              ? ` · Nutri: ${period.client.nutritionist.fullName}`
                              : " · Sin nutri asignado"}
                          </p>
                        </div>
                        <div className="hidden text-right sm:block">
                          <p className="text-xs text-muted">Vence</p>
                          <p className="text-sm font-medium">{fmtDate(period.endDate)}</p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-bold tabular-nums ${
                              daysLeft < 0
                                ? "text-rose-600"
                                : daysLeft <= 15
                                ? "text-amber-700"
                                : "text-text"
                            }`}
                          >
                            {daysLeft < 0
                              ? `${Math.abs(daysLeft)}d atrás`
                              : `${daysLeft}d`}
                          </p>
                          <p className="text-[10px] text-muted flex items-center justify-end gap-0.5">
                            <Clock size={9} />
                            {progress.percent}% consumido
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
