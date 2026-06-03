// Helpers de las tareas semanales (L-V) del equipo.
//
// La "semana" se identifica por el lunes a las 00:00 hora Europa/Madrid,
// almacenado como Date (UTC) en la BD. Ese lunes es la clave de
// WeeklyTaskCompletion.weekStart y nos da una comparación estable entre
// usuarios sin importar a qué hora del día marquen.

export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: "Lun", long: "Lunes" },
  { value: 2, short: "Mar", long: "Martes" },
  { value: 3, short: "Mié", long: "Miércoles" },
  { value: 4, short: "Jue", long: "Jueves" },
  { value: 5, short: "Vie", long: "Viernes" },
];

export const WEEKDAY_VALUES = [1, 2, 3, 4, 5];

export function dayLabel(dayOfWeek: number, variant: "short" | "long" = "long"): string {
  const d = WEEKDAYS.find((w) => w.value === dayOfWeek);
  if (!d) return "";
  return variant === "short" ? d.short : d.long;
}

// Devuelve el lunes 00:00 (Europa/Madrid) de la semana que contiene `ref`,
// como Date en UTC. Ejemplo: si hoy es martes 3 jun 2026 a las 14:00 en Madrid,
// devuelve 2026-06-01T22:00:00Z (que es lunes 2026-06-02 00:00 en Madrid en verano).
//
// Implementación: nos basamos en getUTCDay() interpretando el instante en la
// zona Europa/Madrid. Para evitar dependencias, usamos el truco del offset:
// formateamos la fecha en Madrid, extraemos sus componentes, calculamos el
// lunes en horario local de Madrid, y reconstruimos un Date.
export function weekStartFor(ref: Date = new Date()): Date {
  // Partes de la fecha en horario Europa/Madrid.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(ref);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const wd = get("weekday"); // "Mon", "Tue", ...
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const isoDow = map[wd] ?? 1;

  // Día (1-31) del lunes de esta semana en Madrid.
  const mondayDay = d - (isoDow - 1);

  // Construimos el ISO string "YYYY-MM-DD" de ese lunes. Si mondayDay < 1
  // retrocedemos al mes anterior. Usamos Date.UTC con un mes neutro para
  // normalizar año/mes, luego desplazamos al offset real de Madrid.
  const monday = new Date(Date.UTC(y, m - 1, mondayDay));
  // Calculamos el offset de Madrid para ese día a las 00:00 (en h).
  const offsetMin = madridOffsetMinutes(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 12)));
  // Madrid = UTC + offsetMin. Lunes 00:00 Madrid = UTC - offsetMin.
  return new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, -offsetMin));
}

// Offset (en minutos) de Europa/Madrid sobre UTC para el instante dado.
// Verano (CEST) = +120, invierno (CET) = +60.
function madridOffsetMinutes(at: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  });
  // En "shortOffset" obtenemos algo tipo "GMT+2" o "GMT+1".
  const parts = fmt.formatToParts(at);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 60;
  const sign = m[1] === "-" ? -1 : 1;
  const h = Number(m[2]);
  const min = m[3] ? Number(m[3]) : 0;
  return sign * (h * 60 + min);
}

// Etiqueta legible para la semana actual ("3 - 7 jun" o "30 dic - 3 ene").
export function weekRangeLabel(weekStart: Date): string {
  const friday = new Date(weekStart);
  friday.setUTCDate(friday.getUTCDate() + 4); // +4 días = viernes
  const f = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
  });
  const a = f.format(weekStart);
  const b = f.format(friday);
  return `${a} – ${b}`;
}
