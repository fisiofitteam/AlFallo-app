"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { parseIntOrNull, parseNumber, parseStr } from "@/lib/clients";

// Toda la sección de cuadro de mandos / finanzas es solo para el CEO.
async function requireCeo() {
  const prof = await requireProfessional();
  if (prof.role !== "ceo") redirect("/");
  return prof;
}

// ─── Movimientos (ingresos / gastos) ───────────────────────────

export async function createTransaction(formData: FormData) {
  await requireCeo();
  const amount = parseNumber(formData.get("amount"));
  const type = parseStr(formData.get("type"));
  if (amount == null || amount <= 0 || (type !== "ingreso" && type !== "gasto")) return;

  const dateRaw = parseStr(formData.get("date"));
  await prisma.transaction.create({
    data: {
      type,
      amount,
      date: dateRaw ? new Date(dateRaw) : new Date(),
      category: parseStr(formData.get("category")),
      description: parseStr(formData.get("description")),
      source: "manual",
    },
  });
  revalidatePath("/finanzas");
}

export async function deleteTransaction(formData: FormData) {
  await requireCeo();
  await prisma.transaction.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/finanzas");
}

// ─── Facturas / sueldos del equipo ─────────────────────────────

export async function createPayroll(formData: FormData) {
  await requireCeo();
  const professionalId = parseStr(formData.get("professionalId"));
  const period = parseStr(formData.get("period"));
  const amount = parseNumber(formData.get("amount"));
  if (!professionalId || !period || amount == null || amount <= 0) return;

  await prisma.payrollPayment.create({
    data: {
      professionalId,
      period,
      amount,
      concept: parseStr(formData.get("concept")),
      notes: parseStr(formData.get("notes")),
      invoiceUrl: parseStr(formData.get("invoiceUrl")),
    },
  });
  revalidatePath("/finanzas");
}

export async function markPayrollPaid(formData: FormData) {
  await requireCeo();
  const id = String(formData.get("id"));
  const payroll = await prisma.payrollPayment.findUnique({ where: { id } });
  if (!payroll) return;
  // Marca como pagado y crea un movimiento "gasto" enlazado por concepto.
  const nowPaid = payroll.status !== "pagado";
  await prisma.payrollPayment.update({
    where: { id },
    data: { status: nowPaid ? "pagado" : "pendiente", paidAt: nowPaid ? new Date() : null },
  });
  if (nowPaid) {
    const prof = await prisma.professional.findUnique({ where: { id: payroll.professionalId }, select: { fullName: true } });
    await prisma.transaction.create({
      data: {
        type: "gasto",
        category: "sueldos",
        description: `Factura ${prof?.fullName ?? "equipo"} · ${payroll.period}`,
        amount: payroll.amount,
        date: new Date(),
        source: "payroll",
      },
    });
  }
  revalidatePath("/finanzas");
}

export async function deletePayroll(formData: FormData) {
  await requireCeo();
  await prisma.payrollPayment.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/finanzas");
}

// ─── Objetivos trimestrales ────────────────────────────────────

export async function createGoal(formData: FormData) {
  await requireCeo();
  const name = parseStr(formData.get("name"));
  const year = parseIntOrNull(formData.get("year"));
  const quarter = parseIntOrNull(formData.get("quarter"));
  if (!name || !year || !quarter) return;

  await prisma.quarterlyGoal.create({
    data: {
      name,
      year,
      quarter,
      targetAmount: parseNumber(formData.get("targetAmount")),
      notes: parseStr(formData.get("notes")),
    },
  });
  revalidatePath("/finanzas");
}

export async function deleteGoal(formData: FormData) {
  await requireCeo();
  await prisma.quarterlyGoal.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/finanzas");
}

// ─── Gastos fijos mensuales (RecurringExpense) ─────────────────

function clampDay(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, Math.round(n)));
}

export async function createRecurringExpense(formData: FormData) {
  await requireCeo();
  const name = parseStr(formData.get("name"));
  const category = parseStr(formData.get("category")) ?? "otros_gasto";
  const amount = parseNumber(formData.get("amount"));
  const dayRaw = parseNumber(formData.get("dayOfMonth"));
  if (!name || amount == null || amount <= 0) return;

  await prisma.recurringExpense.create({
    data: {
      name,
      category,
      amount,
      dayOfMonth: clampDay(dayRaw ?? 1),
      description: parseStr(formData.get("description")),
      active: true,
    },
  });
  revalidatePath("/finanzas");
}

export async function updateRecurringExpense(formData: FormData) {
  await requireCeo();
  const id = String(formData.get("id"));
  const name = parseStr(formData.get("name"));
  const amount = parseNumber(formData.get("amount"));
  if (!name || amount == null || amount <= 0) return;

  await prisma.recurringExpense.update({
    where: { id },
    data: {
      name,
      category: parseStr(formData.get("category")) ?? "otros_gasto",
      amount,
      dayOfMonth: clampDay(parseNumber(formData.get("dayOfMonth")) ?? 1),
      description: parseStr(formData.get("description")),
    },
  });
  revalidatePath("/finanzas");
}

export async function toggleRecurringExpenseActive(formData: FormData) {
  await requireCeo();
  const id = String(formData.get("id"));
  const cur = await prisma.recurringExpense.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!cur) return;
  await prisma.recurringExpense.update({
    where: { id },
    data: { active: !cur.active },
  });
  revalidatePath("/finanzas");
}

export async function deleteRecurringExpense(formData: FormData) {
  await requireCeo();
  await prisma.recurringExpense.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/finanzas");
}

// ─── Reglas de compensación del equipo ─────────────────────────

function parseKind(v: FormDataEntryValue | null): string | null {
  const raw = typeof v === "string" ? v.trim() : "";
  const valid = [
    "fixed",
    "percent_of_profit",
    "percent_of_revenue",
    "per_active_client",
    "per_new_client",
    "per_renewal",
  ];
  return valid.includes(raw) ? raw : null;
}

function parseScope(v: FormDataEntryValue | null): string | null {
  const raw = typeof v === "string" ? v.trim() : "";
  return raw === "assigned" || raw === "all" ? raw : null;
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  const raw = parseStr(v);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createCompensationRule(formData: FormData) {
  await requireCeo();
  const professionalId = parseStr(formData.get("professionalId"));
  const kind = parseKind(formData.get("kind"));
  const value = parseNumber(formData.get("value"));
  if (!professionalId || !kind || value == null) return;

  await prisma.compensationRule.create({
    data: {
      professionalId,
      kind,
      value,
      scope: parseScope(formData.get("scope")),
      cap: parseNumber(formData.get("cap")),
      floor: parseNumber(formData.get("floor")),
      startDate: parseDate(formData.get("startDate")),
      endDate: parseDate(formData.get("endDate")),
      notes: parseStr(formData.get("notes")),
      active: true,
    },
  });
  revalidatePath("/finanzas");
}

export async function updateCompensationRule(formData: FormData) {
  await requireCeo();
  const id = String(formData.get("id"));
  const kind = parseKind(formData.get("kind"));
  const value = parseNumber(formData.get("value"));
  if (!kind || value == null) return;

  await prisma.compensationRule.update({
    where: { id },
    data: {
      kind,
      value,
      scope: parseScope(formData.get("scope")),
      cap: parseNumber(formData.get("cap")),
      floor: parseNumber(formData.get("floor")),
      startDate: parseDate(formData.get("startDate")),
      endDate: parseDate(formData.get("endDate")),
      notes: parseStr(formData.get("notes")),
    },
  });
  revalidatePath("/finanzas");
}

export async function toggleCompensationRuleActive(formData: FormData) {
  await requireCeo();
  const id = String(formData.get("id"));
  const cur = await prisma.compensationRule.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!cur) return;
  await prisma.compensationRule.update({
    where: { id },
    data: { active: !cur.active },
  });
  revalidatePath("/finanzas");
}

export async function deleteCompensationRule(formData: FormData) {
  await requireCeo();
  await prisma.compensationRule.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/finanzas");
}

/** Genera un PayrollPayment por cada profesional cuyo cálculo de reglas del
 *  mes dé > 0 € y que todavía no tenga factura para ese periodo. Idempotente
 *  por (professionalId, period) — si ya existe, no la toca.
 */
export async function generatePayrollsForMonth(formData: FormData): Promise<void> {
  await requireCeo();
  const periodRaw = parseStr(formData.get("period"));
  // period es "YYYY-MM"; si no viene usamos el mes actual.
  const now = new Date();
  const period = periodRaw ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return;
  const refDate = new Date(Date.UTC(year, month - 1, 1));

  const { computeCompensationsForMonth } = await import("@/lib/compensation");
  const rows = await computeCompensationsForMonth(refDate);

  const existing = await prisma.payrollPayment.findMany({
    where: { period, professionalId: { in: rows.map((r) => r.professionalId) } },
    select: { professionalId: true },
  });
  const already = new Set(existing.map((e) => e.professionalId));

  let created = 0;
  for (const r of rows) {
    if (r.total <= 0) continue;
    if (already.has(r.professionalId)) continue;
    const concept = r.rules.map((e) => e.note).join(" + ");
    await prisma.payrollPayment.create({
      data: {
        professionalId: r.professionalId,
        period,
        amount: r.total,
        concept: concept.slice(0, 400),
        notes: "Generado automáticamente desde reglas de compensación.",
      },
    });
    created++;
  }
  revalidatePath("/finanzas");
}

// ─── Configuración fiscal ───────────────────────────────────────

export async function updateTaxSettings(formData: FormData) {
  await requireCeo();
  const vatRate = parseNumber(formData.get("vatRate"));
  const irpfIncomeRate = parseNumber(formData.get("irpfIncomeRate"));
  const irpfQuarterlyRate = parseNumber(formData.get("irpfQuarterlyRate"));
  const vatExempt = String(formData.get("vatExempt")) === "1";
  const notes = parseStr(formData.get("notes"));

  await prisma.taxSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      vatRate: vatRate ?? 21,
      vatExempt,
      irpfIncomeRate: irpfIncomeRate ?? 15,
      irpfQuarterlyRate: irpfQuarterlyRate ?? 20,
      notes,
    },
    update: {
      vatRate: vatRate ?? 21,
      vatExempt,
      irpfIncomeRate: irpfIncomeRate ?? 15,
      irpfQuarterlyRate: irpfQuarterlyRate ?? 20,
      notes,
    },
  });
  revalidatePath("/finanzas");
}
