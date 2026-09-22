import { prisma } from "@/lib/prisma";

export type ObjectiveKind = "quarter" | "month" | "week" | "day";

export type QuarterContent = {
  theme: string;
  marketing: string;
  ventas: string;
  servicio: string;
  ceo: string;
};

export type MonthContent = { focus: string };

export type ObjectiveItem = { id: string; text: string; done: boolean };
export type WeekContent = { items: ObjectiveItem[] };
export type DayContent = { items: ObjectiveItem[] };

export const MAX_WEEK_ITEMS = 3;
export const MAX_DAY_ITEMS = 3;

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Devuelve el número de semana ISO 8601 y el año ISO al que pertenece. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function quarterKey(now = new Date()): string {
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
}

export function monthKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function weekKey(now = new Date()): string {
  const { year, week } = isoWeek(now);
  return `${year}-W${pad(week)}`;
}

export function dayKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function quarterLabel(now = new Date()): { title: string; range: string } {
  const q = Math.floor(now.getMonth() / 3) + 1;
  const startMonth = (q - 1) * 3;
  const endMonth = startMonth + 2;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1, 3);
  return {
    title: `${["1er", "2º", "3er", "4º"][q - 1]} Trimestre ${now.getFullYear()}`,
    range: `${cap(MONTH_NAMES_ES[startMonth])}-${cap(MONTH_NAMES_ES[endMonth])}`,
  };
}

export function monthLabel(now = new Date()): string {
  return `${MONTH_NAMES_ES[now.getMonth()]} de ${now.getFullYear()}`;
}

export function weekLabel(now = new Date()): string {
  const { year, week } = isoWeek(now);
  return `Semana ISO ${week}/${year}`;
}

export function dayLabel(now = new Date()): string {
  return now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

/** Estructuras por defecto — se usan cuando aún no hay fila guardada. */
export function emptyContent(kind: "quarter"): QuarterContent;
export function emptyContent(kind: "month"): MonthContent;
export function emptyContent(kind: "week"): WeekContent;
export function emptyContent(kind: "day"): DayContent;
export function emptyContent(kind: ObjectiveKind): unknown {
  if (kind === "quarter") return { theme: "", marketing: "", ventas: "", servicio: "", ceo: "" };
  if (kind === "month") return { focus: "" };
  if (kind === "week") return { items: [] };
  return { items: [] };
}

/** Lee el objetivo del profesional para el kind+periodKey dado. */
export async function readObjective<K extends ObjectiveKind>(
  professionalId: string,
  kind: K,
  periodKey: string,
): Promise<K extends "quarter" ? QuarterContent : K extends "month" ? MonthContent : K extends "week" ? WeekContent : DayContent> {
  const row = await prisma.professionalObjective.findUnique({
    where: {
      professionalId_kind_periodKey: { professionalId, kind, periodKey },
    },
  });
  if (!row) return emptyContent(kind as never) as never;
  return row.content as never;
}
