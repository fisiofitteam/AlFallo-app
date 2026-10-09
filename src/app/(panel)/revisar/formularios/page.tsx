import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, NotebookPen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, isManagerRole } from "@/lib/clients";

export const metadata = { title: "Check-ins por revisar · Al Fallo" };
export const dynamic = "force-dynamic";

const MS_DAY = 86_400_000;

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function daysAgo(d: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / MS_DAY));
}

export default async function CheckInsPendientesPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  // Un nutricionista solo ve pendientes de los clientes que tiene asignados.
  // Managers (CEO / head_coach) ven todos.
  const clientFilter = isManagerRole(prof.role)
    ? {}
    : { client: { nutritionistId: prof.id } };

  const pending = await prisma.checkIn.findMany({
    where: { reviewedAt: null, ...clientFilter },
    orderBy: { date: "asc" }, // los más antiguos arriba — son los que más urge revisar
    include: {
      client: {
        select: {
          id: true,
          fullName: true,
          nutritionist: { select: { fullName: true } },
        },
      },
    },
  });

  const now = new Date();

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        ← Volver al panel
      </Link>

      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <NotebookPen size={22} className="text-primary" /> Check-ins por revisar
        </h1>
        <p className="mt-1 text-sm text-muted">
          Los que llevan más tiempo esperando aparecen arriba. Pulsa cualquiera para
          abrir la ficha del atleta en la pestaña de check-ins.
        </p>
      </header>

      <section className="mb-5 grid grid-cols-3 gap-3">
        <SummaryCard label="Total pendientes" value={pending.length} tone="text-text" />
        <SummaryCard
          label="Esperan > 3 días"
          value={pending.filter((p) => daysAgo(p.date, now) > 3).length}
          tone="text-[#e07b1a]"
        />
        <SummaryCard
          label="Esperan > 7 días"
          value={pending.filter((p) => daysAgo(p.date, now) > 7).length}
          tone="text-rose-600"
        />
      </section>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center text-sm text-muted">
          🎉 Ningún check-in pendiente de revisar.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {pending.map((c) => {
            const days = daysAgo(c.date, now);
            const tone =
              days > 7 ? "text-rose-600" : days > 3 ? "text-amber-700" : "text-text";
            return (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.client.id}?tab=checkins`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                    {c.client.fullName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.client.fullName}</p>
                    <p className="text-[11px] text-muted">
                      Enviado el {fmtDate(c.date)}
                      {c.client.nutritionist?.fullName
                        ? ` · Nutri: ${c.client.nutritionist.fullName}`
                        : " · Sin nutri asignado"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold tabular-nums ${tone}`}>
                      {days === 0 ? "hoy" : `${days}d`}
                    </p>
                    <p className="flex items-center justify-end gap-0.5 text-[10px] text-muted">
                      <Clock size={9} /> esperando
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
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
