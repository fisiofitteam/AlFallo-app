import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, isManagerRole, optionLabel } from "@/lib/clients";
import { MEAL_TYPE_OPTIONS, fmtMacros, itemMacros, sumMacros, type Macros } from "@/lib/nutrition";
import { Select } from "@/components/form-ui";
import {
  addDay,
  addItem,
  addMeal,
  deleteDay,
  deleteItem,
  deleteMeal,
  deletePlan,
} from "../actions";

function MacroBar({ m, label }: { m: Macros; label?: string }) {
  const f = fmtMacros(m);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {label && <span className="font-medium text-text">{label}</span>}
      <span className="font-semibold text-primary">{f.kcal} kcal</span>
      <span>P {f.protein} g</span>
      <span>C {f.carbs} g</span>
      <span>G {f.fat} g</span>
    </div>
  );
}

export default async function PlanBuilderPage({ params }: { params: { planId: string } }) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const plan = await prisma.nutritionPlan.findUnique({
    where: { id: params.planId },
    include: {
      client: {
        select: {
          id: true,
          fullName: true,
          nutritionistId: true,
          profile: {
            select: { allergies: true, intolerances: true, dislikes: true, dietaryStyle: true },
          },
        },
      },
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
  if (!plan) redirect("/clientes");
  if (!isManagerRole(prof.role) && plan.client.nutritionistId !== prof.id) redirect("/clientes");

  const foods = await prisma.foodLibrary.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const foodOptions = foods.map((f) => ({ value: f.id, label: f.name }));

  // Macros totales del plan = suma de todos los items.
  const planMacros = sumMacros(
    plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((it) => itemMacros(it)))),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/clientes/${plan.client.id}?tab=plan`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> {plan.client.fullName}
      </Link>

      <header className="mb-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{plan.name}</h1>
            {plan.goal && <p className="text-sm text-muted">{plan.goal}</p>}
          </div>
          <form action={deletePlan}>
            <input type="hidden" name="planId" value={plan.id} />
            <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-red-50 hover:text-red-600">
              <Trash2 size={15} /> Borrar plan
            </button>
          </form>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <MacroBar m={planMacros} label="Total del plan:" />
        </div>
      </header>

      {/* Restricciones del cliente a tener en cuenta */}
      {(() => {
        const p = plan.client.profile;
        const restrictions = [
          ...(p?.allergies ?? []).map((x) => `Alergia: ${x}`),
          ...(p?.intolerances ?? []).map((x) => `Intolerancia: ${x}`),
          ...(p?.dislikes ?? []).map((x) => `No quiere: ${x}`),
        ];
        if (restrictions.length === 0 && !p?.dietaryStyle) return null;
        return (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#f3c89a] bg-[#fdecd9] p-4 text-sm text-[#7c4a03]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Restricciones del cliente</p>
              <p className="mt-0.5">
                {p?.dietaryStyle && <span className="font-medium">Dieta {p.dietaryStyle}. </span>}
                {restrictions.length > 0 ? restrictions.join(" · ") : "Sin alergias ni vetos registrados."}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Días */}
      <div className="space-y-5">
        {plan.days.map((day) => {
          const dayMacros = sumMacros(day.meals.flatMap((m) => m.items.map((it) => itemMacros(it))));
          return (
            <section key={day.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{day.name}</h2>
                <form action={deleteDay}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="dayId" value={day.id} />
                  <button className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </form>
              </div>
              <div className="mb-3">
                <MacroBar m={dayMacros} />
              </div>

              {/* Comidas del día */}
              <div className="space-y-3">
                {day.meals.map((meal) => {
                  const mealMacros = sumMacros(meal.items.map((it) => itemMacros(it)));
                  return (
                    <div key={meal.id} className="rounded-xl border border-border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{optionLabel(MEAL_TYPE_OPTIONS, meal.name)}</p>
                          <MacroBar m={mealMacros} />
                        </div>
                        <form action={deleteMeal}>
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="mealId" value={meal.id} />
                          <button className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </div>

                      {/* Items */}
                      {meal.items.length > 0 && (
                        <ul className="mb-3 divide-y divide-border">
                          {meal.items.map((it) => {
                            const im = fmtMacros(itemMacros(it));
                            return (
                              <li key={it.id} className="flex items-center justify-between py-1.5 text-sm">
                                <span>
                                  {it.nameSnapshot}{" "}
                                  <span className="text-muted">· {it.quantityG} g</span>
                                </span>
                                <span className="flex items-center gap-3">
                                  <span className="text-xs text-muted">
                                    {im.kcal} kcal · P{im.protein} C{im.carbs} G{im.fat}
                                  </span>
                                  <form action={deleteItem}>
                                    <input type="hidden" name="planId" value={plan.id} />
                                    <input type="hidden" name="itemId" value={it.id} />
                                    <button className="text-muted hover:text-red-600">
                                      <Trash2 size={13} />
                                    </button>
                                  </form>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {/* Añadir alimento */}
                      {foodOptions.length === 0 ? (
                        <p className="text-xs text-muted">
                          Añade alimentos en la Biblioteca para poder usarlos aquí.
                        </p>
                      ) : (
                        <form action={addItem} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="mealId" value={meal.id} />
                          <div className="min-w-[160px] flex-1">
                            <Select name="foodId" options={foodOptions} placeholder="Alimento…" required />
                          </div>
                          <input
                            name="quantityG"
                            inputMode="decimal"
                            placeholder="gramos"
                            className="w-24 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
                          />
                          <button className="rounded-xl bg-primary-soft px-3 py-2.5 text-sm font-medium text-primary">
                            Añadir
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Añadir comida */}
              <form action={addMeal} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="dayId" value={day.id} />
                <div className="min-w-[160px]">
                  <Select name="name" options={MEAL_TYPE_OPTIONS} placeholder="Tipo de comida…" />
                </div>
                <button className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
                  <Plus size={15} /> Añadir comida
                </button>
              </form>
            </section>
          );
        })}
      </div>

      {/* Añadir día */}
      <form action={addDay} className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-border p-4">
        <input type="hidden" name="planId" value={plan.id} />
        <input
          name="name"
          placeholder="Nombre del día (ej. Día de entreno)"
          className="min-w-[200px] flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
          <Plus size={16} /> Añadir día
        </button>
      </form>
    </div>
  );
}
