import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Lógica del check-in semanal del cliente.
 *
 * Reglas de negocio:
 * - Cada Client tiene su propio día de la semana (Client.checkInDayOfWeek,
 *   1=lunes ... 7=domingo). El default global es viernes (5).
 * - El aviso aparece DESDE el día configurado hasta el final de esa semana
 *   ISO (domingo 23:59 Europe/Madrid). Si el atleta no lo rellena, sigue
 *   viéndose como "pendiente" hasta que:
 *     a) Envía un check-in (desaparece hasta la siguiente semana), o
 *     b) Empieza el lunes siguiente (nueva semana, cuenta reset — vuelve a
 *        salir cuando llegue de nuevo su día configurado).
 * - "Esta semana" = del lunes 00:00 al domingo 23:59 en Europe/Madrid.
 */

export const DEFAULT_CHECKIN_DAY_OF_WEEK = 5; // viernes
export const CHECKIN_DAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const MADRID_TZ = "Europe/Madrid";

function nowInMadrid(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: MADRID_TZ }));
}

/** ISO weekday: 1=Lunes ... 7=Domingo. JavaScript devuelve 0 para domingo,
 *  aquí lo normalizamos para que las comparaciones "ya llegó su día" funcionen
 *  de lunes a domingo en orden natural. */
function isoDayOfWeek(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Inicio (00:00) del lunes de esta semana en Madrid, expresado como Date. */
function startOfThisWeek(): Date {
  const madrid = nowInMadrid();
  const daysBackToMonday = isoDayOfWeek(madrid) - 1;
  const monday = new Date(madrid);
  monday.setDate(madrid.getDate() - daysBackToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** ¿Ya envió este cliente un check-in en la semana actual (lunes-domingo)? */
export async function hasCheckInThisWeek(clientId: string): Promise<boolean> {
  const start = startOfThisWeek();
  const count = await prisma.checkIn.count({
    where: { clientId, date: { gte: start } },
  });
  return count > 0;
}

/** Día de check-in configurado para el cliente (con fallback al default). */
export async function getCheckInDayForClient(clientId: string): Promise<number> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { checkInDayOfWeek: true },
  });
  const raw = client?.checkInDayOfWeek ?? DEFAULT_CHECKIN_DAY_OF_WEEK;
  return raw >= 1 && raw <= 7 ? raw : DEFAULT_CHECKIN_DAY_OF_WEEK;
}

/** ¿Debe verse el aviso del check-in en la home del cliente?
 *  Se muestra desde su día configurado hasta el final de esa semana ISO si
 *  aún no lo ha enviado. */
export async function shouldShowCheckInReminder(clientId: string): Promise<boolean> {
  const day = await getCheckInDayForClient(clientId);
  const today = isoDayOfWeek(nowInMadrid());
  if (today < day) return false;
  return !(await hasCheckInThisWeek(clientId));
}
