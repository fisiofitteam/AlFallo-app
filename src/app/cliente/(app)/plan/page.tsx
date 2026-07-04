import Link from "next/link";
import { ArrowLeft, UtensilsCrossed, LayoutList, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { optionLabel } from "@/lib/clients";
import { MEAL_TYPE_OPTIONS, fmtMacros, itemMacros, sumMacros, type Macros } from "@/lib/nutrition";
import { loadPlanForBuilder } from "@/lib/loadPlanData";
import { buildWeeklyMenu } from "@/lib/weeklyMenu";
import { WeeklyMenuView } from "@/components/WeeklyMenuView";
import { PlanCards } from "@/components/PlanCards";
import { getPlanCardsForClient } from "@/lib/planSummary";

export const metadata = { title: "Mi plan · Al Fallo" };
export const dynamic = "force-dynamic";

type ViewMode = "completo" | "semanal";

function MacroLine({ m, big = false }: { m: Macros; big?: boolean }) {
  const f = fmtMacros(m);
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${big ? "text-sm" : "text-xs"} text-muted`}>
      <span className="font-semibold text-primary">{f.kcal} kcal</span>
      <span>P {f.protein}</span>
      <span>C {f.carbs}</span>
      <span>G {f.fat}</span>
    </div>
  );
}

const SUB_LABEL: Record<string, string> = {
  intro: "Intro",
  grasas: "Grasas",
  carbos: "Carbos",
  proteina: "Proteína",
  postre: "Postre",
};

export default async function ClientPlanPage({
  searchParams,
}: {
  searchParams: { view?: string; id?: string };
}) {
  const me = await requireOnboardedClient();

  // Sin ?id → galería con todos los planes del cliente.
  if (!searchParams.id) {
    const cards = await getPlanCardsForClient(me.id);
    if (cards.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <UtensilsCrossed className="text-muted" size={32} />
          <p className="mt-3 font-medium">Aún no tienes un plan</p>
          <p className="mt-1 text-sm text-muted">Tu nutricionista lo preparará pronto.</p>
        </div>
      );
    }
    return (
      <div>
        <h1 className="text-2xl font-bold">Mi plan</h1>
        <p className="mt-1 text-muted">
          {cards.length === 1
            ? "Tu plan nutricional. Pulsa para abrirlo."
            : `Tienes ${cards.length} planes. Pulsa el que toque hoy.`}
        </p>
        <div className="mt-5">
          <PlanCards mode="cliente" clientId={me.id} plans={cards} />
        </div>
      </div>
    );
  }

  // Con ?id → vista detalle de ese plan en concreto.
  const plan = await prisma.nutritionPlan.findFirst({
    where: { id: searchParams.id, clientId: me.id },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: {
          meals: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  // Tracking del último plan REGULAR abierto por el cliente: lo usa /cliente/compra
  // para decidir de qué plan sacar las cantidades cuando hay varios. Usamos
  // updateMany con NOT-equal para no escribir si ya está marcado y no inflar
  // updatedAt sin motivo.
  if (plan && plan.kind !== "competition") {
    await prisma.client.updateMany({
      where: { id: me.id, NOT: { lastViewedPlanId: plan.id } },
      data: { lastViewedPlanId: plan.id },
    });
  }

  if (!plan) {
    // Plan inexistente o de otro cliente — volvemos a la galería.
    return (
      <div>
        <Link
          href="/cliente/plan"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
        >
          <ArrowLeft size={14} /> Mis planes
        </Link>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <UtensilsCrossed className="text-muted" size={32} />
          <p className="mt-3 font-medium">Este plan ya no existe</p>
          <p className="mt-1 text-sm text-muted">Vuelve a tu lista de planes.</p>
        </div>
      </div>
    );
  }

  const view: ViewMode = searchParams.view === "semanal" ? "semanal" : "completo";

  // El atleta NO ve los items con selected=false en la vista completa: esos
  // los marca el nutri como "no recomendar". Pero sí ve TODAS las opciones
  // de cada subgrupo en comida/cena para poder elegir.
  // Para mantener la semántica anterior: solo ocultamos los explícitamente
  // marcados como selected=false que tengan hermanos del mismo subType
  // marcados como selected=true (caso de comidas planas donde el nutri
  // marca su "favorita"). En general, mostramos TODAS las opciones que
  // existan, así el atleta tiene flexibilidad para combinar.
  type Item = {
    id: string;
    nameSnapshot: string;
    quantityG: number;
    foodId: string | null;
    selected: boolean;
    subType: string | null;
    dayContext: string | null;
    note: string | null;
    kcalPer100: number;
    proteinPer100: number;
    carbsPer100: number;
    fatPer100: number;
  };
  const allItems = (items: Item[]) => items;

  const planMacros = sumMacros(
    plan.days.flatMap((d) =>
      d.meals.flatMap((m) => m.items.filter((i) => i.selected).map((it) => itemMacros(it))),
    ),
  );

  return (
    <div>
      <Link
        href="/cliente/plan"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> Mis planes
      </Link>
      <h1 className="text-2xl font-bold">{plan.name}</h1>
      {plan.description ? (
        <p className="mt-1 text-sm text-muted">{plan.description}</p>
      ) : null}
      <div className="mt-2">
        <MacroLine m={planMacros} big />
      </div>
      {/* Tabs Completo / Semanal */}
      <nav className="mt-5 flex gap-1 rounded-xl border border-border bg-surface p-1">
        <ViewTab
          href={`/cliente/plan?id=${plan.id}&view=completo`}
          active={view === "completo"}
          icon={<LayoutList size={14} />}
        >
          Plan completo
        </ViewTab>
        <ViewTab
          href={`/cliente/plan?id=${plan.id}&view=semanal`}
          active={view === "semanal"}
          icon={<CalendarDays size={14} />}
        >
          Plan semanal
        </ViewTab>
      </nav>

      <div className="mt-5">
        {view === "semanal" ? (
          <WeeklyMenuView
            variant="cliente"
            days={buildWeeklyMenu(
              (await loadPlanForBuilder(plan.id))?.days ?? [],
            )}
          />
        ) : (
          <div className="space-y-4">
            {plan.days.map((day) => {
              const dayMacros = sumMacros(
                day.meals.flatMap((m) => m.items.filter((i) => i.selected).map((it) => itemMacros(it))),
              );
              return (
                <section key={day.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-bold">{day.name}</h2>
                    <MacroLine m={dayMacros} />
                  </div>
                  <div className="space-y-3">
                    {day.meals.map((meal) => {
                      const items = allItems(meal.items);
                      // Comida "compuesta" (con subgrupos Intro/Grasas/Carbos/
                      // Proteína/Postre) → la detectamos por DATOS, no por el
                      // nombre. En plantillas de competición el nutri puede
                      // poner "WOD 1: …" o "Comida" indistintamente; lo que
                      // manda es si las opciones tienen subType.
                      const composed = items.some((it) => it.subType !== null);
                      const subGroups = composed
                        ? ["intro", "grasas", "carbos", "proteina", "postre"]
                        : [null];
                      return (
                        <div key={meal.id} className="rounded-xl bg-surface-2 p-3">
                          <p className="mb-2 font-semibold">{optionLabel(MEAL_TYPE_OPTIONS, meal.name)}</p>
                          {subGroups.map((sub) => {
                            const list = items.filter((it) =>
                              composed ? it.subType === sub : true,
                            );
                            if (list.length === 0) return null;
                            // Renderer de una lista de opciones (reutilizado
                            // para plana y para las sub-secciones de carbos).
                            const renderList = (opts: Item[]) => (
                              <ul className="space-y-1 text-sm">
                                {opts.map((it, idx) => (
                                  <li
                                    key={it.id}
                                    className="rounded-md bg-surface p-2 leading-snug"
                                  >
                                    <span className="text-[10px] font-semibold text-primary">
                                      Opción {idx + 1}
                                    </span>
                                    <span className="ml-2">{it.nameSnapshot || "—"}</span>
                                    {it.note ? (
                                      <p className="mt-1 whitespace-pre-line border-l-2 border-primary/40 pl-2 text-xs italic text-muted">
                                        {it.note}
                                      </p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            );
                            // Carbos: dividimos en día entreno / día
                            // descanso si alguna opción tiene dayContext.
                            const isCarbs = composed && sub === "carbos";
                            const hasCtx =
                              isCarbs && list.some((it) => it.dayContext != null);
                            return (
                              <div key={sub ?? "_flat"} className="mb-3 last:mb-0">
                                {composed && sub ? (
                                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                                    {SUB_LABEL[sub]}
                                  </p>
                                ) : null}
                                {hasCtx ? (
                                  <div className="space-y-2">
                                    {(["training", "rest"] as const).map((ctx) => {
                                      const ctxList = list.filter(
                                        (it) => (it.dayContext ?? null) === ctx,
                                      );
                                      if (ctxList.length === 0) return null;
                                      return (
                                        <div key={ctx}>
                                          <p className="mb-1 text-[10px] font-semibold text-primary/80">
                                            {ctx === "training"
                                              ? "Día de entrenamiento"
                                              : "Día de descanso / recovery"}
                                          </p>
                                          {renderList(ctxList)}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  renderList(list)
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    {day.meals.length === 0 && <p className="text-sm text-muted">Sin comidas.</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Observaciones y suplementación al final del plan. */}
      {(plan.notes || plan.supplementation) ? (
        <div className="mt-6 space-y-4">
          {plan.notes ? (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                Observaciones
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{plan.notes}</p>
            </section>
          ) : null}
          {plan.supplementation ? (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
                Suplementación
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{plan.supplementation}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ViewTab({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-primary-fg" : "text-muted hover:text-text"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
