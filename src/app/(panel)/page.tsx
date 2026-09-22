import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, UserCheck, Clock, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager, navForRole } from "@/lib/roles";
import { CLIENT_ACCESS_ROLES, clientScopeWhere } from "@/lib/clients";
import { WeeklyTasksCard, type WeeklyTaskItem } from "@/components/WeeklyTasksCard";
import { OneOffTasksCard, type OneOffCardItem } from "@/components/OneOffTasksCard";
import { weekStartFor } from "@/lib/weekly-tasks";
import { activeInstanceFor, shortDueLabel, todayInMadrid } from "@/lib/oneoff-tasks";
import { PanelTabs, type PanelTab } from "@/components/panel/PanelTabs";
import { TabMetricasEquipo } from "@/components/panel/TabMetricasEquipo";
import { TabPlaceholder } from "@/components/panel/TabPlaceholder";
import type { PeriodPreset } from "@/lib/teamMetrics";

const TAB_ALIASES: Record<string, PanelTab> = {
  "metricas-equipo": "metricas",
  "metricas-programa": "metricas",
};

export const metadata = { title: "Panel · Al Fallo Nutrition" };
export const dynamic = "force-dynamic";

// Roles que ven y marcan su checklist semanal en el panel principal. El CEO
// no aparece aquí porque no tiene tareas operativas: las gestiona desde /tareas.
const WEEKLY_TASKS_VIEWERS = ["nutricionista", "head_coach"];

const VALID_TABS = new Set<PanelTab>(["tareas", "metricas", "ventas"]);
const VALID_PERIODS = new Set<PeriodPreset>(["mensual", "trimestral", "anual", "custom"]);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { tab?: string; period?: string };
}) {
  const prof = await requireProfessional();
  // Marketing solo tiene acceso a Contenido: es su pantalla de aterrizaje.
  if (prof.role === "marketing") redirect("/contenido");
  const firstName = prof.fullName.split(" ")[0];

  const rawTab = searchParams?.tab;
  const aliased = rawTab ? TAB_ALIASES[rawTab] : undefined;
  const tab: PanelTab =
    aliased ??
    (rawTab && VALID_TABS.has(rawTab as PanelTab) ? (rawTab as PanelTab) : "tareas");
  const rawPeriod = searchParams?.period;
  const period: PeriodPreset =
    rawPeriod && VALID_PERIODS.has(rawPeriod as PeriodPreset) ? (rawPeriod as PeriodPreset) : "mensual";

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold md:text-3xl">Panel de {firstName}</h1>
        <p className="mt-1 text-muted">
          Panel de gestión de Al Fallo Nutrition
          {isManager(prof.role) && " · acceso completo como manager"}
        </p>
      </header>

      <PanelTabs active={tab} />

      {tab === "tareas" ? <TareasTabContent prof={prof} /> : null}
      {tab === "metricas" ? <TabMetricasEquipo period={period} /> : null}
      {tab === "ventas" ? (
        <TabPlaceholder
          title="Ventas"
          hint="Renovaciones, tasas y facturación del equipo. En construcción."
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Tareas: contenido original del dashboard (tareas + stats + accesos).
// ---------------------------------------------------------------------------

async function TareasTabContent({
  prof,
}: {
  prof: Awaited<ReturnType<typeof requireProfessional>>;
}) {
  const shortcuts = navForRole(prof.role).filter((i) => i.href !== "/");

  const showTasksCard = WEEKLY_TASKS_VIEWERS.includes(prof.role);
  const weekStart = weekStartFor();
  let weeklyTasks: WeeklyTaskItem[] = [];
  if (showTasksCard) {
    const templates = await prisma.weeklyTaskTemplate.findMany({
      where: {
        active: true,
        targetRole: prof.role,
        OR: [{ assigneeId: null }, { assigneeId: prof.id }],
      },
      orderBy: [{ dayOfWeek: "asc" }, { order: "asc" }],
      include: {
        completions: { where: { professionalId: prof.id, weekStart }, select: { id: true } },
      },
    });
    weeklyTasks = templates.map((t) => ({
      id: t.id,
      title: t.title,
      dayOfWeek: t.dayOfWeek,
      order: t.order,
      done: t.completions.length > 0,
    }));
  }

  let oneOffItems: OneOffCardItem[] = [];
  if (showTasksCard) {
    const today = todayInMadrid();
    const oneOffs = await prisma.oneOffTaskTemplate.findMany({
      where: {
        active: true,
        targetRole: prof.role,
        OR: [{ assigneeId: null }, { assigneeId: prof.id }],
      },
      orderBy: { createdAt: "desc" },
    });
    const instances = oneOffs
      .map((t) => ({ t, instance: activeInstanceFor(t, today) }))
      .filter((x): x is { t: typeof x.t; instance: Date } => x.instance !== null);

    if (instances.length > 0) {
      const completions = await prisma.oneOffTaskCompletion.findMany({
        where: {
          professionalId: prof.id,
          templateId: { in: instances.map((x) => x.t.id) },
        },
        select: { templateId: true, instanceDate: true },
      });
      const doneKey = new Set(
        completions.map((c) => `${c.templateId}:${c.instanceDate.getTime()}`),
      );

      oneOffItems = instances
        .filter((x) => !doneKey.has(`${x.t.id}:${x.instance.getTime()}`))
        .map((x) => ({
          id: x.t.id,
          title: x.t.title,
          due: shortDueLabel(x.t),
        }));
    }
  }

  const canSeeClients = CLIENT_ACCESS_ROLES.includes(prof.role);
  const scope = canSeeClients ? clientScopeWhere(prof) : null;
  const [total, pendientes, activos] = scope
    ? await Promise.all([
        prisma.client.count({ where: scope }),
        prisma.client.count({ where: { ...scope, status: { in: ["pendiente_revision", "onboarding"] } } }),
        prisma.client.count({ where: { ...scope, status: "activo" } }),
      ])
    : [0, 0, 0];

  const STATS = [
    { label: "Total clientes", value: total, icon: Users, cardClass: "bg-[#fbe9f1]", numClass: "text-[#e6197e]" },
    { label: "Pendientes", value: pendientes, icon: Clock, cardClass: "bg-[#fdecd9]", numClass: "text-[#e07b1a]" },
    { label: "Activos", value: activos, icon: UserCheck, cardClass: "bg-[#e7f6ec]", numClass: "text-[#1fa971]" },
  ];

  return (
    <>
      {showTasksCard && <WeeklyTasksCard tasks={weeklyTasks} />}
      {showTasksCard && <OneOffTasksCard items={oneOffItems} />}

      {canSeeClients && (
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-2xl p-5 ${s.cardClass}`}>
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Icon size={16} />
                  {s.label}
                </div>
                <p className={`mt-2 text-3xl font-bold ${s.numClass}`}>{s.value}</p>
              </div>
            );
          })}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            const active = !!item.description;
            const className =
              "group rounded-2xl border border-border bg-surface p-5 transition hover:border-primary";
            const content = (
              <>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon size={20} />
                </div>
                <p className="flex items-center gap-1 font-semibold">
                  {item.label}
                  {active ? (
                    <ArrowRight
                      size={15}
                      className="text-primary opacity-0 transition group-hover:opacity-100"
                    />
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {item.description ?? "Próximamente en su fase del roadmap."}
                </p>
              </>
            );
            return active ? (
              <Link key={item.href} href={item.href} className={className}>
                {content}
              </Link>
            ) : (
              <div key={item.href} className={`${className} opacity-70`}>
                {content}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
