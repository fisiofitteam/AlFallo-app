/**
 * La fecha es la interfaz pública de las piezas de contenido.
 * ContentWeek permanece como agrupación técnica para conservar las relaciones
 * y los módulos antiguos (dossier, métricas, editor, etc.) sin perder datos.
 * Una agrupación creada aquí NO genera siete piezas vacías.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { isoWeekRange } from "@/lib/content-templates";

type Db = PrismaClient | Prisma.TransactionClient;
const DAY_MS = 86_400_000;

export function parsePieceDate(value: unknown): { date: Date; dayOfWeek: number; year: number; weekNumber: number } | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ||
      date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) return null;
  const dayOfWeek = date.getUTCDay() || 7;
  const thursday = new Date(date.getTime() + (4 - dayOfWeek) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekOneMonday = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAY_MS);
  const monday = new Date(date.getTime() - (dayOfWeek - 1) * DAY_MS);
  const weekNumber = Math.round((monday.getTime() - weekOneMonday.getTime()) / (7 * DAY_MS)) + 1;
  return { date, dayOfWeek, year, weekNumber };
}

export async function getOrCreateContentWeek(db: Db, parsed: NonNullable<ReturnType<typeof parsePieceDate>>) {
  const { year, weekNumber } = parsed;
  const existing = await db.contentWeek.findFirst({ where: { year, weekNumber }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  const { start, end } = isoWeekRange(year, weekNumber);
  return db.contentWeek.create({
    data: {
      year, weekNumber, startDate: start, endDate: end,
      centralTheme: "", bodyZone: "mixta", weekType: "educativa",
      status: "planning",
    },
  });
}
