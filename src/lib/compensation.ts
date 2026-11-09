import "server-only";
import { prisma } from "@/lib/prisma";
import {
  monthKey,
  startOfMonthUTC,
  startOfNextMonthUTC,
} from "@/lib/finance";
import { monthSlices, dayCount, startOfMadridDay, nextYmd, type FinanceRange } from "@/lib/compensation-range";

export const COMPENSATION_KINDS = [
  { value: "fixed", label: "Fijo mensual (€)", needsScope: false, unit: "€" },
  { value: "percent_of_profit", label: "% del beneficio bruto", needsScope: false, unit: "%" },
  { value: "percent_of_revenue", label: "% de los ingresos", needsScope: false, unit: "%" },
  { value: "per_active_client", label: "€ por cliente activo", needsScope: true, unit: "€/cliente" },
  { value: "per_new_client", label: "€ por nueva alta del mes", needsScope: true, unit: "€/alta" },
  { value: "per_renewal", label: "€ por renovación del mes", needsScope: true, unit: "€/renovación" },
] as const;

export type CompensationKind = (typeof COMPENSATION_KINDS)[number]["value"];

export function isCompensationKind(v: string): v is CompensationKind {
  return COMPENSATION_KINDS.some((k) => k.value === v);
}

export const COMPENSATION_SCOPES = [
  { value: "assigned", label: "Solo asignados a mí" },
  { value: "all", label: "Todos del negocio" },
] as const;

export function compensationKindLabel(value: string): string {
  return COMPENSATION_KINDS.find((k) => k.value === value)?.label ?? value;
}

export type RuleEvaluation = {
  ruleId: string;
  kind: string;
  value: number;
  scope: string | null;
  gross: number;
  amount: number; // tras aplicar cap/floor
  note: string; // descripción corta "15 % de 4.200 €"
};

export type MonthlyPeriodTotals = {
  revenue: number; // ingresos (type=ingreso) del mes
  expenses: number; // gastos (type=gasto) del mes
  profit: number; // revenue - expenses
  newClients: {
    all: number;
    byProfessional: Map<string, number>;
  };
  renewals: {
    all: number;
    byProfessional: Map<string, number>;
  };
  activeClients: {
    all: number;
    byProfessional: Map<string, number>;
  };
};

/** Totales mensuales consultados una sola vez (reusables entre varias
 *  evaluaciones de reglas en el mismo mes). */
export async function getMonthlyTotals(now = new Date()): Promise<MonthlyPeriodTotals> {
  const from = startOfMonthUTC(now);
  const to = startOfNextMonthUTC(now);

  const [tx, newPeriods, activeClients] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: from, lt: to } },
      select: { type: true, amount: true },
    }),
    prisma.subscriptionPeriod.findMany({
      where: { decidedAt: { gte: from, lt: to } },
      select: { isRenewal: true, client: { select: { nutritionistId: true } } },
    }),
    prisma.client.findMany({
      where: { status: "activo" },
      select: { nutritionistId: true },
    }),
  ]);

  let revenue = 0;
  let expenses = 0;
  for (const t of tx) {
    if (t.type === "ingreso") revenue += t.amount;
    else expenses += t.amount;
  }

  const newAll = { byProf: new Map<string, number>(), total: 0 };
  const renAll = { byProf: new Map<string, number>(), total: 0 };
  for (const p of newPeriods) {
    const nutri = p.client?.nutritionistId ?? null;
    const bucket = p.isRenewal ? renAll : newAll;
    bucket.total++;
    if (nutri) bucket.byProf.set(nutri, (bucket.byProf.get(nutri) ?? 0) + 1);
  }

  const actAll = { byProf: new Map<string, number>(), total: 0 };
  for (const c of activeClients) {
    actAll.total++;
    if (c.nutritionistId) {
      actAll.byProf.set(c.nutritionistId, (actAll.byProf.get(c.nutritionistId) ?? 0) + 1);
    }
  }

  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    newClients: { all: newAll.total, byProfessional: newAll.byProf },
    renewals: { all: renAll.total, byProfessional: renAll.byProf },
    activeClients: { all: actAll.total, byProfessional: actAll.byProf },
  };
}

function clamp(value: number, cap: number | null, floor: number | null): number {
  let v = value;
  if (floor != null) v = Math.max(floor, v);
  if (cap != null) v = Math.min(cap, v);
  return v;
}

function isRuleActiveInMonth(rule: {
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
}, monthStart: Date, monthEnd: Date): boolean {
  if (!rule.active) return false;
  if (rule.startDate && rule.startDate > monthEnd) return false;
  if (rule.endDate && rule.endDate < monthStart) return false;
  return true;
}

/** Evalúa una regla contra los totales del mes para UN profesional. */
function evalRule(
  rule: {
    id: string;
    professionalId: string;
    kind: string;
    value: number;
    scope: string | null;
    cap: number | null;
    floor: number | null;
  },
  totals: MonthlyPeriodTotals,
): RuleEvaluation {
  const scope = rule.scope ?? "all";
  let gross = 0;
  let note = "";
  switch (rule.kind) {
    case "fixed":
      gross = rule.value;
      note = `Fijo mensual`;
      break;
    case "percent_of_profit":
      gross = (totals.profit * rule.value) / 100;
      note = `${rule.value}% sobre beneficio bruto`;
      break;
    case "percent_of_revenue":
      gross = (totals.revenue * rule.value) / 100;
      note = `${rule.value}% sobre ingresos`;
      break;
    case "per_active_client": {
      const n =
        scope === "assigned"
          ? totals.activeClients.byProfessional.get(rule.professionalId) ?? 0
          : totals.activeClients.all;
      gross = n * rule.value;
      note = `${rule.value} € × ${n} activos${scope === "assigned" ? " (asignados)" : ""}`;
      break;
    }
    case "per_new_client": {
      const n =
        scope === "assigned"
          ? totals.newClients.byProfessional.get(rule.professionalId) ?? 0
          : totals.newClients.all;
      gross = n * rule.value;
      note = `${rule.value} € × ${n} altas${scope === "assigned" ? " (asignadas)" : ""}`;
      break;
    }
    case "per_renewal": {
      const n =
        scope === "assigned"
          ? totals.renewals.byProfessional.get(rule.professionalId) ?? 0
          : totals.renewals.all;
      gross = n * rule.value;
      note = `${rule.value} € × ${n} renovaciones${scope === "assigned" ? " (asignadas)" : ""}`;
      break;
    }
    default:
      gross = 0;
      note = `(tipo desconocido: ${rule.kind})`;
  }
  const amount = clamp(gross, rule.cap ?? null, rule.floor ?? null);
  return {
    ruleId: rule.id,
    kind: rule.kind,
    value: rule.value,
    scope: rule.scope,
    gross: Math.round(gross * 100) / 100,
    amount: Math.round(amount * 100) / 100,
    note,
  };
}

export type ProfessionalCompensation = {
  professionalId: string;
  fullName: string;
  rules: RuleEvaluation[];
  total: number;
};

/** Calcula la compensación mensual de TODOS los profesionales activos con
 *  reglas vigentes en el mes dado. Devuelve también los profesionales sin
 *  reglas (total 0) para que la UI pueda proponer añadirlas. */
export async function computeCompensationsForMonth(
  now = new Date(),
): Promise<ProfessionalCompensation[]> {
  const monthStart = startOfMonthUTC(now);
  const monthEnd = new Date(startOfNextMonthUTC(now).getTime() - 1);

  const [professionals, totals] = await Promise.all([
    prisma.professional.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        compensationRules: true,
      },
      orderBy: { fullName: "asc" },
    }),
    getMonthlyTotals(now),
  ]);

  return professionals.map((p) => {
    const activeRules = p.compensationRules.filter((r) =>
      isRuleActiveInMonth(r, monthStart, monthEnd),
    );
    const evals = activeRules.map((r) => evalRule(r, totals));
    const total = Math.round(evals.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    return {
      professionalId: p.id,
      fullName: p.fullName,
      rules: evals,
      total,
    };
  });
}

/** Convierte una fecha a periodKey "YYYY-MM" (coincide con el campo de
 *  PayrollPayment.period). */
export function periodKeyFromDate(d: Date): string {
  return monthKey(d);
}

/**
 * Cálculo de Equipo para un intervalo de días (zona Europe/Madrid).
 * Los porcentajes y comisiones de altas/renovaciones usan las operaciones
 * registradas dentro de cada tramo. Los fijos y €/activo son mensuales y se
 * prorratean por días cuando el tramo solo ocupa parte del mes.
 *
 * Nota histórica: el campo Client.status y el nutricionista asignado se
 * consultan en su estado ACTUAL, pues el esquema no almacena un histórico
 * de asignaciones/activaciones. Mostrarlo claramente en la UI.
 */
export async function computeCompensationsForRange(range: FinanceRange): Promise<{
  compensations: ProfessionalCompensation[];
  totals: MonthlyPeriodTotals;
}> {
  const [professionals, transactions, periods, activeClients] = await Promise.all([
    prisma.professional.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, compensationRules: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: range.fromDate, lt: range.toExclusive } },
      select: { date: true, type: true, amount: true },
    }),
    prisma.subscriptionPeriod.findMany({
      where: { decidedAt: { gte: range.fromDate, lt: range.toExclusive } },
      select: { decidedAt: true, isRenewal: true, client: { select: { nutritionistId: true } } },
    }),
    prisma.client.findMany({ where: { status: "activo" }, select: { nutritionistId: true } }),
  ]);

  const activeByProf = new Map<string, number>();
  for (const c of activeClients) if (c.nutritionistId) {
    activeByProf.set(c.nutritionistId, (activeByProf.get(c.nutritionistId) ?? 0) + 1);
  }
  function totalsBetween(from: Date, toExclusive: Date): MonthlyPeriodTotals {
    let revenue = 0;
    let expenses = 0;
    for (const t of transactions) {
      if (t.date < from || t.date >= toExclusive) continue;
      if (t.type === "ingreso") revenue += t.amount;
      else if (t.type === "gasto") expenses += t.amount;
    }
    const newByProf = new Map<string, number>();
    const renewedByProf = new Map<string, number>();
    let newCount = 0;
    let renewals = 0;
    for (const row of periods) {
      if (row.decidedAt < from || row.decidedAt >= toExclusive) continue;
      const map = row.isRenewal ? renewedByProf : newByProf;
      if (row.isRenewal) renewals++;
      else newCount++;
      const nutri = row.client?.nutritionistId;
      if (nutri) map.set(nutri, (map.get(nutri) ?? 0) + 1);
    }
    return {
      revenue, expenses, profit: revenue - expenses,
      newClients: { all: newCount, byProfessional: newByProf },
      renewals: { all: renewals, byProfessional: renewedByProf },
      activeClients: { all: activeClients.length, byProfessional: activeByProf },
    };
  }

  const overall = totalsBetween(range.fromDate, range.toExclusive);
  const slices = monthSlices(range.from, range.to);
  const multipleMonths = slices.length > 1;
  const compensations = professionals.map((p) => {
    const rules: RuleEvaluation[] = [];
    for (const slice of slices) {
      for (const rule of p.compensationRules) {
        if (!rule.active) continue;
        // Dates on compensation rules are date-only in the application form.
        const start = rule.startDate?.toISOString().slice(0, 10);
        const end = rule.endDate?.toISOString().slice(0, 10);
        const effectiveFrom = start && start > slice.from ? start : slice.from;
        const effectiveTo = end && end < slice.to ? end : slice.to;
        if (effectiveFrom > effectiveTo) continue;

        const days = dayCount(effectiveFrom, effectiveTo);
        const fraction = days / slice.monthDays;
        const scoped = totalsBetween(startOfMadridDay(effectiveFrom), startOfMadridDay(nextYmd(effectiveTo)));
        // Monthly fees and per-active-client prices accrue daily. Percentage
        // and new/renewal commissions apply only to actual dated operations.
        const monthlyKind = rule.kind === "fixed" || rule.kind === "per_active_client";
        const evaluated = evalRule({
          ...rule,
          id: `${rule.id}:${slice.monthKey}`,
          value: monthlyKind ? rule.value * fraction : rule.value,
          floor: rule.floor == null ? null : rule.floor * fraction,
          cap: rule.cap == null ? null : rule.cap * fraction,
        }, scoped);
        const explanation = monthlyKind && days !== slice.monthDays
          ? ` · ${days}/${slice.monthDays} días` : "";
        if (rule.kind === "fixed") {
          evaluated.note = `Fijo mensual de ${rule.value} €${explanation}`;
        } else if (rule.kind === "per_active_client") {
          const n = (rule.scope ?? "all") === "assigned"
            ? activeByProf.get(p.id) ?? 0 : activeClients.length;
          evaluated.note = `${rule.value} € × ${n} activos${(rule.scope ?? "all") === "assigned" ? " asignados" : ""}${explanation}`;
        } else if (days !== slice.monthDays) {
          evaluated.note += explanation;
        }
        if (multipleMonths) evaluated.note = `${slice.monthKey} · ${evaluated.note}`;
        rules.push(evaluated);
      }
    }
    return {
      professionalId: p.id,
      fullName: p.fullName,
      rules,
      total: Math.round(rules.reduce((sum, rule) => sum + rule.amount, 0) * 100) / 100,
    };
  });
  return { compensations, totals: overall };
}
