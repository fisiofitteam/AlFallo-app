import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CRM_ACCESS_ROLES, callResultBadgeClass, callResultLabel } from "@/lib/crm";
import { CrmNav } from "@/components/CrmNav";

export const metadata = { title: "Agenda · CRM" };

export default async function CallsPage({ searchParams }: { searchParams: { result?: string } }) {
  const me = await requireProfessional();
  if (!CRM_ACCESS_ROLES.includes(me.role)) redirect("/");

  const resultFilter = searchParams.result && searchParams.result !== "all" ? searchParams.result : null;

  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.scheduledCall.findMany({
      where: { result: "pendiente", scheduledFor: { gte: now } },
      orderBy: { scheduledFor: "asc" },
      include: { lead: { select: { id: true, fullName: true } }, closer: { select: { fullName: true } } },
    }),
    prisma.scheduledCall.findMany({
      where: {
        OR: [{ result: { not: "pendiente" } }, { scheduledFor: { lt: now } }],
        ...(resultFilter ? { result: resultFilter } : {}),
      },
      orderBy: { scheduledFor: "desc" },
      take: 100,
      include: { lead: { select: { id: true, fullName: true } }, closer: { select: { fullName: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold md:text-3xl">CRM de ventas</h1>
        <p className="mt-1 text-muted">Agenda de llamadas y resultados.</p>
      </header>

      <CrmNav active="calls" />

      {/* Próximas */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Próximas ({upcoming.length})
      </h2>
      {upcoming.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Sin llamadas pendientes.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Lead</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Closer</th>
                <th className="hidden px-5 py-3 font-semibold lg:table-cell">Duración</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="px-5 py-3 font-medium">
                    {c.scheduledFor.toLocaleString("es-ES", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/crm/lead/${c.lead.id}`} className="text-primary hover:underline">
                      {c.lead.fullName}
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">{c.closer?.fullName ?? "—"}</td>
                  <td className="hidden px-5 py-3 text-muted lg:table-cell">
                    {c.durationMin ? `${c.durationMin} min` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pasadas */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Pasadas</h2>
        <form className="flex items-center gap-2">
          <select
            name="result"
            defaultValue={resultFilter ?? "all"}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-primary"
          >
            <option value="all">Todas</option>
            <option value="vendida">Vendidas</option>
            <option value="follow_up">Follow-up</option>
            <option value="perdida">Perdidas</option>
            <option value="cancelada">Canceladas</option>
            <option value="no_acude">No acude</option>
          </select>
          <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2">
            Filtrar
          </button>
        </form>
      </div>

      {past.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Aún no hay llamadas registradas.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Lead</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Closer</th>
                <th className="px-5 py-3 font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {past.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="px-5 py-3 text-muted">
                    {c.scheduledFor.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/crm/lead/${c.lead.id}`} className="text-primary hover:underline">
                      {c.lead.fullName}
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">{c.closer?.fullName ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${callResultBadgeClass(c.result)}`}>
                      {callResultLabel(c.result)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
