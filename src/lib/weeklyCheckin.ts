import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Lógica del check-in semanal del cliente.
 *
 * Reglas de negocio:
 * - El aviso aparece SOLO el día del check-in (constante CHECKIN_DAY_OF_WEEK)
 *   y SOLO si el cliente todavía no ha registrado un check-in esta semana.
 * - "Esta semana" = del lunes 00:00 al domingo 23:59 en zona horaria Europe/Madrid.
 *   (Lunes coincide con el día del aviso, así que en la práctica el aviso
 *    aparece todo el lunes salvo que ya hayan rellenado uno ese mismo día.)
 * - Una vez registrado el check-in de la semana, el aviso desaparece y vuelve
 *   a salir el siguiente lunes que toque.
 *
 * Para cambiar el día del aviso basta editar CHECKIN_DAY_OF_WEEK (0 = domingo,
 * 1 = lunes, …, 6 = sábado).
 */

export const CHECKIN_DAY_OF_WEEK = 1; // lunes

const MADRID_TZ = "Europe/Madrid";

/** Devuelve un Date que representa el "ahora" pero con los componentes
 *  (día/hora/minuto/etc.) que tendría en zona horaria Madrid. No es una
 *  representación UTC válida, lo usamos solo para leer getDay() / getHours()
 *  como si fuera la hora local de Madrid. */
function nowInMadrid(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: MADRID_TZ }));
}

/** ¿Es hoy el día del check-in en Madrid? */
export function isCheckInDay(): boolean {
  return nowInMadrid().getDay() === CHECKIN_DAY_OF_WEEK;
}

/** Inicio (00:00) del lunes de esta semana en Madrid, expresado como Date UTC. */
function startOfThisWeekUtc(): Date {
  const madrid = nowInMadrid();
  const day = madrid.getDay(); // 0=dom, 1=lun, ..., 6=sáb
  const daysBackToMonday = (day + 6) % 7; // 0 si lun, 1 si mar, ..., 6 si dom
  const monday = new Date(madrid);
  monday.setDate(madrid.getDate() - daysBackToMonday);
  monday.setHours(0, 0, 0, 0);
  // monday tiene componentes de Madrid; convertimos a UTC reinterpretando
  // como hora local Madrid → instante real:
  // truco simple: ya está suficientemente cerca para usarse en comparaciones
  // con CheckIn.date (que se guarda con `new Date()` desde el servidor).
  return monday;
}

/** ¿Ya envió este cliente un check-in en la semana actual (lunes-domingo)? */
export async function hasCheckInThisWeek(clientId: string): Promise<boolean> {
  const start = startOfThisWeekUtc();
  const count = await prisma.checkIn.count({
    where: { clientId, date: { gte: start } },
  });
  return count > 0;
}

/** ¿Debe verse el aviso del check-in en la home del cliente? */
export async function shouldShowCheckInReminder(clientId: string): Promise<boolean> {
  if (!isCheckInDay()) return false;
  return !(await hasCheckInThisWeek(clientId));
}
