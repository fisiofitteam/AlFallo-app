// Constantes y helpers del cuadro de mandos / finanzas.
import type { Option } from "@/lib/clients";

export const TRANSACTION_TYPES: Option[] = [
  { value: "ingreso", label: "Ingreso" },
  { value: "gasto", label: "Gasto" },
];

export const INCOME_CATEGORIES: Option[] = [
  { value: "cliente", label: "Pago de cliente" },
  { value: "renovacion", label: "Renovación" },
  { value: "otros_ingreso", label: "Otros" },
];

export const EXPENSE_CATEGORIES: Option[] = [
  { value: "publicidad", label: "Publicidad / ADS" },
  { value: "sueldos", label: "Sueldos / equipo" },
  { value: "software", label: "Software" },
  { value: "herramientas", label: "Herramientas" },
  { value: "impuestos", label: "Impuestos" },
  { value: "otros_gasto", label: "Otros" },
];

export const ALL_CATEGORIES: Option[] = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export const PAYROLL_STATUSES: { value: string; label: string; tone: string }[] = [
  { value: "pendiente", label: "Pendiente", tone: "amber" },
  { value: "pagado", label: "Pagado", tone: "green" },
];

export function payrollStatusBadgeClass(status: string): string {
  const tone = PAYROLL_STATUSES.find((s) => s.value === status)?.tone ?? "zinc";
  const map: Record<string, string> = {
    amber: "bg-[#fdecd9] text-[#b45309]",
    green: "bg-[#e7f6ec] text-[#15803d]",
    zinc: "bg-zinc-100 text-zinc-600",
  };
  return map[tone] ?? map.zinc;
}

// Formato de moneda en euros (es-ES).
const eurFmt = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurFmt2 = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtEur(n: number, decimals: 0 | 2 = 0): string {
  return decimals === 0 ? eurFmt.format(n) : eurFmt2.format(n);
}

// Helpers de mes / trimestre.
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

export function quarterOf(date: Date): { year: number; quarter: number } {
  return { year: date.getUTCFullYear(), quarter: Math.floor(date.getUTCMonth() / 3) + 1 };
}

// Devuelve las claves de los últimos N meses, en orden ascendente.
export function lastNMonths(n: number, fromDate: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ALL_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Margen bruto en % (beneficio / ingresos * 100). Devuelve null si no hay
 *  ingresos — no tiene sentido mostrar 0 % cuando el denominador es cero. */
export function marginPct(ingresos: number, gastos: number): number | null {
  if (ingresos <= 0) return null;
  return Math.round(((ingresos - gastos) / ingresos) * 1000) / 10;
}

export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
export function startOfNextMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
export function startOfQuarterUTC(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
}
export function startOfNextQuarterUTC(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 1));
}
