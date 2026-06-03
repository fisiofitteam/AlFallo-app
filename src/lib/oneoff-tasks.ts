// Helpers de las tareas puntuales (con fecha) del equipo.
//
// Cada tarea define una "regla" (single, range, monthly_weekday). Para una
// fecha dada (normalmente hoy) calculamos su INSTANCIA: la fecha clave de
// esa ocurrencia. Si la regla no aplica hoy, no hay instancia → no se ve.
//
// Convención de fechas: como en el módulo semanal, todas las fechas se
// guardan como "00:00 Europa/Madrid" expresado en UTC. Eso da
// comparaciones estables sin importar la hora del día.

export type OneOffMode = "single" | "range" | "monthly_weekday";

export const ONEOFF_MODES: OneOffMode[] = ["single", "range", "monthly_weekday"];

export type OneOffRule = {
  mode: string;
  date: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  nthWeek: number | null;
  weekday: number | null;
  until: Date | null;
};

export const WEEKDAY_LABELS: { value: number; long: string; short: string }[] = [
  { value: 1, long: "Lunes", short: "Lun" },
  { value: 2, long: "Martes", short: "Mar" },
  { value: 3, long: "Miércoles", short: "Mié" },
  { value: 4, long: "Jueves", short: "Jue" },
  { value: 5, long: "Viernes", short: "Vie" },
  { value: 6, long: "Sábado", short: "Sáb" },
  { value: 7, long: "Domingo", short: "Dom" },
];

export const NTH_WEEK_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Primer" },
  { value: 2, label: "Segundo" },
  { value: 3, label: "Tercer" },
  { value: 4, label: "Cuarto" },
  { value: -1, label: "Último" },
];

// ── Offsets y construcción Madrid ────────────────────────────

function madridOffsetMinutes(at: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  });
  const parts = fmt.formatToParts(at);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 60;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + (m[3] ? Number(m[3]) : 0));
}

// Devuelve un Date que representa "y-m-d 00:00 Europa/Madrid" (en UTC).
export function madridMidnight(year: number, monthOneBased: number, day: number): Date {
  // Tomamos como referencia mediodía para esquivar saltos de DST justo a 00:00.
  const noonUTC = new Date(Date.UTC(year, monthOneBased - 1, day, 12));
  const off = madridOffsetMinutes(noonUTC);
  return new Date(Date.UTC(year, monthOneBased - 1, day, 0, -off));
}

// "Hoy" como Madrid 00:00 (en UTC). Por defecto usa Date.now().
export function todayInMadrid(ref: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return madridMidnight(get("year"), get("month"), get("day"));
}

// Año y mes (1-12) de un Date evaluado en Madrid.
function madridYearMonth(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}

// ── Cálculo del N-ésimo día de la semana del mes ────────────

// nth: 1..4 (primer..cuarto) o -1 (último). weekday: 1=Lun..7=Dom (ISO).
export function nthWeekdayOfMonth(
  year: number,
  monthOneBased: number,
  nth: number,
  weekday: number,
): Date | null {
  if (nth === -1) {
    // Buscamos desde el último día hacia atrás el primer match.
    const last = madridMidnight(year, monthOneBased + 1, 0); // día 0 del mes siguiente = último del actual
    const lastDay = new Date(last).getUTCDate();
    for (let d = lastDay; d >= 1; d--) {
      const cand = madridMidnight(year, monthOneBased, d);
      if (isoWeekdayInMadrid(cand) === weekday) return cand;
    }
    return null;
  }
  if (nth < 1 || nth > 4) return null;
  // Buscamos desde el día 1 hacia delante.
  for (let d = 1; d <= 31; d++) {
    const cand = madridMidnight(year, monthOneBased, d);
    // Si el día se "fue" al mes siguiente, paramos.
    if (madridYearMonth(cand).month !== monthOneBased) return null;
    if (isoWeekdayInMadrid(cand) === weekday) {
      // ¿Cuál es la ordinal? La calculamos como ceil(day/7).
      const dayInMonth = Number(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "2-digit" })
          .formatToParts(cand)
          .find((p) => p.type === "day")?.value,
      );
      const ord = Math.ceil(dayInMonth / 7);
      if (ord === nth) return cand;
    }
  }
  return null;
}

function isoWeekdayInMadrid(d: Date): number {
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const wd = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  })
    .formatToParts(d)
    .find((p) => p.type === "weekday")?.value;
  return map[wd ?? "Mon"] ?? 1;
}

// ── Cálculo de instancia activa ──────────────────────────────

/**
 * Dada una regla y una fecha de referencia (por defecto hoy), devuelve la
 * "instancia" (fecha clave) activa AHORA mismo o null si la regla no aplica.
 */
export function activeInstanceFor(rule: OneOffRule, today: Date = todayInMadrid()): Date | null {
  switch (rule.mode) {
    case "single": {
      if (!rule.date) return null;
      // Visible desde la fecha hasta… siempre (sin caducidad). Si nadie marca,
      // se queda visible para que no se olvide.
      if (today < rule.date) return null;
      return rule.date;
    }
    case "range": {
      if (!rule.startDate || !rule.endDate) return null;
      if (today < rule.startDate || today > rule.endDate) return null;
      return rule.startDate;
    }
    case "monthly_weekday": {
      if (rule.nthWeek == null || rule.weekday == null) return null;
      const { year, month } = madridYearMonth(today);
      const trigger = nthWeekdayOfMonth(year, month, rule.nthWeek, rule.weekday);
      if (!trigger) return null;
      if (today < trigger) return null;
      if (rule.until && today > rule.until) return null;
      return trigger;
    }
    default:
      return null;
  }
}

// ── Descripciones legibles ───────────────────────────────────

export function ruleSummary(rule: OneOffRule): string {
  const fmtDate = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  switch (rule.mode) {
    case "single":
      return rule.date ? `El ${fmtDate.format(rule.date)}` : "Sin fecha";
    case "range":
      return rule.startDate && rule.endDate
        ? `Del ${fmtDate.format(rule.startDate)} al ${fmtDate.format(rule.endDate)}`
        : "Rango incompleto";
    case "monthly_weekday": {
      if (rule.nthWeek == null || rule.weekday == null) return "Mensual sin definir";
      const nth = NTH_WEEK_OPTIONS.find((n) => n.value === rule.nthWeek)?.label ?? "";
      const wd = WEEKDAY_LABELS.find((w) => w.value === rule.weekday)?.long.toLowerCase() ?? "";
      const tail = rule.until ? ` (hasta ${fmtDate.format(rule.until)})` : "";
      return `${nth} ${wd} de cada mes${tail}`;
    }
    default:
      return "—";
  }
}

// Subtítulo corto para la tarjeta del nutri (cuando "ya está activa").
export function shortDueLabel(rule: OneOffRule): string {
  const fmt = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
  });
  switch (rule.mode) {
    case "single":
      return rule.date ? `el ${fmt.format(rule.date)}` : "";
    case "range":
      return rule.endDate ? `hasta ${fmt.format(rule.endDate)}` : "";
    case "monthly_weekday":
      return "este mes";
    default:
      return "";
  }
}
