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
import { Sparkles } from "lucide-react";
import {
  addDay,
  addItem,
  addItemFromText,
  addMeal,
  deleteDay,
  deleteItem,
  deleteMeal,
  deletePlan,
  generatePlanFromAI,
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

      {/* Plan vacío: hero para generar con IA */}
      {plan.days.length === 0 && (
        <section className="mb-5 rounded-2xl border border-primary bg-primary-soft p-6 text-center">
          <Sparkles className="mx-auto text-primary" size={28} />
          <h2 className="mt-2 text-lg font-bold text-primary">Tu plan está vacío</h2>
          <p className="mt-1 text-sm text-primary/80">
            Genera un borrador inicial con IA basado en el perfil y los objetivos del cliente.
            Después editas a mano todo lo que quieras.
          </p>
          <form action={generatePlanFromAI} className="mt-4 inline-block">
            <input type="hidden" name="planId" value={plan.id} />
            <button className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition hover:opacity-90">
              <Sparkles size={16} /> Generar borrador con IA
            </button>
          </form>
          <p className="mt-3 text-[11px] text-primary/70">
            Tarda ~10-20 segundos. Si no tienes <code className="font-mono">ANTHROPIC_API_KEY</code> configurada, se usa una plantilla genérica.
          </p>
        </section>
      )}

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
                                  {it.nameSnapshot}
                                  {it.foodId && (
                                    <span className="ml-1 text-muted">· {it.quantityG} g</span>
                                  )}
                                  {!it.foodId && (
                                    <span className="ml-1 text-[10px] uppercase tracking-wider text-primary">✨</span>
                                  )}
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

                      {/* Añadir alimento de la biblioteca */}
                      {foodOptions.length > 0 && (
                        <form action={addItem} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="mealId" value={meal.id} />
                          <div className="min-w-[160px] flex-1">
                            <Select name="foodId" options={foodOptions} placeholder="Alimento de biblioteca…" required />
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

                      {/* Añadir item con IA (texto libre) */}
                      <form action={addItemFromText} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="planId" value={plan.id} />
                        <input type="hidden" name="mealId" value={meal.id} />
                        <div className="min-w-[200px] flex-1">
                          <input
                            name="text"
                            placeholder="Ej. 200g pechuga de pollo + 100g arroz integral + ensalada"
                            required
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <button
                          className="flex items-center gap-1 rounded-xl border border-primary px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-soft"
                          title="La IA calcula los macros automáticamente"
                        >
                          ✨ Añadir con IA
                        </button>
                      </form>

                      {foodOptions.length === 0 && (
                        <p className="mt-2 text-xs text-muted">
                          También puedes añadir alimentos a la Biblioteca para reutilizarlos con cantidad exacta.
                        </p>
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
      <div className="mt-5 space-y-2 rounded-2xl border border-dashed border-border p-4">
        <form action={addDay} className="flex flex-wrap items-end gap-2">
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
        {plan.days.length > 0 && (
          <form action={generatePlanFromAI} className="flex justify-end">
            <input type="hidden" name="planId" value={plan.id} />
            <button
              className="flex items-center gap-1.5 rounded-xl border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary-soft"
              title="Añade más días generados con IA al plan actual"
            >
              <Sparkles size={13} /> Generar más días con IA
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
