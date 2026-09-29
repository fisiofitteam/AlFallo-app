import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus, Search, Users, Stethoscope, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import {
  CLIENT_ACCESS_ROLES,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  clientScopeWhere,
  isManagerRole,
  optionLabel,
  statusBadgeClass,
  statusLabel,
} from "@/lib/clients";
import {
  computeCompliance,
  computeSubscription,
  metricTone,
  renewalLabel,
  weekLabel,
} from "@/lib/clientMetrics";
import { MetricDonut } from "@/components/MetricDonut";

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

  const whereSearch = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Para pintar la card de cada cliente necesitamos: profile (goal, nivel,
  // consideraciones, whatsapp), última venta (suscripción) y check-ins
  // recientes (cumplimiento). Los check-ins los acotamos en un único query
  // global y los agrupamos en memoria — mucho más barato que un include
  // anidado por cliente con muchos check-ins.
  const [clients, nutris, considerations] = await Promise.all([
    prisma.client.findMany({
      where: { ...baseScope, ...filterWhere, ...whereSearch },
      include: {
        nutritionist: { select: { fullName: true } },
        profile: {
          select: {
            goal: true,
            level: true,
            specialConsiderationIds: true,
            whatsappGroupUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    manager
      ? prisma.professional.findMany({
          where: { isActive: true, role: { in: ["nutricionista", "head_coach"] } },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: "asc" },
        })
      : ([] as { id: string; fullName: string; role: string }[]),
    // Todas las consideraciones activas — para resolver título por ID en cada
    // card sin tirar por cliente.
    prisma.specialConsideration.findMany({
      where: { active: true },
      select: { id: true, title: true },
      orderBy: { order: "asc" },
    }),
  ]);

  // Los campos programStart/End/DurationMonths ya vienen en `clients` (caché
  // que se rellena al aplicar un SubscriptionPeriod). Si un cliente no tiene
  // periodo registrado todavía pero sí una Sale antigua, usamos esa como
  // fallback para no romper datos legacy.
  const clientIds = clients.map((c) => c.id);
  const legacyIds = clients
    .filter((c) => !c.programStartDate || !c.programEndDate)
    .map((c) => c.id);
  const [sales, checkIns] = await Promise.all([
    legacyIds.length
      ? prisma.sale.findMany({
          where: { clientId: { in: legacyIds } },
          orderBy: { startDate: "desc" },
          select: { clientId: true, startDate: true, endDate: true, planMonths: true },
        })
      : [],
    clientIds.length
      ? prisma.checkIn.findMany({
          where: {
            clientId: { in: clientIds },
            date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
          },
          select: { clientId: true, date: true },
        })
      : [],
  ]);

  // Mapa clientId → última venta legacy (fallback para clientes sin periodo).
  const saleByClient = new Map<string, (typeof sales)[number]>();
  for (const s of sales) {
    if (s.clientId && !saleByClient.has(s.clientId)) saleByClient.set(s.clientId, s);
  }
  const checkInsByClient = new Map<string, Date[]>();
  for (const ci of checkIns) {
    const arr = checkInsByClient.get(ci.clientId) ?? [];
    arr.push(ci.date);
    checkInsByClient.set(ci.clientId, arr);
  }
  const considerationLabelById = new Map(considerations.map((c) => [c.id, c.title]));

  // Counts para cada chip (managers).
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

      {/* Chips de filtro — solo para managers. */}
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
          <p className="mt-3 font-medium">
            {q ? "Sin resultados" : "Aún no hay clientes en este filtro"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {q ? "Prueba con otra búsqueda." : "Cambia de filtro o crea uno con \"Nuevo cliente\"."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => {
            const goalLabel = c.profile?.goal ? optionLabel(GOAL_OPTIONS, c.profile.goal) : null;
            const levelText = c.profile?.level
              ? optionLabel(LEVEL_OPTIONS, c.profile.level)
              : null;
            const consTitles = (c.profile?.specialConsiderationIds ?? [])
              .map((id) => considerationLabelById.get(id))
              .filter((t): t is string => !!t);
            // Línea verde con la info nutricional resumida (estilo FisioFit).
            const infoBits: string[] = [];
            if (goalLabel) infoBits.push(goalLabel);
            consTitles.forEach((t) => infoBits.push(t));
            if (!c.nutritionist?.fullName && manager) infoBits.push("Sin nutri asignado");

            // Métricas — la caché del Client (rellenada por SubscriptionPeriod)
            // manda; caemos a la última Sale solo si el cliente aún no tiene
            // periodo registrado (datos legacy).
            const legacySale = saleByClient.get(c.id);
            const sub = computeSubscription(
              c.programStartDate && c.programEndDate
                ? {
                    startDate: c.programStartDate,
                    endDate: c.programEndDate,
                    planMonths: c.programDurationMonths ?? null,
                  }
                : legacySale
                ? {
                    startDate: legacySale.startDate,
                    endDate: legacySale.endDate,
                    planMonths: legacySale.planMonths,
                  }
                : null,
            );
            const comp = computeCompliance(sub, checkInsByClient.get(c.id) ?? []);
            const subTone = metricTone(sub.progressPct, sub.hasSubscription);
            const compTone = metricTone(comp.compliancePct, comp.hasCompliance);
            const waUrl = c.profile?.whatsappGroupUrl?.trim() || null;

            return (
              <article
                key={c.id}
                className="rounded-2xl border border-border bg-surface p-5 transition hover:border-primary"
              >
                <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
                  {/* Bloque izquierdo: nombre, badges, info nutricional */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="text-lg font-bold hover:text-primary"
                      >
                        {c.fullName}
                      </Link>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(c.status)}`}
                      >
                        {statusLabel(c.status)}
                      </span>
                      {levelText ? (
                        <span className="inline-block rounded-full bg-[#fdecd9] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#b45309]">
                          {levelText}
                        </span>
                      ) : null}
                    </div>
                    {c.email ? (
                      <p className="mt-0.5 text-xs text-muted">{c.email}</p>
                    ) : null}
                    {infoBits.length > 0 ? (
                      <p className="mt-2 text-sm font-medium text-[#15803d]">
                        ✓ {infoBits.join(" · ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm italic text-muted">
                        Ficha sin objetivo definido todavía.
                      </p>
                    )}
                    {manager && c.nutritionist?.fullName ? (
                      <p className="mt-1 text-xs text-muted">
                        Nutri: {c.nutritionist.fullName}
                      </p>
                    ) : null}
                  </div>

                  {/* Bloque derecho: métricas + WhatsApp + flecha */}
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:items-end">
                    <div className="text-right text-xs leading-tight text-muted">
                      <div>{renewalLabel(sub)}</div>
                      {weekLabel(sub) ? (
                        <div className="text-[11px] font-medium text-primary">
                          {weekLabel(sub)}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-4">
                      <MetricDonut
                        value={sub.progressPct}
                        tone={subTone}
                        label="Suscripción"
                      />
                      <MetricDonut
                        value={comp.compliancePct}
                        tone={compTone}
                        label="Cumplimiento"
                      />
                      <WhatsAppButton url={waUrl} />
                      <Link
                        href={`/clientes/${c.id}`}
                        aria-label="Abrir ficha del cliente"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg text-text transition hover:border-primary hover:text-primary"
                      >
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WhatsAppButton({ url }: { url: string | null }) {
  // Icono de WhatsApp simple en SVG para no añadir dependencia. Si no hay URL,
  // queda gris y deshabilitado con tooltip explicando que se rellena en la
  // ficha del cliente.
  const Icon = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.94 11.94 0 0 0 12.02 0C5.4 0 .03 5.37.03 11.99c0 2.11.55 4.17 1.6 5.98L0 24l6.18-1.62a11.95 11.95 0 0 0 5.84 1.49h.01c6.62 0 11.99-5.37 11.99-11.99 0-3.2-1.25-6.21-3.5-8.4ZM12.03 21.3h-.01a9.94 9.94 0 0 1-5.07-1.39l-.36-.21-3.67.96.98-3.57-.24-.37a9.93 9.93 0 0 1-1.52-5.32c0-5.49 4.47-9.96 9.97-9.96 2.66 0 5.16 1.04 7.04 2.92a9.9 9.9 0 0 1 2.92 7.04c0 5.49-4.47 9.96-9.97 9.96Zm5.47-7.46c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.06 2.89 1.21 3.09.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
  if (!url) {
    return (
      <span
        title="Pega el enlace al grupo en la ficha del cliente"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-muted"
      >
        {Icon}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title="Abrir grupo de WhatsApp"
      aria-label="Abrir grupo de WhatsApp"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:opacity-90"
    >
      {Icon}
    </a>
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
