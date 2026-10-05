import "server-only";
import { prisma } from "@/lib/prisma";
import {
  startOfMonthUTC,
  startOfNextMonthUTC,
  startOfQuarterUTC,
  startOfNextQuarterUTC,
} from "@/lib/finance";

export type TaxConfig = {
  vatRate: number; // %
  vatExempt: boolean;
  irpfIncomeRate: number; // % retenido en ingresos
  irpfQuarterlyRate: number; // % pago fraccionado modelo 130
  notes: string | null;
};

export async function getTaxSettings(): Promise<TaxConfig> {
  const row = await prisma.taxSetting.findUnique({ where: { id: "default" } });
  return {
    vatRate: row?.vatRate ?? 21,
    vatExempt: row?.vatExempt ?? false,
    irpfIncomeRate: row?.irpfIncomeRate ?? 15,
    irpfQuarterlyRate: row?.irpfQuarterlyRate ?? 20,
    notes: row?.notes ?? null,
  };
}

export type PeriodTotals = {
  ingresos: number;
  gastos: number;
  base: number; // ingresos - gastos (base imponible estimada del periodo)
};

async function sumInRange(from: Date, to: Date): Promise<PeriodTotals> {
  const rows = await prisma.transaction.findMany({
    where: { date: { gte: from, lt: to } },
    select: { type: true, amount: true },
  });
  let ingresos = 0;
  let gastos = 0;
  for (const t of rows) {
    if (t.type === "ingreso") ingresos += t.amount;
    else gastos += t.amount;
  }
  return { ingresos, gastos, base: ingresos - gastos };
}

export async function monthTotals(now = new Date()): Promise<PeriodTotals> {
  return sumInRange(startOfMonthUTC(now), startOfNextMonthUTC(now));
}

export async function quarterTotals(now = new Date()): Promise<PeriodTotals> {
  return sumInRange(startOfQuarterUTC(now), startOfNextQuarterUTC(now));
}

export type TaxEstimate = {
  period: PeriodTotals;
  vatOwed: number; // IVA repercutido sobre ingresos (0 si exento)
  irpfWithheld: number; // IRPF retenido por el cliente en los ingresos
  irpfQuarterly: number; // pago fraccionado modelo 130 (20 % base − retenciones)
  netAfterTaxes: number; // base − vatOwed − irpfQuarterly (estimación conservadora)
};

/** Calcula las estimaciones a partir de los totales del periodo y la config. */
export function estimateTaxes(period: PeriodTotals, cfg: TaxConfig): TaxEstimate {
  const vatOwed = cfg.vatExempt
    ? 0
    : Math.max(0, (period.ingresos * cfg.vatRate) / 100);
  const irpfWithheld = Math.max(0, (period.ingresos * cfg.irpfIncomeRate) / 100);
  const quarterlyRaw = (period.base * cfg.irpfQuarterlyRate) / 100;
  // El modelo 130 descuenta las retenciones ya practicadas (irpfWithheld).
  const irpfQuarterly = Math.max(0, quarterlyRaw - irpfWithheld);
  const netAfterTaxes = period.base - vatOwed - irpfQuarterly;
  return { period, vatOwed, irpfWithheld, irpfQuarterly, netAfterTaxes };
}

export async function monthTaxEstimate(now = new Date()): Promise<TaxEstimate> {
  const [cfg, totals] = await Promise.all([getTaxSettings(), monthTotals(now)]);
  return estimateTaxes(totals, cfg);
}

export async function quarterTaxEstimate(now = new Date()): Promise<TaxEstimate> {
  const [cfg, totals] = await Promise.all([getTaxSettings(), quarterTotals(now)]);
  return estimateTaxes(totals, cfg);
}
