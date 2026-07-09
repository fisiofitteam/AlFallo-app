import "server-only";
import { prisma } from "@/lib/prisma";

export const MARK_CATEGORIES = [
  { value: "fuerza", label: "Fuerza" },
  { value: "olimpico", label: "Olímpico" },
  { value: "gimnasia", label: "Gimnasia" },
  { value: "cardio", label: "Cardio / Metcon" },
  { value: "mixto", label: "Mixto" },
] as const;

export const MARK_UNITS = [
  { value: "kg", label: "kg", plural: "kilos" },
  { value: "reps", label: "reps", plural: "repeticiones" },
  { value: "s", label: "s", plural: "segundos" },
  { value: "m", label: "m", plural: "metros" },
  { value: "rondas", label: "rondas", plural: "rondas" },
  { value: "cal", label: "cal", plural: "calorías" },
] as const;

export type MarkUnit = (typeof MARK_UNITS)[number]["value"];
export type MarkCategory = (typeof MARK_CATEGORIES)[number]["value"];
export type MarkDirection = "up" | "down";

/** Catálogo semilla para el primer arranque. Se crea si al listar la tabla
 *  está vacía — un nutri lo puede editar/borrar/desactivar libremente.
 *  Cubre los benchmarks clásicos de CrossFit + Hyrox + fuerza base. */
const SEED_MARKS: {
  name: string;
  category: MarkCategory;
  unit: MarkUnit;
  direction: MarkDirection;
  description?: string;
}[] = [
  { name: "Sentadilla trasera 1RM", category: "fuerza", unit: "kg", direction: "up" },
  { name: "Sentadilla frontal 1RM", category: "fuerza", unit: "kg", direction: "up" },
  { name: "Peso muerto 1RM", category: "fuerza", unit: "kg", direction: "up" },
  { name: "Press banca 1RM", category: "fuerza", unit: "kg", direction: "up" },
  { name: "Press militar 1RM", category: "fuerza", unit: "kg", direction: "up" },
  { name: "Snatch 1RM", category: "olimpico", unit: "kg", direction: "up" },
  { name: "Clean 1RM", category: "olimpico", unit: "kg", direction: "up" },
  { name: "Clean & Jerk 1RM", category: "olimpico", unit: "kg", direction: "up" },
  { name: "Fran", category: "cardio", unit: "s", direction: "down", description: "21-15-9 thrusters + pull-ups" },
  { name: "Grace", category: "cardio", unit: "s", direction: "down", description: "30 clean & jerks 60/42.5 kg" },
  { name: "Row 500 m", category: "cardio", unit: "s", direction: "down" },
  { name: "Row 2000 m", category: "cardio", unit: "s", direction: "down" },
  { name: "SkiErg 1000 m", category: "cardio", unit: "s", direction: "down" },
  { name: "Assault Bike 1 min (cal)", category: "cardio", unit: "cal", direction: "up" },
  { name: "Dominadas estrictas max", category: "gimnasia", unit: "reps", direction: "up" },
  { name: "Muscle-ups (max continuas)", category: "gimnasia", unit: "reps", direction: "up" },
  { name: "Handstand walk máx", category: "gimnasia", unit: "m", direction: "up" },
];

/** Devuelve todas las marcas ordenadas. Si la tabla está vacía sembramos el
 *  catálogo por defecto — solo la primera vez. */
export async function listMarks(opts?: { includeInactive?: boolean }) {
  const count = await prisma.strengthMark.count();
  if (count === 0) {
    await prisma.strengthMark.createMany({
      data: SEED_MARKS.map((m, i) => ({
        name: m.name,
        category: m.category,
        unit: m.unit,
        direction: m.direction,
        description: m.description ?? null,
        order: i,
        active: true,
      })),
    });
  }
  return prisma.strengthMark.findMany({
    where: opts?.includeInactive ? undefined : { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

export function formatMarkValue(value: number, unit: string): string {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  if (unit === "s") {
    // Formato "m:ss" para tiempos ≥60s, si no en segundos.
    if (value >= 60) {
      const m = Math.floor(value / 60);
      const s = Math.round(value - m * 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    }
    return `${round1(value)} s`;
  }
  const u = MARK_UNITS.find((x) => x.value === unit);
  return `${round1(value)} ${u?.label ?? unit}`;
}

export function unitLabel(unit: string): string {
  return MARK_UNITS.find((x) => x.value === unit)?.label ?? unit;
}

export function categoryLabel(cat: string): string {
  return MARK_CATEGORIES.find((x) => x.value === cat)?.label ?? cat;
}
