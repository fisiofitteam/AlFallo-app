import Link from "next/link";
import { UtensilsCrossed, LayoutList, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { optionLabel } from "@/lib/clients";
import { MEAL_TYPE_OPTIONS, fmtMacros, itemMacros, sumMacros, type Macros } from "@/lib/nutrition";
import { loadPlanForBuilder } from "@/lib/loadPlanData";
import { buildWeeklyMenu } from "@/lib/weeklyMenu";
import { WeeklyMenuView } from "@/components/WeeklyMenuView";

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
  searchParams: { view?: string };
}) {
  const me = await requireOnboardedClient();

  const plan = await prisma.nutritionPlan.findFirst({
    where: { clientId: me.id },
    orderBy: { createdAt: "desc" },
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

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
        <UtensilsCrossed className="text-muted" size={32} />
        <p className="mt-3 font-medium">Aún no tienes un plan</p>
        <p className="mt-1 text-sm text-muted">Tu nutricionista lo preparará pronto.</p>
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
      <h1 className="text-2xl font-bold">{plan.name}</h1>
      {plan.goal && <p className="text-muted">{plan.goal}</p>}
      <div className="mt-2">
        <MacroLine m={planMacros} big />
      </div>
      {plan.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{plan.notes}</p>}

      {/* Tabs Completo / Semanal */}
      <nav className="mt-5 flex gap-1 rounded-xl border border-border bg-surface p-1">
        <ViewTab href={`/cliente/plan?view=completo`} active={view === "completo"} icon={<LayoutList size={14} />}>
          Plan completo
        </ViewTab>
        <ViewTab href={`/cliente/plan?view=semanal`} active={view === "semanal"} icon={<CalendarDays size={14} />}>
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
                      // Agrupamos por subType para que en comida/cena se vean los
                      // 5 bloques (Intro / Grasas / Carbos / Proteína / Postre).
                      const composed = meal.name === "comida" || meal.name === "cena";
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
                            return (
                              <div key={sub ?? "_flat"} className="mb-3 last:mb-0">
                                {composed && sub ? (
                                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                                    {SUB_LABEL[sub]}
                                  </p>
                                ) : null}
                                <ul className="space-y-1 text-sm">
                                  {list.map((it, idx) => (
                                    <li
                                      key={it.id}
                                      className="rounded-md bg-surface p-2 leading-snug"
                                    >
                                      <span className="text-[10px] font-semibold text-primary">
                                        Opción {idx + 1}
                                      </span>
                                      <span className="ml-2">{it.nameSnapshot || "—"}</span>
                                    </li>
                                  ))}
                                </ul>
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
