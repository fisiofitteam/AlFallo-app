import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, isManagerRole, optionLabel } from "@/lib/clients";
import {
  DAY_TYPES,
  MEAL_TYPE_OPTIONS,
  compareToTarget,
  dayTypeEmoji,
  fmtMacros,
  itemMacros,
  sumMacros,
  targetsForDayType,
  type Macros,
} from "@/lib/nutrition";
import { Select } from "@/components/form-ui";
import {
  addDay,
  addItem,
  addMeal,
  deleteDay,
  deleteItem,
  deleteMeal,
  deletePlan,
  setDayType,
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

// Estado visual del valor actual vs el objetivo (verde / ámbar / rojo).
function Comparable({
  label,
  actual,
  target,
  state,
  unit,
}: {
  label: string;
  actual: number;
  target: number | null;
  state: "low" | "ok" | "high" | "none";
  unit: string;
}) {
  if (target == null) return null;
  const color =
    state === "ok"
      ? "bg-[#e7f6ec] text-[#15803d]"
      : state === "high"
      ? "bg-[#fdecd9] text-[#b45309]"
      : "bg-[#fbe9f1] text-[#e6197e]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${color}`}>
      <span className="font-medium">{label}</span>
      <span>
        {Math.round(actual)}/{Math.round(target)}
        {unit}
      </span>
    </span>
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
          macroTargets: true,
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
          const targets = targetsForDayType(plan.client.macroTargets, day.dayType);
          const cmpKcal = compareToTarget(dayMacros.kcal, targets.kcal);
          const cmpP = compareToTarget(dayMacros.protein, targets.protein);
          const cmpC = compareToTarget(dayMacros.carbs, targets.carbs);
          const cmpF = compareToTarget(dayMacros.fat, targets.fat);
          return (
            <section key={day.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-xl">{dayTypeEmoji(day.dayType)}</span>
                  <h2 className="text-lg font-bold">{day.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* Selector de tipo de día */}
                  <form action={setDayType} className="flex items-center gap-1">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="dayId" value={day.id} />
                    <select
                      name="dayType"
                      defaultValue={day.dayType}
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
                    >
                      {DAY_TYPES.map((dt) => (
                        <option key={dt.value} value={dt.value}>
                          {dt.label}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text">
                      Guardar
                    </button>
                  </form>
                  <form action={deleteDay}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="dayId" value={day.id} />
                    <button className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              </div>

              {/* Macros del día + comparativa con objetivos (si están configurados) */}
              <div className="mb-3 space-y-1">
                <MacroBar m={dayMacros} />
                {plan.client.macroTargets && (targets.kcal || targets.protein || targets.carbs || targets.fat) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span className="font-medium text-text">Objetivo:</span>
                    <Comparable label="kcal" actual={dayMacros.kcal} target={targets.kcal} state={cmpKcal.state} unit="" />
                    <Comparable label="P" actual={dayMacros.protein} target={targets.protein} state={cmpP.state} unit="g" />
                    <Comparable label="C" actual={dayMacros.carbs} target={targets.carbs} state={cmpC.state} unit="g" />
                    <Comparable label="G" actual={dayMacros.fat} target={targets.fat} state={cmpF.state} unit="g" />
                  </div>
                )}
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
