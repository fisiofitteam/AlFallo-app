import { madridDateAt } from "@/lib/agendaTemplate";

/** Calendar API returns RFC3339 for timed events and YYYY-MM-DD for all-day events. */
export type CalendarEventTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};
export type CalendarEvent = {
  id: string;
  status: string;
  transparency?: "opaque" | "transparent";
  summary?: string;
  description?: string;
  start: CalendarEventTime;
  end: CalendarEventTime;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri?: string }[] };
};

/**
 * In Google Calendar all-day start.date is inclusive, end.date is exclusive.
 * We interpret these dates at local midnight in Madrid, including DST.
 * A "Free" event (transparent) does not occupy the diary.
 */
export function busyEventRange(event: CalendarEvent): { startMs: number; endMs: number } | null {
  if (event.status === "cancelled" || event.transparency === "transparent") return null;

  const dayStart = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const [year, month, day] = value.split("-").map(Number);
    return madridDateAt(year, month, day, 0, 0).getTime();
  };
  const startMs = event.start?.dateTime
    ? Date.parse(event.start.dateTime) : event.start?.date ? dayStart(event.start.date) : NaN;
  const endMs = event.end?.dateTime
    ? Date.parse(event.end.dateTime) : event.end?.date ? dayStart(event.end.date) : NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error("Google Calendar ha devuelto un evento ocupado con fechas inválidas");
  }
  return { startMs, endMs };
}
export function eventOverlapsRange(event: CalendarEvent, fromISO: string, toISO: string): boolean {
  const range = busyEventRange(event);
  if (!range) return false;
  return range.startMs < Date.parse(toISO) && range.endMs > Date.parse(fromISO);
}
