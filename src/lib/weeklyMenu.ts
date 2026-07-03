import type { PlanBuilderDay, PlanBuilderOption } from "@/components/PlanBuilder";

// Construye un menú semanal (L-D) rotando las opciones del primer día del
// plan. Las comidas "comida" y "cena" llevan subgrupos (intro / grasas /
// carbos / proteína / postre) y se rota DENTRO de cada subgrupo. Las otras
// comidas (desayuno, media_mañana, merienda) tienen opciones planas y
// rotamos sobre la lista entera.
//
// v1: usamos el PRIMER PlanDay como "pool". Si en el futuro queremos
// alternar entreno/descanso por día de la semana, se hace aquí.

export type WeekMenuItem = {
  text: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  subType: string | null;
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

const COMPOSED_MEALS = ["comida", "cena"];
const SUB_ORDER = ["intro", "grasas", "carbos", "proteina", "postre"];

function toItem(option: PlanBuilderOption): WeekMenuItem {
  return {
    text: option.text,
    kcal: option.kcal,
    protein: option.protein,
    carbs: option.carbs,
    fat: option.fat,
    subType: option.subType,
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

export function buildWeeklyMenu(planDays: PlanBuilderDay[]): WeekMenuDay[] {
  const pool = planDays[0];
  if (!pool) return [];

  return WEEKDAY_LABELS.map(({ iso, label, short }, dayIdx) => {
    const meals: WeekMenuMeal[] = pool.meals.map((meal) => {
      const composed = COMPOSED_MEALS.includes(meal.name);
      const items: WeekMenuItem[] = [];
      if (composed) {
        for (const sub of SUB_ORDER) {
          const opts = meal.options.filter((o) => o.subType === sub);
          if (opts.length === 0) continue;
          items.push(toItem(opts[dayIdx % opts.length]));
        }
      } else if (meal.options.length > 0) {
        items.push(toItem(meal.options[dayIdx % meal.options.length]));
      }
      return { name: meal.name, items, totals: macrosOf(items) };
    });
    const dayItems = meals.flatMap((m) => m.items);
    return { weekdayIso: iso, label, short, meals, totals: macrosOf(dayItems) };
  });
}
