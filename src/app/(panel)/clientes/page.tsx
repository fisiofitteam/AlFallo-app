import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search, Users, Stethoscope, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import {
  CLIENT_ACCESS_ROLES,
  clientScopeWhere,
  isManagerRole,
  statusBadgeClass,
  statusLabel,
} from "@/lib/clients";

export const metadata = { title: "Clientes · Al Fallo Nutrition" };
export const dynamic = "force-dynamic";

// Filtros disponibles vía ?filter=...
// - "all"          : todos los clientes en el scope del rol (default).
// - "mine"         : los que tiene asignado el actor (solo manager — el
//                    nutricionista ya tiene su scope acotado).
// - "unassigned"   : sin nutricionista asignado (solo manager).
// - "nutri:<id>"   : todos los del nutricionista con ese id (solo manager).
function parseFilter(value: string | undefined): {
  kind: "all" | "mine" | "unassigned" | "nutri";
  nutriId?: string;
} {
  if (!value) return { kind: "all" };
  if (value === "mine") return { kind: "mine" };
  if (value === "unassigned") return { kind: "unassigned" };
  if (value.startsWith("nutri:")) {
    const id = value.slice("nutri:".length);
    if (id) return { kind: "nutri", nutriId: id };
  }
  return { kind: "all" };
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string; filter?: string };
}) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const q = (searchParams.q ?? "").trim();
  const filter = parseFilter(searchParams.filter);
  const manager = isManagerRole(prof.role);
  const baseScope = clientScopeWhere(prof);

  // Filtro aplicado por encima del scope del rol.
  let filterWhere: Record<string, unknown> = {};
  if (manager) {
    if (filter.kind === "mine") filterWhere = { nutritionistId: prof.id };
    else if (filter.kind === "unassigned") filterWhere = { nutritionistId: null };
    else if (filter.kind === "nutri" && filter.nutriId)
      filterWhere = { nutritionistId: filter.nutriId };
  }
  // (Nutricionista no usa estos filtros; ve siempre su scope.)

  const whereSearch = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [clients, nutris] = await Promise.all([
    prisma.client.findMany({
      where: { ...baseScope, ...filterWhere, ...whereSearch },
      include: { nutritionist: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    manager
      ? prisma.professional.findMany({
          where: { isActive: true, role: { in: ["nutricionista", "head_coach"] } },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: "asc" },
        })
      : ([] as { id: string; fullName: string; role: string }[]),
  ]);

  // Counts para cada chip (managers). Cuando hay búsqueda activa, los counts
  // siguen reflejando "qué hay con este filtro" sin la búsqueda — para no
  // confundir al usuario sobre el universo de cada chip.
  let counts: {
    all: number;
    mine: number;
    unassigned: number;
    byNutri: Map<string, number>;
  } = { all: 0, mine: 0, unassigned: 0, byNutri: new Map() };
  if (manager) {
    const [all, mine, unassigned, perNutri] = await Promise.all([
      prisma.client.count({ where: { ...baseScope } }),
      prisma.client.count({ where: { ...baseScope, nutritionistId: prof.id } }),
      prisma.client.count({ where: { ...baseScope, nutritionistId: null } }),
      prisma.client.groupBy({
        by: ["nutritionistId"],
        where: { ...baseScope, nutritionistId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const map = new Map<string, number>();
    for (const row of perNutri) {
      if (row.nutritionistId) map.set(row.nutritionistId, row._count._all);
    }
    counts = { all, mine, unassigned, byNutri: map };
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Clientes</h1>
          <p className="mt-1 text-muted">
            {manager ? "Todos los atletas del equipo" : "Tus atletas asignados"}
          </p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90"
        >
          <Plus size={18} />
          Nuevo cliente
        </Link>
      </header>

      {/* Chips de filtro — solo para managers. El nutricionista ve siempre
          sus clientes y no necesita estos atajos. */}
      {manager ? (
        <nav className="mb-5 flex flex-wrap items-center gap-2">
          <FilterChip
            href={withFilter(q, null)}
            active={filter.kind === "all"}
            label="Todos"
            count={counts.all}
          />
          <FilterChip
            href={withFilter(q, "mine")}
            active={filter.kind === "mine"}
            label="Míos"
            count={counts.mine}
          />
          <FilterChip
            href={withFilter(q, "unassigned")}
            active={filter.kind === "unassigned"}
            label="Por asignar"
            count={counts.unassigned}
            tone="warning"
          />
          {nutris
            // Quitamos al actor si es head_coach: ya tiene su chip "Míos".
            .filter((n) => n.id !== prof.id)
            .map((n) => (
              <FilterChip
                key={n.id}
                href={withFilter(q, `nutri:${n.id}`)}
                active={filter.kind === "nutri" && filter.nutriId === n.id}
                label={n.fullName.split(" ")[0]}
                count={counts.byNutri.get(n.id) ?? 0}
                icon={n.role === "head_coach" ? "star" : "stetho"}
              />
            ))}
        </nav>
      ) : null}

      <form className="mb-5">
        {/* Mantenemos el filtro al buscar (la chip activa no se pierde). */}
        {searchParams.filter ? (
          <input type="hidden" name="filter" value={searchParams.filter} />
        ) : null}
        <div className="relative max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o email…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </form>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Users size={32} className="mx-auto text-muted" />
          <p className="mt-3 font-medium">{q ? "Sin resultados" : "Aún no hay clientes en este filtro"}</p>
          <p className="mt-1 text-sm text-muted">
            {q ? "Prueba con otra búsqueda." : "Cambia de filtro o crea uno con \"Nuevo cliente\"."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Nutricionista</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-border transition hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="block font-medium hover:text-primary">
                      {c.fullName}
                      {c.email && <span className="block text-xs text-muted">{c.email}</span>}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {c.nutritionist?.fullName ?? <span className="italic">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                        c.status,
                      )}`}
                    >
                      {statusLabel(c.status)}
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

function withFilter(q: string, filter: string | null): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter) params.set("filter", filter);
  const s = params.toString();
  return `/clientes${s ? `?${s}` : ""}`;
}

function FilterChip({
  href,
  active,
  label,
  count,
  tone = "default",
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone?: "default" | "warning";
  icon?: "stetho" | "star";
}) {
  const Icon = icon === "star" ? Star : icon === "stetho" ? Stethoscope : null;
  // Tonalidades:
  // - active default → bg negro como el sidebar de FisioFit (resalta).
  // - active warning → amarillo suave (cuando es "Por asignar" activo).
  // - inactivo default → borde sutil + texto.
  // - inactivo warning → borde amarillo claro, texto ámbar.
  const cls = active
    ? tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-text bg-text text-bg"
    : tone === "warning"
      ? "border-amber-200 bg-bg text-amber-700 hover:border-amber-300"
      : "border-border bg-bg text-text hover:border-primary hover:text-primary";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${cls}`}
    >
      {Icon ? <Icon size={13} className="opacity-80" /> : null}
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 text-[11px] font-semibold ${
          active
            ? tone === "warning"
              ? "bg-amber-100 text-amber-900"
              : "bg-bg/20 text-bg"
            : "bg-surface-2 text-muted"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
