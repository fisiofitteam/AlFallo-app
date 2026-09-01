import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Lógica del check-in recurrente del cliente.
 *
 * Un Client tiene 1..N días de la semana (Client.checkInDaysOfWeek, valores
 * ISO 1=Lunes ... 7=Domingo). Cada día configurado dispara una petición: el
 * banner aparece desde ese día hasta que el atleta rellena UN check-in a
 * partir de ese día 00:00 (Europe/Madrid). Al llegar el siguiente día
 * configurado, empieza otra petición aunque no haya cumplido la anterior.
 *
 * Ejemplo: días = [1, 5] (lunes y viernes).
 *  - Lunes: banner "pendiente" hasta que rellene → se marca como cumplido el
 *    lunes; el martes, miércoles y jueves el banner desaparece.
 *  - Viernes: nueva petición, banner "pendiente" hasta que rellene → se
 *    marca cumplido el viernes; sábado y domingo sin banner.
 *
 * El default global es viernes (5).
 */

export const DEFAULT_CHECKIN_DAYS = [5];

export const CHECKIN_DAY_OPTIONS = [
  { value: 1, label: "Lunes", short: "L" },
  { value: 2, label: "Martes", short: "M" },
  { value: 3, label: "Miércoles", short: "X" },
  { value: 4, label: "Jueves", short: "J" },
  { value: 5, label: "Viernes", short: "V" },
  { value: 6, label: "Sábado", short: "S" },
  { value: 7, label: "Domingo", short: "D" },
];

const MADRID_TZ = "Europe/Madrid";

function nowInMadrid(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: MADRID_TZ }));
}

/** ISO weekday: 1=Lunes ... 7=Domingo (JS devuelve 0 para domingo). */
function isoDayOfWeek(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function sanitizeDays(raw: number[] | null | undefined, fallback: number): number[] {
  const cleaned = Array.isArray(raw)
    ? Array.from(new Set(raw.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)))
    : [];
  if (cleaned.length === 0) return [fallback >= 1 && fallback <= 7 ? fallback : 5];
  return cleaned.sort((a, b) => a - b);
}

export async function getCheckInDaysForClient(clientId: string): Promise<number[]> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { checkInDaysOfWeek: true, checkInDayOfWeek: true },
  });
  return sanitizeDays(client?.checkInDaysOfWeek ?? null, client?.checkInDayOfWeek ?? 5);
}

/** Fecha (00:00 Madrid) del último día configurado que ya ha "llegado" respecto
 *  a `now`. Si hoy no toca y tampoco ha tocado esta semana ISO, retrocede al
 *  último día de la semana ISO pasada. Si el array está vacío devuelve null. */
function lastDueMomentBefore(days: number[], now: Date): Date | null {
  if (days.length === 0) return null;
  const today = isoDayOfWeek(now);
  const past = days.filter((d) => d <= today);
  if (past.length > 0) {
    const lastDay = past[past.length - 1];
    const daysBack = today - lastDay;
    const d = new Date(now);
    d.setDate(now.getDate() - daysBack);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // No ha llegado ningún día esta semana ISO → volvemos al último día de la
  // semana anterior (el mayor del array).
  const lastDay = days[days.length - 1];
  const daysBack = 7 - (lastDay - today);
  const d = new Date(now);
  d.setDate(now.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ¿Rellenó el atleta algún check-in desde `since`? */
async function hasCheckInSince(clientId: string, since: Date): Promise<boolean> {
  const count = await prisma.checkIn.count({
    where: { clientId, date: { gte: since } },
  });
  return count > 0;
}

/** ¿Debe verse el aviso del check-in? Sí cuando ya llegó la petición más
 *  reciente y todavía no ha enviado un check-in desde entonces. */
export async function shouldShowCheckInReminder(clientId: string): Promise<boolean> {
  const days = await getCheckInDaysForClient(clientId);
  const since = lastDueMomentBefore(days, nowInMadrid());
  if (!since) return false;
  return !(await hasCheckInSince(clientId, since));
}

/** ¿Ha cumplido con la petición vigente (la más reciente ya lanzada)? */
export async function hasFulfilledLatestRequest(clientId: string): Promise<boolean> {
  const days = await getCheckInDaysForClient(clientId);
  const since = lastDueMomentBefore(days, nowInMadrid());
  if (!since) return true;
  return hasCheckInSince(clientId, since);
}
