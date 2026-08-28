import type { PlanBuilderDay, PlanBuilderMeal, PlanBuilderOption } from "@/components/PlanBuilder";

// Construye un menú semanal (L-D) rotando las opciones del primer día del
// plan. Las comidas "compuestas" (con subgrupos intro / grasas / carbos /
// proteína / postre) rotan DENTRO de cada subgrupo. Las comidas simples
// (desayuno, media_mañana, merienda...) tienen opciones planas y rotamos
// sobre la lista entera.
//
// Reglas importantes:
//  - "Compuesta" se detecta por DATOS (alguna opción tiene subType), NO por
//    el nombre — el nutri puede renombrar libremente la comida y no debemos
//    perder los subgrupos por eso.
//  - En "carbos" separamos por dayContext (entreno / descanso) y mostramos
//    ambas líneas cuando ambas existen, para que el atleta sepa qué comer
//    según sea día de entreno o descanso.
//  - Ignoramos opciones sin texto: son huecos que el nutri aún no ha
//    rellenado y aparecerían como "—" en el semanal.

export type WeekMenuItem = {
  text: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  subType: string | null;
  // Etiqueta legible del contexto de día ("Día entreno" / "Día descanso") —
  // solo se rellena en el subgrupo "carbos" cuando conviven ambas opciones.
  dayContextLabel: string | null;
  note: string | null;
};

export type WeekMenuMeal = {
  name: string;
  items: WeekMenuItem[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
};

export type WeekMenuDay = {
  weekdayIso: number; // 1=Lunes ... 7=Domingo
  label: string;
  short: string;
  meals: WeekMenuMeal[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
};

const WEEKDAY_LABELS: { iso: number; label: string; short: string }[] = [
  { iso: 1, label: "Lunes", short: "Lun" },
  { iso: 2, label: "Martes", short: "Mar" },
  { iso: 3, label: "Miércoles", short: "Mié" },
  { iso: 4, label: "Jueves", short: "Jue" },
  { iso: 5, label: "Viernes", short: "Vie" },
  { iso: 6, label: "Sábado", short: "Sáb" },
  { iso: 7, label: "Domingo", short: "Dom" },
];

const SUB_ORDER = ["intro", "grasas", "carbos", "proteina", "postre"];

function isComposedMeal(meal: PlanBuilderMeal): boolean {
  return meal.options.some((o) => o.subType !== null);
}

function hasText(option: PlanBuilderOption): boolean {
  return !!option.text && option.text.trim().length > 0;
}

function toItem(
  option: PlanBuilderOption,
  dayContextLabel: string | null = null,
): WeekMenuItem {
  return {
    text: option.text,
    kcal: option.kcal,
    protein: option.protein,
    carbs: option.carbs,
    fat: option.fat,
    subType: option.subType,
    dayContextLabel,
    note: option.note,
  };
}

function macrosOf(items: WeekMenuItem[]) {
  return items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + it.kcal,
      protein: acc.protein + it.protein,
      carbs: acc.carbs + it.carbs,
      fat: acc.fat + it.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Empuja la opción de carbos correspondiente al día. Si el nutri ha creado
// opciones separadas para día de entreno y día de descanso, mostramos AMBAS
// líneas etiquetadas para que el atleta elija según su día. Rotamos dentro
// de cada contexto para que no se repita el mismo carbo toda la semana.
function pushCarbs(
  items: WeekMenuItem[],
  meal: PlanBuilderMeal,
  dayIdx: number,
): void {
  const all = meal.options.filter((o) => o.subType === "carbos" && hasText(o));
  if (all.length === 0) return;

  const training = all.filter((o) => (o.dayContext ?? null) === "training");
  const rest = all.filter((o) => (o.dayContext ?? null) === "rest");
  const untagged = all.filter((o) => o.dayContext == null);

  const hasCtx = training.length > 0 || rest.length > 0;
  if (!hasCtx) {
    // Sin contexto: rotación clásica dentro de todas las carbos.
    items.push(toItem(all[dayIdx % all.length]));
    return;
  }

  // Si un contexto no tiene opciones propias, caemos a las untagged, y en
  // último caso al otro contexto — así el día nunca se queda vacío.
  const trainPool = training.length > 0 ? training : untagged.length > 0 ? untagged : rest;
  const restPool = rest.length > 0 ? rest : untagged.length > 0 ? untagged : training;

  if (trainPool.length > 0) {
    items.push(toItem(trainPool[dayIdx % trainPool.length], "Día entreno"));
  }
  if (restPool.length > 0 && restPool !== trainPool) {
    items.push(toItem(restPool[dayIdx % restPool.length], "Día descanso"));
  }
}

export function buildWeeklyMenu(planDays: PlanBuilderDay[]): WeekMenuDay[] {
  const pool = planDays[0];
  if (!pool) return [];

  return WEEKDAY_LABELS.map(({ iso, label, short }, dayIdx) => {
    const meals: WeekMenuMeal[] = pool.meals.map((meal) => {
      const composed = isComposedMeal(meal);
      const items: WeekMenuItem[] = [];
      if (composed) {
        for (const sub of SUB_ORDER) {
          if (sub === "carbos") {
            pushCarbs(items, meal, dayIdx);
            continue;
          }
          const opts = meal.options.filter((o) => o.subType === sub && hasText(o));
          if (opts.length === 0) continue;
          items.push(toItem(opts[dayIdx % opts.length]));
        }
      } else {
        const opts = meal.options.filter(hasText);
        if (opts.length > 0) {
          items.push(toItem(opts[dayIdx % opts.length]));
        }
      }
      return { name: meal.name, items, totals: macrosOf(items) };
    });
    const dayItems = meals.flatMap((m) => m.items);
    return { weekdayIso: iso, label, short, meals, totals: macrosOf(dayItems) };
  });
}
