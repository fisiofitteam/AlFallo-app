/**
 * Cálculo de slots disponibles para reserva pública desde la landing.
 *
 * Lee la configuración de horarios desde la BD (plantilla + overrides) y
 * los cruza con eventos existentes en Google Calendar.
 *
 * La duración del slot se toma de cada franja (slotDurationMinutes).
 * Todas las franjas están en HORA DE MADRID.
 */
import { listEvents, busyEventRange } from "@/lib/googleCalendar";
import {
  getShiftsForDateRange,
  madridYMD,
  madridDayOfWeek,
  madridDateAt,
  weekStartOf,
  timeToMinutes,
  getBlocksInRange,
  isSlotBlocked,
} from "@/lib/agendaTemplate";

export const MIN_HOURS_AHEAD = 24;
export const MAX_DAYS_AHEAD = 20;

export type SlotInfo = {
  startISO: string;
  endISO: string;
  dayOfWeek: number;
  hhmm: string;
  durationMinutes: number;
};

export async function getAvailableSlots(): Promise<SlotInfo[]> {
  const now = new Date();
  const minStart = new Date(now.getTime() + MIN_HOURS_AHEAD * 3600 * 1000);
  const maxStart = new Date(now.getTime() + MAX_DAYS_AHEAD * 86400 * 1000);

  // 1) Cargar franjas (plantilla u overrides) para todo el rango
  const [shiftsByWeek, blocks] = await Promise.all([
    getShiftsForDateRange(now, maxStart),
    // Bloqueos guardados a medianoche deben cubrir fechas completas,
    // no filtrarse desde la hora exacta actual.
    getBlocksInRange(weekStartOf(now), new Date(weekStartOf(maxStart).getTime() + 7 * 86400 * 1000)),
  ]);

  // 2) Generar candidatos
  const candidates: SlotInfo[] = [];

  const todayMadrid = madridYMD(now);
  for (let dayOffset = 0; dayOffset <= MAX_DAYS_AHEAD; dayOffset++) {
    // Avanzar por fechas de calendario, no bloques UTC de 24h:
    // el cambio de horario de verano/invierno no debe repetir días.
    const dProbe = new Date(Date.UTC(todayMadrid.year, todayMadrid.month - 1, todayMadrid.day + dayOffset, 12, 0));
    const ymd = { year: dProbe.getUTCFullYear(), month: dProbe.getUTCMonth() + 1, day: dProbe.getUTCDate() };
    const dow = madridDayOfWeek(madridDateAt(ymd.year, ymd.month, ymd.day, 12, 0));

    const weekStart = weekStartOf(dProbe);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const weekShifts = shiftsByWeek.get(weekKey) || [];
    const dailyFranjas = weekShifts.filter((f) => f.dayOfWeek === dow);

    for (const franja of dailyFranjas) {
      const franjaStart = timeToMinutes(franja.startTime);
      const franjaEnd = timeToMinutes(franja.endTime);
      const duration = franja.slotDurationMinutes;
      for (let m = franjaStart; m + duration <= franjaEnd; m += duration) {
        const hh = Math.floor(m / 60);
        const mm = m % 60;
        const hhmm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        const startDate = madridDateAt(ymd.year, ymd.month, ymd.day, hh, mm);
        if (startDate < minStart) continue;
        if (startDate > maxStart) continue;
        const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
        if (isSlotBlocked(ymd, m, m + duration, blocks)) continue;
        candidates.push({
          startISO: startDate.toISOString(),
          endISO: endDate.toISOString(),
          dayOfWeek: dow,
          hhmm,
          durationMinutes: duration,
        });
      }
    }
  }

  if (candidates.length === 0) return [];

  // 3) Cruzar con eventos Calendar
  candidates.sort((a, b) => a.startISO.localeCompare(b.startISO));
  const fromISO = candidates[0].startISO;
  const toISO = candidates[candidates.length - 1].endISO;
  const events = await listEvents(fromISO, toISO);

  type Range = { startMs: number; endMs: number };
  const occupied: Range[] = events
    .map((event) => busyEventRange(event))
    .filter((range): range is Range => range !== null);

  const available = candidates.filter((s) => {
    const startMs = new Date(s.startISO).getTime();
    const endMs = new Date(s.endISO).getTime();
    return !occupied.some((o) => startMs < o.endMs && endMs > o.startMs);
  });

  return available;
}
