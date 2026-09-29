// Métricas que pintamos en la lista de clientes (cards estilo FisioFit):
// - Suscripción: progreso (0–100%) del programa vigente + días hasta
//   renovación + semana en la que está el atleta.
// - Cumplimiento: % de semanas con check-in dentro del periodo vigente.
//
// La fuente de verdad es SubscriptionPeriod (via cache en Client:
// programStartDate/EndDate/DurationMonths). Se acepta Sale como fallback
// para no perder clientes legacy sin periodo registrado todavía.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type SubscriptionInfo = {
  /** Hay una suscripción medible (fechas conocidas). */
  hasSubscription: boolean;
  /** Porcentaje 0–100 transcurrido del periodo. 0 al inicio, 100 al final. */
  progressPct: number;
  /** Días que faltan para la renovación (negativo si ya venció). */
  daysToRenewal: number;
  /** Semana 1..N en la que está el atleta (0 antes de empezar). */
  currentWeek: number;
  /** Total de semanas del periodo. 0 si no se puede calcular. */
  totalWeeks: number;
  /** Fechas para tooltips/cálculo del cumplimiento. */
  startDate: Date | null;
  endDate: Date | null;
};

export type ClientMetrics = {
  subscription: SubscriptionInfo;
  /** % cumplimiento de check-ins semanales esperados en el periodo vigente. */
  compliancePct: number;
  /** Indica si hay datos suficientes para mostrar el % de cumplimiento. */
  hasCompliance: boolean;
};

export type SaleForMetrics = {
  startDate: Date | null;
  endDate: Date | null;
  planMonths: number | null;
};

/** Devuelve la fecha sumándole `months` meses, preservando el día cuando es
 *  posible (no es algo estricto: para el cálculo de días vale de sobra). */
function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export function computeSubscription(sale: SaleForMetrics | null): SubscriptionInfo {
  const empty: SubscriptionInfo = {
    hasSubscription: false,
    progressPct: 0,
    daysToRenewal: 0,
    currentWeek: 0,
    totalWeeks: 0,
    startDate: null,
    endDate: null,
  };
  if (!sale || !sale.startDate) return empty;
  const start = sale.startDate;
  // Preferimos endDate explícito (lo persiste la venta si está); si falta,
  // lo derivamos de planMonths. Sin nada de eso no podemos pintar nada.
  const end = sale.endDate ?? (sale.planMonths ? addMonths(start, sale.planMonths) : null);
  if (!end) return { ...empty, startDate: start };

  const now = Date.now();
  const total = end.getTime() - start.getTime();
  const elapsed = Math.max(0, now - start.getTime());
  const pct = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
  const daysToRenewal = Math.round((end.getTime() - now) / DAY_MS);
  const totalWeeks = Math.max(1, Math.round(total / WEEK_MS));
  const currentWeek =
    now < start.getTime()
      ? 0
      : Math.min(totalWeeks, Math.max(1, Math.ceil(elapsed / WEEK_MS)));
  return {
    hasSubscription: true,
    progressPct: pct,
    daysToRenewal,
    currentWeek,
    totalWeeks,
    startDate: start,
    endDate: end,
  };
}

/** Frase corta que resume la posición del atleta en su programa. */
export function weekLabel(sub: SubscriptionInfo): string | null {
  if (!sub.hasSubscription || sub.totalWeeks === 0) return null;
  if (sub.currentWeek === 0) return "Aún no empieza";
  return `Semana ${sub.currentWeek} / ${sub.totalWeeks}`;
}

/** % de semanas en el periodo vigente con al menos un check-in registrado.
 *  Si no hay periodo, devolvemos 0 y `hasCompliance=false` para pintar dim. */
export function computeCompliance(
  sub: SubscriptionInfo,
  checkInDates: Date[],
): { compliancePct: number; hasCompliance: boolean } {
  if (!sub.hasSubscription || !sub.startDate) {
    return { compliancePct: 0, hasCompliance: false };
  }
  const now = Date.now();
  const start = sub.startDate.getTime();
  const elapsedMs = Math.max(0, now - start);
  const weeksElapsed = Math.max(1, Math.floor(elapsedMs / WEEK_MS));
  // Semanas distintas (índice desde el inicio) con al menos un check-in.
  const seenWeeks = new Set<number>();
  for (const d of checkInDates) {
    const w = Math.floor((d.getTime() - start) / WEEK_MS);
    if (w >= 0 && w <= weeksElapsed) seenWeeks.add(w);
  }
  const pct = Math.min(100, Math.round((seenWeeks.size / weeksElapsed) * 100));
  return { compliancePct: pct, hasCompliance: true };
}

/** Tono del badge según el % (verde alto, ámbar medio, rojo bajo, gris N/A). */
export function metricTone(pct: number, hasData: boolean): "good" | "warn" | "bad" | "muted" {
  if (!hasData) return "muted";
  if (pct >= 70) return "good";
  if (pct >= 40) return "warn";
  return "bad";
}

/** Frase corta para la cabecera de la card ("Renueva en 122d", "Vencida", …). */
export function renewalLabel(sub: SubscriptionInfo): string {
  if (!sub.hasSubscription) return "Sin suscripción";
  if (sub.daysToRenewal < 0) return `Vencida hace ${Math.abs(sub.daysToRenewal)}d`;
  if (sub.daysToRenewal === 0) return "Renueva hoy";
  return `Renueva en ${sub.daysToRenewal}d`;
}
