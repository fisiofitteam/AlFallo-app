import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import {
  CRM_ACCESS_ROLES,
  LEAD_STATUS_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  leadStatusBadgeClass,
  leadStatusLabel,
  sourceLabel,
} from "@/lib/crm";
import { Field, Select, TextInput } from "@/components/form-ui";
import { CrmNav } from "@/components/CrmNav";
import { createLead } from "./actions";

export const metadata = { title: "CRM · Leads" };

export default async function CrmLeadsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; source?: string };
}) {
  const me = await requireProfessional();
  if (!CRM_ACCESS_ROLES.includes(me.role)) redirect("/");

  const q = (searchParams.q ?? "").trim();
  const statusFilter = searchParams.status && searchParams.status !== "all" ? searchParams.status : null;
  const sourceFilter = searchParams.source && searchParams.source !== "all" ? searchParams.source : null;

  const [leads, professionals, counts] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(sourceFilter ? { source: sourceFilter } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { assignedTo: { select: { fullName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.professional.findMany({
      where: { isActive: true, role: { in: CRM_ACCESS_ROLES } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold md:text-3xl">CRM de ventas</h1>
        <p className="mt-1 text-muted">Gestiona los leads, llamadas y cierres.</p>
      </header>

      <CrmNav active="leads" />

      {/* Resumen de embudo */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-6">
        {LEAD_STATUS_OPTIONS.map((s) => (
          <Link
            key={s.value}
            href={`/crm?status=${s.value}`}
            className={`rounded-xl border border-border bg-surface p-3 text-center transition hover:border-primary ${
              statusFilter === s.value ? "border-primary" : ""
            }`}
          >
            <p className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${leadStatusBadgeClass(s.value)}`}>
              {s.label}
            </p>
            <p className="mt-1 text-xl font-bold">{countByStatus[s.value] ?? 0}</p>
          </Link>
        ))}
      </div>

      {/* Botón "Nuevo lead" plegable */}
      <details className="group mb-5">
        <summary className="ml-auto flex w-fit cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:opacity-90 [&::-webkit-details-marker]:hidden">
          <Plus size={16} /> <span className="group-open:hidden">Nuevo lead</span>
          <span className="hidden group-open:inline">Cerrar</span>
        </summary>
        <form action={createLead} className="mt-3 rounded-2xl border border-border bg-surface p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nombre completo" htmlFor="fullName">
              <TextInput id="fullName" name="fullName" required />
            </Field>
            <Field label="Email" htmlFor="email">
              <TextInput id="email" name="email" type="email" />
            </Field>
            <Field label="Teléfono" htmlFor="phone">
              <TextInput id="phone" name="phone" type="tel" />
            </Field>
            <Field label="Origen" htmlFor="source">
              <Select id="source" name="source" options={LEAD_SOURCE_OPTIONS} placeholder="Alta manual" />
            </Field>
            <Field label="Asignar a" htmlFor="assignedToId">
              <Select
                id="assignedToId"
                name="assignedToId"
                options={professionals.map((p) => ({ value: p.id, label: p.fullName }))}
                placeholder="A ti mismo"
              />
            </Field>
            <Field label="Notas" htmlFor="notes">
              <TextInput id="notes" name="notes" />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90">
              Crear lead
            </button>
          </div>
        </form>
      </details>

      {/* Buscador y filtros */}
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, email o teléfono…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          name="source"
          defaultValue={sourceFilter ?? "all"}
          className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          <option value="all">Todos los orígenes</option>
          {LEAD_SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2">
          Filtrar
        </button>
        {(q || statusFilter || sourceFilter) && (
          <Link href="/crm" className="rounded-xl px-3 py-2.5 text-sm text-muted hover:text-text">
            Limpiar
          </Link>
        )}
      </form>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">Sin leads</p>
          <p className="mt-1 text-sm text-muted">
            {q || statusFilter || sourceFilter ? "Prueba con otros filtros." : 'Crea el primero con "Nuevo lead".'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Nombre</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Origen</th>
                <th className="hidden px-5 py-3 font-semibold lg:table-cell">Asignado a</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="px-5 py-4">
                    <Link href={`/crm/lead/${l.id}`} className="block font-semibold hover:text-primary">
                      {l.fullName}
                    </Link>
                    {(l.email || l.phone) && (
                      <p className="text-xs text-muted">
                        {l.email}
                        {l.email && l.phone && " · "}
                        {l.phone}
                      </p>
                    )}
                  </td>
                  <td className="hidden px-5 py-4 text-muted md:table-cell">{sourceLabel(l.source)}</td>
                  <td className="hidden px-5 py-4 text-muted lg:table-cell">
                    {l.assignedTo?.fullName ?? "Sin asignar"}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${leadStatusBadgeClass(l.status)}`}>
                      {leadStatusLabel(l.status)}
                    </span>
                  </td>
                  <td className="hidden px-5 py-4 text-xs text-muted sm:table-cell">
                    {l.updatedAt.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
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
