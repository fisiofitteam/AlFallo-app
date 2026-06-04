import { CalendarDays } from "lucide-react";
import type { WeekMenuDay } from "@/lib/weeklyMenu";
import { MEAL_TYPE_OPTIONS } from "@/lib/nutrition";
import { optionLabel } from "@/lib/clients";

// Vista del plan semanal — un día por sección, cada día con sus comidas y los
// alimentos que tocan ese día. Componente server-side, usado tanto en la
// ficha del cliente del panel como en la app del atleta.

const SUB_LABELS: Record<string, string> = {
  intro: "Intro",
  grasas: "Grasas",
  carbos: "Carbos",
  proteina: "Proteína",
  postre: "Postre",
};

function mealEmoji(value: string): string {
  switch (value) {
    case "desayuno": return "🌅";
    case "media_manana": return "🍎";
    case "pre_wod": return "💪";
    case "post_wod": return "🥤";
    case "comida": return "🍽";
    case "merienda": return "🥨";
    case "cena": return "🌙";
    case "snack": return "🍫";
    default: return "🍴";
  }
}

function fmtMacros(m: { kcal: number; protein: number; carbs: number; fat: number }): string {
  return `${Math.round(m.kcal)} kcal · P ${Math.round(m.protein)} · C ${Math.round(m.carbs)} · G ${Math.round(m.fat)}`;
}

export function WeeklyMenuView({
  days,
  variant = "panel",
}: {
  days: WeekMenuDay[];
  /** 'panel' (claro, ficha cliente) | 'cliente' (oscuro, app del atleta). */
  variant?: "panel" | "cliente";
}) {
  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
        <CalendarDays size={28} className="mx-auto text-muted" />
        <p className="mt-2 font-medium">No hay nada que mostrar</p>
        <p className="mt-1 text-sm text-muted">
          Genera el plan con HB o IA para poder ver su versión semanal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        El menú rota las opciones del plan a lo largo de la semana: cada día le aparece al atleta una
        de las opciones de cada comida (y, en comida y cena, una de cada subgrupo).
      </p>
      {days.map((day) => (
        <section
          key={day.weekdayIso}
          className={`overflow-hidden rounded-2xl border ${
            variant === "cliente" ? "border-border bg-surface" : "border-border bg-surface"
          }`}
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
            <h3 className="text-base font-bold">{day.label}</h3>
            <p className="text-xs text-muted">{fmtMacros(day.totals)}</p>
          </header>
          <div className="divide-y divide-border">
            {day.meals.map((meal, mIdx) => (
              <div key={`${meal.name}-${mIdx}`} className="px-5 py-3">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    <span className="mr-1">{mealEmoji(meal.name)}</span>
                    {optionLabel(MEAL_TYPE_OPTIONS, meal.name)}
                  </p>
                  <p className="text-[11px] text-muted">{fmtMacros(meal.totals)}</p>
                </div>
                {meal.items.length === 0 ? (
                  <p className="text-xs italic text-muted/70">Sin opciones definidas para esta comida.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {meal.items.map((it, iIdx) => (
                      <li key={iIdx} className="flex items-start gap-2">
                        {it.subType ? (
                          <span className="mt-0.5 inline-block rounded bg-primary-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                            {SUB_LABELS[it.subType] ?? it.subType}
                          </span>
                        ) : null}
                        <span className="flex-1 leading-snug">{it.text || "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {day.meals.length === 0 ? (
              <p className="px-5 py-3 text-xs italic text-muted">Día sin comidas.</p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
