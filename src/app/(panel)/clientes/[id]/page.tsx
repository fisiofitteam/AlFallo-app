import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  UtensilsCrossed, ClipboardList, Target, CalendarDays,
  TrendingUp, NotebookPen, KeyRound, Settings,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import {
  CLIENT_ACCESS_ROLES,
  CLIENT_STATUSES,
  GOAL_OPTIONS,
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
import { PlanBuilder } from "@/components/PlanBuilder";
import { PlanPicker, AddPlanButton } from "@/components/PlanPicker";
import { PlanCards } from "@/components/PlanCards";
import { getPlanCardsForClient } from "@/lib/planSummary";
import { loadPlanForBuilder } from "@/lib/loadPlanData";
import { buildWeeklyMenu } from "@/lib/weeklyMenu";
import { WeeklyMenuView } from "@/components/WeeklyMenuView";
import { getAllSpecialConsiderations } from "@/lib/specialConsiderations";

function shortDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Sidebar lateral con descripciones. Sustituye al sidebar global del panel
// (que está oculto en este path por PanelShell).
type SectionKey =
  | "plan"
  | "semanal"
  | "ficha"
  | "macros"
  | "evolucion"
  | "checkins"
  | "acceso"
  | "ajustes";

const SECTIONS: { key: SectionKey; label: string; description: string; icon: LucideIcon }[] = [
  { key: "plan", label: "Plan nutricional", description: "Comidas, opciones y macros", icon: UtensilsCrossed },
  { key: "semanal", label: "Plan semanal", description: "L-D con opción asignada por día", icon: CalendarDays },
  { key: "ficha", label: "Ficha nutricional", description: "Anamnesis y datos personales", icon: ClipboardList },
  { key: "macros", label: "Macros objetivo", description: "Kcal y reparto entreno/descanso", icon: Target },
  { key: "evolucion", label: "Evolución", description: "Peso, cintura y % grasa", icon: TrendingUp },
  { key: "checkins", label: "Check-ins", description: "Cuestionarios semanales", icon: NotebookPen },
  { key: "acceso", label: "Acceso a la app", description: "Credenciales del cliente", icon: KeyRound },
  { key: "ajustes", label: "Ajustes", description: "Estado y nutricionista asignado", icon: Settings },
];

function parseSection(value: string | undefined): SectionKey {
  return (SECTIONS.find((s) => s.key === value)?.key ?? "plan") as SectionKey;
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; planId?: string };
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
  const active = parseSection(searchParams.tab);

  // Consideraciones especiales: las cargamos una sola vez para alimentar el
  // selector de la pestaña "Ficha nutricional".
  const specialConsiderations = await getAllSpecialConsiderations();
  const selectedConsiderationIds = client.profile?.specialConsiderationIds ?? [];

  // Pestañas Plan/Semanal: galería ↔ detalle.
  // - Sin ?planId  → galería con cards (name + descripción + macros).
  // - Con ?planId  → cargamos ese plan y pintamos el builder / vista semanal.
  // Si el ?planId no pertenece al cliente, lo ignoramos y caemos en galería.
  let activePlanData: Awaited<ReturnType<typeof loadPlanForBuilder>> = null;
  let planCards: Awaited<ReturnType<typeof getPlanCardsForClient>> = [];
  if (active === "plan" || active === "semanal") {
    if (searchParams.planId) {
      const valid = client.plans.find((p) => p.id === searchParams.planId);
      if (valid) activePlanData = await loadPlanForBuilder(valid.id);
    }
    if (!activePlanData) {
      planCards = await getPlanCardsForClient(client.id);
    }
  }

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
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
      {/* Back link + cabecera del cliente */}
      <Link
        href="/clientes"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Clientes
      </Link>

      <header className="mb-8 flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
          {client.fullName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">{client.fullName}</h1>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${statusBadgeClass(
                client.status,
              )}`}
            >
              {statusLabel(client.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {client.email ?? "Sin email"}
            {client.phone && ` · ${client.phone}`}
          </p>
        </div>
      </header>

      {/* Layout 2 columnas: sidebar de secciones + contenido del tab activo.
          Mismo lenguaje visual que el sidebar global del panel: item activo en
          'bg-primary-soft text-primary', inactivo en 'text-text/70' con hover. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-0.5">
          {SECTIONS.map((s) => {
            const isActive = s.key === active;
            const Icon = s.icon;
            return (
              <Link
                key={s.key}
                href={`/clientes/${client.id}?tab=${s.key}`}
                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                  isActive
                    ? "bg-primary-soft text-primary"
                    : "text-text/80 hover:bg-surface-2"
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={1.7}
                  className={`mt-0.5 flex-shrink-0 ${isActive ? "text-primary" : "text-muted"}`}
                />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${isActive ? "text-primary" : ""}`}>
                    {s.label}
                  </p>
                  <p className={`mt-0.5 text-xs leading-snug ${isActive ? "text-primary/70" : "text-muted"}`}>
                    {s.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </aside>

        <section>
          {active === "plan" || active === "semanal" ? (
            activePlanData ? (
              // Vista DETALLE: builder completo o vista semanal del plan
              // elegido. Mantenemos el PlanPicker (sigue siendo útil para
              // saltar entre planes sin volver a la galería) + un atajo
              // "← Volver a planes".
              <>
                <Link
                  href={`/clientes/${client.id}?tab=${active}`}
                  className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
                >
                  <ArrowLeft size={14} /> Volver a planes
                </Link>
                <PlanPicker
                  clientId={client.id}
                  plans={client.plans.map((p) => ({ id: p.id, name: p.name }))}
                  selectedPlanId={activePlanData.plan.id}
                  goalOptions={GOAL_OPTIONS}
                  considerations={specialConsiderations.map((c) => ({ id: c.id, title: c.title }))}
                />
                {active === "plan" ? (
                  <PlanBuilder
                    // key={planId} fuerza un remount cuando el nutri cambia
                    // de plan. Sin esto, useState mantendría los días/opciones
                    // del plan anterior y los autosaves contaminarían el
                    // plan equivocado.
                    key={activePlanData.plan.id}
                    embedded
                    planId={activePlanData.plan.id}
                    clientId={activePlanData.plan.clientId}
                    clientName={activePlanData.plan.client.fullName}
                    planName={activePlanData.plan.name}
                    initialDays={activePlanData.days}
                    initialNotes={activePlanData.plan.notes}
                    initialSupplementation={activePlanData.plan.supplementation}
                    initialTargets={activePlanData.targets}
                  />
                ) : (
                  <WeeklyMenuView days={buildWeeklyMenu(activePlanData.days)} />
                )}
              </>
            ) : (
              // Vista GALERÍA: cards de todos los planes + botón Añadir.
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold">
                      {active === "plan" ? "Planes nutricionales" : "Vista semanal"}
                    </h2>
                    <p className="text-sm text-muted">
                      {planCards.length === 0
                        ? "Aún no hay planes para este cliente."
                        : "Pulsa un plan para abrirlo completo. La descripción la ve el atleta en su app."}
                    </p>
                  </div>
                  <AddPlanButton
                    clientId={client.id}
                    goalOptions={GOAL_OPTIONS}
                    considerations={specialConsiderations.map((c) => ({ id: c.id, title: c.title }))}
                  />
                </div>
                {planCards.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
                    Aún no hay planes. Pulsa "Añadir plan" arriba para crear el primero. Podrás darle
                    a la IA tus instrucciones, elegir un objetivo concreto y una consideración especial.
                  </p>
                ) : (
                  <PlanCards mode="panel" clientId={client.id} plans={planCards} />
                )}
              </>
            )
          ) : active === "ficha" ? (
            <FichaForm
              clientId={client.id}
              profile={client.profile}
              specialConsiderations={specialConsiderations}
              selectedConsiderationIds={selectedConsiderationIds}
            />
          ) : active === "macros" ? (
            <MacroTargetsForm clientId={client.id} targets={client.macroTargets} />
          ) : active === "evolucion" ? (
            <EvolucionTab weight={weightSeries} waist={waistSeries} bodyFat={bodyFatSeries} />
          ) : active === "checkins" ? (
            <CheckInsTab checkIns={client.checkIns} />
          ) : active === "acceso" ? (
            <AccesoSection
              clientId={client.id}
              email={client.email}
              hasPassword={!!client.passwordHash}
            />
          ) : (
            <AjustesSection
              clientId={client.id}
              status={client.status}
              nutritionistId={client.nutritionistId}
              nutritionistName={client.nutritionist?.fullName ?? null}
              isManager={manager}
              nutritionists={nutritionists}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ── Sub-componentes inline para mantener el archivo manejable ───────────

function AccesoSection({
  clientId,
  email,
  hasPassword,
}: {
  clientId: string;
  email: string | null;
  hasPassword: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <KeyRound size={18} className="text-primary" /> Acceso a la app del atleta
      </h2>
      {!email ? (
        <p className="mt-2 text-sm text-muted">
          Añade un email al cliente para poder darle acceso a su app. Lo editas desde la pestaña
          "Ficha nutricional".
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Inicia sesión en <span className="font-medium text-text">/cliente/login</span> con el email{" "}
            <span className="font-medium text-text">{email}</span>.{" "}
            {hasPassword ? "Ya tiene contraseña (puedes restablecerla)." : "Aún no tiene contraseña."}
          </p>
          <form action={setClientPassword} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="clientId" value={clientId} />
            <div className="min-w-[200px] flex-1">
              <TextInput
                name="password"
                type="text"
                minLength={6}
                placeholder={hasPassword ? "Nueva contraseña (mín. 6)" : "Contraseña (mín. 6)"}
                required
              />
            </div>
            <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2">
              {hasPassword ? "Restablecer" : "Dar acceso"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function AjustesSection({
  clientId,
  status,
  nutritionistId,
  nutritionistName,
  isManager,
  nutritionists,
}: {
  clientId: string;
  status: string;
  nutritionistId: string | null;
  nutritionistName: string | null;
  isManager: boolean;
  nutritionists: { id: string; fullName: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Estado del cliente</h2>
        <form action={updateClientStatus} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="clientId" value={clientId} />
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">Estado</span>
            <select
              name="status"
              defaultValue={status}
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
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Nutricionista asignado</h2>
        {isManager ? (
          <form action={reassignNutritionist} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="clientId" value={clientId} />
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-muted">Reasignar</span>
              <select
                name="nutritionistId"
                defaultValue={nutritionistId ?? ""}
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
          <p className="mt-2 text-sm text-muted">
            Nutricionista actual:{" "}
            <span className="font-medium text-text">{nutritionistName ?? "Sin asignar"}</span>
          </p>
        )}
      </div>
    </div>
  );
}
