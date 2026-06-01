import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import {
  CLIENT_ACCESS_ROLES,
  CLIENT_STATUSES,
  isManagerRole,
  statusBadgeClass,
  statusLabel,
} from "@/lib/clients";
import { TextInput } from "@/components/form-ui";
import type { ChartPoint } from "@/components/line-chart";
import { FichaForm } from "./ficha-form";
import { MacroTargetsForm } from "./macro-targets-form";
import { CheckInsTab } from "./checkins-tab";
import { EvolucionTab } from "./evolucion-tab";
import { reassignNutritionist, setClientPassword, updateClientStatus } from "../actions";
import { createPlan } from "../../planes/actions";

function shortDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const TABS = [
  { key: "ficha", label: "Ficha nutricional" },
  { key: "plan", label: "Plan", phase: "Fase 3" },
  { key: "restricciones", label: "Restricciones", phase: "Fase 5" },
  { key: "evolucion", label: "Evolución", phase: "Fase 5" },
  { key: "suscripcion", label: "Suscripción", phase: "Fase 6" },
  { key: "formularios", label: "Formularios / Check-ins", phase: "Fase 5" },
  { key: "consultas", label: "Consultas", phase: "Fase 5" },
] as const;

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      profile: true,
      macroTargets: true,
      nutritionist: { select: { fullName: true } },
      plans: { orderBy: { createdAt: "desc" }, include: { _count: { select: { days: true } } } },
      checkIns: { orderBy: { date: "desc" } },
      dailyLogs: {
        where: { weightKg: { not: null } },
        orderBy: { date: "asc" },
        select: { date: true, weightKg: true },
      },
    },
  });
  if (!client) redirect("/clientes");
  // Un nutricionista solo accede a sus clientes.
  if (!isManagerRole(prof.role) && client.nutritionistId !== prof.id) redirect("/clientes");

  const manager = isManagerRole(prof.role);
  const activeTab = TABS.find((t) => t.key === searchParams.tab) ?? TABS[0];

  const nutritionists = manager
    ? await prisma.professional.findMany({
        where: { isActive: true, role: { in: ["ceo", "head_coach", "nutricionista"] } },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  // Series para la pestaña Evolución (orden cronológico).
  const checkInsAsc = [...client.checkIns].reverse();
  const weightSeries: ChartPoint[] = [
    ...client.dailyLogs.map((l) => ({ date: l.date, value: l.weightKg as number })),
    ...checkInsAsc.filter((c) => c.weightKg != null).map((c) => ({ date: c.date, value: c.weightKg as number })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((p) => ({ label: shortDate(p.date), value: Math.round(p.value * 10) / 10 }));
  const waistSeries: ChartPoint[] = checkInsAsc
    .filter((c) => c.waistCm != null)
    .map((c) => ({ label: shortDate(c.date), value: c.waistCm as number }));
  const bodyFatSeries: ChartPoint[] = checkInsAsc
    .filter((c) => c.bodyFatPct != null)
    .map((c) => ({ label: shortDate(c.date), value: c.bodyFatPct as number }));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Clientes
      </Link>

      {/* Cabecera */}
      <header className="mb-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                {client.fullName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold">{client.fullName}</h1>
                <p className="text-sm text-muted">
                  {client.email ?? "Sin email"}
                  {client.phone && ` · ${client.phone}`}
                </p>
              </div>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(client.status)}`}>
            {statusLabel(client.status)}
          </span>
        </div>

        {/* Controles: estado y (managers) asignación */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <form action={updateClientStatus} className="flex items-end gap-2">
            <input type="hidden" name="clientId" value={client.id} />
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-muted">Estado</span>
              <select
                name="status"
                defaultValue={client.status}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {CLIENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2">
              Guardar
            </button>
          </form>

          {manager ? (
            <form action={reassignNutritionist} className="flex items-end gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-muted">Nutricionista</span>
                <select
                  name="nutritionistId"
                  defaultValue={client.nutritionistId ?? ""}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Sin asignar</option>
                  {nutritionists.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2">
                Guardar
              </button>
            </form>
          ) : (
            <div className="flex items-end">
              <p className="text-sm text-muted">
                Nutricionista: <span className="text-text">{client.nutritionist?.fullName ?? "Sin asignar"}</span>
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Acceso a la app del atleta */}
      <section className="mb-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Acceso a la app</h2>
        {!client.email ? (
          <p className="mt-2 text-sm text-muted">
            Añade un email al cliente para poder darle acceso a su app.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Inicia sesión en <span className="font-medium text-text">/cliente/login</span> con el email{" "}
              <span className="font-medium text-text">{client.email}</span>.{" "}
              {client.passwordHash ? "Ya tiene contraseña (puedes restablecerla)." : "Aún no tiene contraseña."}
            </p>
            <form action={setClientPassword} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <div className="min-w-[200px] flex-1">
                <TextInput
                  name="password"
                  type="text"
                  minLength={6}
                  placeholder={client.passwordHash ? "Nueva contraseña (mín. 6)" : "Contraseña (mín. 6)"}
                  required
                />
              </div>
              <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2">
                {client.passwordHash ? "Restablecer" : "Dar acceso"}
              </button>
            </form>
          </>
        )}
      </section>

      {/* Objetivos de macros */}
      <div className="mb-6">
        <MacroTargetsForm clientId={client.id} targets={client.macroTargets} />
      </div>

      {/* Pestañas */}
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const active = t.key === activeTab.key;
          return (
            <Link
              key={t.key}
              href={`/clientes/${client.id}?tab=${t.key}`}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
                active
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Contenido de la pestaña */}
      {activeTab.key === "ficha" ? (
        <FichaForm clientId={client.id} profile={client.profile} />
      ) : activeTab.key === "plan" ? (
        <div className="space-y-4">
          {client.plans.length > 0 && (
            <ul className="space-y-2">
              {client.plans.map((plan) => (
                <li key={plan.id}>
                  <Link
                    href={`/planes/${plan.id}`}
                    className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 transition hover:border-primary"
                  >
                    <span>
                      <span className="font-semibold">{plan.name}</span>
                      {plan.goal && <span className="block text-sm text-muted">{plan.goal}</span>}
                      <span className="text-xs text-muted">{plan._count.days} día(s)</span>
                    </span>
                    <ChevronRight size={18} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <form
            action={createPlan}
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-border p-4"
          >
            <input type="hidden" name="clientId" value={client.id} />
            <div className="min-w-[180px] flex-1">
              <TextInput name="name" placeholder="Nombre del plan (ej. Definición 12 semanas)" required />
            </div>
            <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
              <Plus size={16} /> Crear plan
            </button>
          </form>
          {client.plans.length === 0 && (
            <p className="text-center text-sm text-muted">Aún no hay planes. Crea el primero arriba.</p>
          )}
        </div>
      ) : activeTab.key === "evolucion" ? (
        <EvolucionTab weight={weightSeries} waist={waistSeries} bodyFat={bodyFatSeries} />
      ) : activeTab.key === "formularios" ? (
        <CheckInsTab checkIns={client.checkIns} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">{activeTab.label}</p>
          <p className="mt-1 text-sm text-muted">
            Disponible en {"phase" in activeTab ? activeTab.phase : "una próxima fase"} del roadmap.
          </p>
        </div>
      )}
    </div>
  );
}
