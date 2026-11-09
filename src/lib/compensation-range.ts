/** Pure helpers for custom commission date ranges (calendar days in Europe/Madrid). */
const DAY_MS = 86_400_000;
const TIMEZONE = "Europe/Madrid";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validYmd(value: unknown): value is string {
  if (typeof value !== "string" || !ISO.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100;
}

export function nextYmd(value: string): string {
  const d = new Date(`${value}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function dateSerial(value: string): number { return Date.parse(`${value}T00:00:00.000Z`); }
function monthLastDay(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
function monthFirstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
export function currentMadridYmd(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
export function startOfMadridDay(ymd: string): Date {
  // Internal endExclusive may fall on January 1 of the year after a valid
  // user-selected year. Validate the date itself without the UI's year cap.
  if (!ISO.test(ymd) || new Date(`${ymd}T00:00:00.000Z`).toISOString().slice(0, 10) !== ymd) {
    throw new Error("Invalid YYYY-MM-DD");
  }
  const [year, month, day] = ymd.split("-").map(Number);
  const midnightAsUTC = Date.UTC(year, month - 1, day, 0, 0, 0);
  const probe = new Date(midnightAsUTC);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = fmt.formatToParts(probe);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const localAtProbe = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour") % 24, pick("minute"), pick("second"));
  return new Date(midnightAsUTC - (localAtProbe - midnightAsUTC));
}

export type FinanceRange = {
  from: string;
  to: string; // inclusive YYYY-MM-DD
  fromDate: Date;
  toExclusive: Date;
  label: string;
  fullMonthKey: string | null;
  validationError: string | null;
};

export function resolveFinanceRange(query: { from?: string; to?: string }, today = new Date()): FinanceRange {
  const currentDay = currentMadridYmd(today);
  const first = `${currentDay.slice(0, 7)}-01`;
  const last = monthLastDay(Number(currentDay.slice(0, 4)), Number(currentDay.slice(5, 7)));
  const from = query.from === undefined && query.to === undefined ? first : query.from || first;
  const to = query.from === undefined && query.to === undefined ? last : query.to || last;
  if (!validYmd(from) || !validYmd(to)) {
    return createRange(first, last, "Introduce fechas válidas en el formato año-mes-día.");
  }
  if (from > to) {
    return createRange(first, last, "La fecha de inicio debe ser anterior o igual a la fecha final.");
  }
  if ((dateSerial(to) - dateSerial(from)) / DAY_MS > 731) {
    return createRange(first, last, "El intervalo máximo es de dos años. Acota las fechas e inténtalo de nuevo.");
  }
  return createRange(from, to);
}
function createRange(from: string, to: string, validationError: string | null = null): FinanceRange {
  const fromDate = startOfMadridDay(from);
  const toExclusive = startOfMadridDay(nextYmd(to));
  const [year, month] = from.split("-").map(Number);
  const fullMonthKey = from === monthFirstDay(year, month) && to === monthLastDay(year, month) ? from.slice(0, 7) : null;
  const label = fullMonthKey ? new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)))
    : `del ${new Date(`${from}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} al ${new Date(`${to}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
  return { from, to, fromDate, toExclusive, label, fullMonthKey, validationError };
}

export type CalendarMonthSlice = { monthKey: string; from: string; to: string; monthDays: number };
export function monthSlices(from: string, to: string): CalendarMonthSlice[] {
  if (!validYmd(from) || !validYmd(to) || from > to) return [];
  const result: CalendarMonthSlice[] = [];
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  for (let year = fromYear, month = fromMonth; year < toYear || (year === toYear && month <= toMonth);) {
    const first = monthFirstDay(year, month);
    const last = monthLastDay(year, month);
    result.push({
      monthKey: first.slice(0, 7), from: first < from ? from : first,
      to: last > to ? to : last, monthDays: Number(last.slice(-2)),
    });
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return result;
}
export function dayCount(from: string, to: string): number {
  return Math.round((dateSerial(to) - dateSerial(from)) / DAY_MS) + 1;
}
