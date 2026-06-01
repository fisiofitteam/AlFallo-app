import { UtensilsCrossed } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { optionLabel } from "@/lib/clients";
import { MEAL_TYPE_OPTIONS, fmtMacros, itemMacros, sumMacros, type Macros } from "@/lib/nutrition";

export const metadata = { title: "Mi plan · Al Fallo" };

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

export default async function ClientPlanPage() {
  const me = await requireOnboardedClient();

  const plan = await prisma.nutritionPlan.findFirst({
    where: { clientId: me.id },
    orderBy: { createdAt: "desc" },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { meals: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } } },
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

  // El cliente solo ve los items "elegidos" (los alternativos quedan ocultos).
  const selItem = (it: { selected: boolean }) => it.selected !== false;

  const planMacros = sumMacros(
    plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.filter(selItem).map((it) => itemMacros(it)))),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">{plan.name}</h1>
      {plan.goal && <p className="text-muted">{plan.goal}</p>}
      <div className="mt-2">
        <MacroLine m={planMacros} big />
      </div>
      {plan.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{plan.notes}</p>}

      <div className="mt-5 space-y-4">
        {plan.days.map((day) => {
          const dayMacros = sumMacros(
            day.meals.flatMap((m) => m.items.filter(selItem).map((it) => itemMacros(it))),
          );
          return (
            <section key={day.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">{day.name}</h2>
                <MacroLine m={dayMacros} />
              </div>
              <div className="space-y-3">
                {day.meals.map((meal) => {
                  const visibleItems = meal.items.filter(selItem);
                  const mealMacros = sumMacros(visibleItems.map((it) => itemMacros(it)));
                  return (
                    <div key={meal.id} className="rounded-xl bg-surface-2 p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="font-semibold">{optionLabel(MEAL_TYPE_OPTIONS, meal.name)}</p>
                        <MacroLine m={mealMacros} />
                      </div>
                      <ul className="space-y-1 text-sm">
                        {visibleItems.map((it) => (
                          <li key={it.id} className="flex justify-between gap-2">
                            <span className="min-w-0">
                              {it.subType && (
                                <span className="mr-1.5 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                  {it.subType === "intro" ? "Intro" : it.subType === "grasas" ? "Grasas" : it.subType === "carbos" ? "Carbos" : it.subType === "proteina" ? "Proteína" : it.subType === "postre" ? "Postre" : "Otro"}
                                </span>
                              )}
                              {it.nameSnapshot}
                            </span>
                            {it.foodId && <span className="shrink-0 text-muted">{it.quantityG} g</span>}
                          </li>
                        ))}
                        {visibleItems.length === 0 && <li className="text-xs text-muted">Sin alimentos</li>}
                      </ul>
                    </div>
                  );
                })}
                {day.meals.length === 0 && <p className="text-sm text-muted">Sin comidas.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
