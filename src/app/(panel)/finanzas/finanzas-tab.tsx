import { Plus, Trash2, CheckCircle2, Clock, Repeat, Receipt, Eye, EyeOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYROLL_STATUSES,
  TRANSACTION_TYPES,
  categoryLabel,
  fmtEur,
  marginPct,
  monthKey,
  monthLabel,
  payrollStatusBadgeClass,
} from "@/lib/finance";
import { Field, Select, TextInput } from "@/components/form-ui";
import { ensureRecurringExpensesForMonth } from "@/lib/recurringExpenses";
import { getTaxSettings, monthTaxEstimate, quarterTaxEstimate } from "@/lib/taxes";
import {
  createPayroll,
  createRecurringExpense,
  createTransaction,
  deletePayroll,
  deleteRecurringExpense,
  deleteTransaction,
  markPayrollPaid,
  toggleRecurringExpenseActive,
  updateRecurringExpense,
  updateTaxSettings,
} from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function FinanzasTab() {
  // Antes de leer, nos aseguramos de materializar los gastos fijos del mes
  // en curso. Idempotente — el unique (recurringExpenseId, periodKey) evita
  // duplicados.
  await ensureRecurringExpensesForMonth();

  const now = new Date();
  const [
    transactions,
    payrolls,
    professionals,
    recurring,
    taxCfg,
    monthEstimate,
    quarterEstimate,
  ] = await Promise.all([
    prisma.transaction.findMany({ orderBy: { date: "desc" }, take: 100 }),
    prisma.payrollPayment.findMany({
      orderBy: [{ status: "asc" }, { period: "desc" }, { createdAt: "desc" }],
      include: { professional: { select: { fullName: true } } },
    }),
    prisma.professional.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.recurringExpense.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    getTaxSettings(),
    monthTaxEstimate(now),
    quarterTaxEstimate(now),
  ]);

  const profOptions = professionals.map((p) => ({ value: p.id, label: p.fullName }));
  const expenseCatOptions = EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));
  const thisMonth = monthKey(now);
  const quarterNumber = Math.floor(now.getUTCMonth() / 3) + 1;
  const margin = marginPct(monthEstimate.period.ingresos, monthEstimate.period.gastos);

  return (
    <div className="space-y-10">
      {/* ── Resumen fiscal del periodo ─────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Resumen fiscal</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted">
              Mes · {monthLabel(thisMonth)}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FiscalCell label="Ingresos" value={fmtEur(monthEstimate.period.ingresos, 2)} />
              <FiscalCell label="Gastos" value={fmtEur(monthEstimate.period.gastos, 2)} />
              <FiscalCell
                label="Beneficio bruto"
                value={fmtEur(monthEstimate.period.base, 2)}
                emphasis={monthEstimate.period.base >= 0 ? "pos" : "neg"}
              />
              <FiscalCell
                label="Margen"
                value={margin == null ? "—" : `${margin.toLocaleString("es-ES")}%`}
                emphasis={margin != null && margin >= 0 ? "pos" : "neg"}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
              <FiscalCell
                label={`IVA repercutido ${taxCfg.vatExempt ? "(exento)" : `(${taxCfg.vatRate}%)`}`}
                value={fmtEur(monthEstimate.vatOwed, 2)}
                emphasis="muted"
              />
              <FiscalCell
                label={`IRPF retenido (${taxCfg.irpfIncomeRate}%)`}
                value={fmtEur(monthEstimate.irpfWithheld, 2)}
                emphasis="muted"
              />
              <FiscalCell
                label="Neto estimado"
                value={fmtEur(monthEstimate.netAfterTaxes, 2)}
                emphasis={monthEstimate.netAfterTaxes >= 0 ? "pos" : "neg"}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted">
              Trimestre · Q{quarterNumber} {now.getUTCFullYear()}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FiscalCell label="Ingresos" value={fmtEur(quarterEstimate.period.ingresos, 2)} />
              <FiscalCell label="Gastos" value={fmtEur(quarterEstimate.period.gastos, 2)} />
              <FiscalCell
                label="Beneficio bruto"
                value={fmtEur(quarterEstimate.period.base, 2)}
                emphasis={quarterEstimate.period.base >= 0 ? "pos" : "neg"}
              />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted">
                Pago fraccionado estimado · modelo 130
              </p>
              <p className="text-2xl font-bold text-primary">
                {fmtEur(quarterEstimate.irpfQuarterly, 2)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {taxCfg.irpfQuarterlyRate}% de {fmtEur(quarterEstimate.period.base, 2)} − retenciones ya practicadas (
                {fmtEur(quarterEstimate.irpfWithheld, 2)}).
              </p>
            </div>
          </div>
        </div>

        {/* Configuración fiscal plegable */}
        <details className="mt-4 rounded-2xl border border-dashed border-border bg-surface/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            ⚙️ Configuración fiscal
          </summary>
          <form action={updateTaxSettings} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="IVA (%)" htmlFor="vatRate">
              <TextInput
                id="vatRate"
                name="vatRate"
                inputMode="decimal"
                defaultValue={String(taxCfg.vatRate)}
              />
            </Field>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="vatExempt"
                  value="1"
                  defaultChecked={taxCfg.vatExempt}
                  className="rounded border-border text-primary"
                />
                Servicio exento de IVA (art. 20 LIVA)
              </label>
            </div>
            <Field label="Retención IRPF ingresos (%)" htmlFor="irpfIncomeRate">
              <TextInput
                id="irpfIncomeRate"
                name="irpfIncomeRate"
                inputMode="decimal"
                defaultValue={String(taxCfg.irpfIncomeRate)}
              />
            </Field>
            <Field label="Pago fraccionado modelo 130 (%)" htmlFor="irpfQuarterlyRate">
              <TextInput
                id="irpfQuarterlyRate"
                name="irpfQuarterlyRate"
                inputMode="decimal"
                defaultValue={String(taxCfg.irpfQuarterlyRate)}
              />
            </Field>
            <div className="sm:col-span-4">
              <Field label="Notas" htmlFor="notes">
                <TextInput
                  id="notes"
                  name="notes"
                  defaultValue={taxCfg.notes ?? ""}
                  placeholder="Supuesto fiscal, tipo de actividad…"
                />
              </Field>
            </div>
            <div className="sm:col-span-4 flex justify-end">
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90">
                Guardar configuración
              </button>
            </div>
          </form>
          <p className="mt-2 text-[11px] text-muted">
            La estimación es orientativa. Confirma con tu asesor para el cierre real.
          </p>
        </details>
      </section>

      {/* ── Gastos fijos mensuales ─────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Repeat size={18} className="text-primary" /> Gastos fijos mensuales
          </h2>
          <p className="text-xs text-muted">
            Se añaden solos al mes en curso cuando llega el día configurado.
          </p>
        </div>

        <form action={createRecurringExpense} className="mb-5 rounded-2xl border border-border bg-surface p-5">
          <p className="mb-3 text-sm font-semibold">Añadir gasto fijo</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Nombre" htmlFor="rec_name">
              <TextInput id="rec_name" name="name" placeholder="Ej. Vercel Pro" required />
            </Field>
            <Field label="Categoría" htmlFor="rec_category">
              <Select
                id="rec_category"
                name="category"
                options={expenseCatOptions}
                placeholder="Elegir"
              />
            </Field>
            <Field label="Importe (€)" htmlFor="rec_amount">
              <TextInput id="rec_amount" name="amount" inputMode="decimal" required />
            </Field>
            <Field label="Día del mes" htmlFor="rec_dayOfMonth" hint="1-28">
              <TextInput id="rec_dayOfMonth" name="dayOfMonth" inputMode="numeric" defaultValue="1" />
            </Field>
            <Field label="Descripción" htmlFor="rec_description">
              <TextInput id="rec_description" name="description" placeholder="Opcional" />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90">
              <Plus size={16} /> Añadir
            </button>
          </div>
        </form>

        {recurring.length === 0 ? (
          <p className="text-sm text-muted">No tienes gastos fijos todavía.</p>
        ) : (
          <ul className="space-y-2">
            {recurring.map((r) => (
              <li
                key={r.id}
                className={`rounded-2xl border p-4 ${
                  r.active ? "border-border bg-surface" : "border-dashed border-border bg-bg/40 opacity-70"
                }`}
              >
                <form action={updateRecurringExpense} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.6fr_1.4fr_auto]">
                  <input type="hidden" name="id" value={r.id} />
                  <TextInput name="name" defaultValue={r.name} required />
                  <Select
                    name="category"
                    options={expenseCatOptions}
                    defaultValue={r.category}
                  />
                  <TextInput name="amount" defaultValue={String(r.amount)} inputMode="decimal" />
                  <TextInput name="dayOfMonth" defaultValue={String(r.dayOfMonth)} inputMode="numeric" />
                  <TextInput name="description" defaultValue={r.description ?? ""} placeholder="Descripción" />
                  <div className="flex items-center gap-1">
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span>
                    {categoryLabel(r.category)} · día {r.dayOfMonth} del mes · {fmtEur(r.amount, 2)} / mes
                  </span>
                  <div className="flex items-center gap-1">
                    <form action={toggleRecurringExpenseActive}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        title={r.active ? "Desactivar (deja de generarse)" : "Reactivar"}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium hover:bg-surface-2"
                      >
                        {r.active ? <Eye size={12} /> : <EyeOff size={12} />}
                        {r.active ? "Activo" : "Inactivo"}
                      </button>
                    </form>
                    <form action={deleteRecurringExpense}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-md p-1 text-muted hover:text-red-600" title="Borrar">
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Movimientos ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Movimientos</h2>

        {/* Alta de movimiento */}
        <form action={createTransaction} className="mb-5 rounded-2xl border border-border bg-surface p-5">
          <p className="mb-3 text-sm font-semibold">Añadir movimiento</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Tipo" htmlFor="type">
              <Select id="type" name="type" options={TRANSACTION_TYPES} placeholder="Ingreso o gasto" />
            </Field>
            <Field label="Fecha" htmlFor="date">
              <TextInput id="date" name="date" type="date" defaultValue={todayIso()} />
            </Field>
            <Field label="Categoría" htmlFor="category">
              <Select id="category" name="category" options={ALL_CATEGORIES} />
            </Field>
            <Field label="Importe (€)" htmlFor="amount">
              <TextInput id="amount" name="amount" inputMode="decimal" required />
            </Field>
            <Field label="Descripción" htmlFor="description">
              <TextInput id="description" name="description" />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">
            Ingresos típicos: pago de cliente · renovación · otros. Gastos típicos: publicidad, sueldos, software,
            herramientas, impuestos.
          </p>
          <div className="mt-3 flex justify-end">
            <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90">
              <Plus size={16} /> Añadir
            </button>
          </div>
        </form>

        {transactions.length === 0 ? (
          <p className="text-sm text-muted">Sin movimientos todavía.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 text-right font-medium">Importe</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-muted">{t.date.toLocaleDateString("es-ES")}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.type === "ingreso" ? "bg-[#e7f6ec] text-[#15803d]" : "bg-[#fdecd9] text-[#b45309]"
                        }`}
                      >
                        {t.type === "ingreso" ? "Ingreso" : "Gasto"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{categoryLabel(t.category)}</td>
                    <td className="px-4 py-2.5">{t.description ?? "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${t.type === "ingreso" ? "text-[#15803d]" : "text-[#b45309]"}`}>
                      {t.type === "ingreso" ? "+" : "−"} {fmtEur(t.amount, 2)}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <form action={deleteTransaction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Facturas del equipo ──────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Facturas del equipo</h2>

        {professionals.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay miembros del equipo.</p>
        ) : (
          <form action={createPayroll} className="mb-5 rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-sm font-semibold">Añadir factura</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Miembro del equipo" htmlFor="professionalId">
                <Select id="professionalId" name="professionalId" options={profOptions} placeholder="Selecciona" />
              </Field>
              <Field label="Mes facturado" htmlFor="period" hint="Formato AAAA-MM">
                <TextInput id="period" name="period" placeholder="2026-05" defaultValue={currentPeriod()} required />
              </Field>
              <Field label="Importe (€)" htmlFor="amount">
                <TextInput id="amount" name="amount" inputMode="decimal" required />
              </Field>
              <Field label="Concepto" htmlFor="concept">
                <TextInput id="concept" name="concept" placeholder="Honorarios de mayo" />
              </Field>
              <Field label="URL de la factura" htmlFor="invoiceUrl" hint="Opcional">
                <TextInput id="invoiceUrl" name="invoiceUrl" type="url" placeholder="https://…" />
              </Field>
              <Field label="Notas" htmlFor="notes">
                <TextInput id="notes" name="notes" />
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90">
                <Plus size={16} /> Añadir factura
              </button>
            </div>
          </form>
        )}

        {payrolls.length === 0 ? (
          <p className="text-sm text-muted">Sin facturas registradas.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Miembro</th>
                  <th className="px-4 py-3 font-medium">Mes</th>
                  <th className="px-4 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 text-right font-medium">Importe</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{p.professional.fullName}</td>
                    <td className="px-4 py-2.5 text-muted">{monthLabel(p.period)}</td>
                    <td className="px-4 py-2.5">
                      {p.concept ?? "—"}
                      {p.invoiceUrl && (
                        <>
                          {" · "}
                          <a href={p.invoiceUrl} target="_blank" rel="noopener" className="text-primary underline">
                            Factura
                          </a>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtEur(p.amount, 2)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${payrollStatusBadgeClass(p.status)}`}>
                        {PAYROLL_STATUSES.find((s) => s.value === p.status)?.label ?? p.status}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-1">
                        <form action={markPayrollPaid}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            title={p.status === "pagado" ? "Marcar pendiente" : "Marcar pagada (crea movimiento)"}
                            className="rounded-lg p-1.5 text-muted hover:bg-primary-soft hover:text-primary"
                          >
                            {p.status === "pagado" ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                          </button>
                        </form>
                        <form action={deletePayroll}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={15} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border bg-surface-2 px-4 py-2 text-xs text-muted">
              Al marcar una factura como <span className="font-medium text-text">pagada</span> se crea
              automáticamente un movimiento de gasto en la categoría "Sueldos / equipo".
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function FiscalCell({
  label,
  value,
  emphasis = "neutral",
}: {
  label: string;
  value: string;
  emphasis?: "pos" | "neg" | "muted" | "neutral";
}) {
  const color =
    emphasis === "pos"
      ? "text-[#15803d]"
      : emphasis === "neg"
      ? "text-[#b45309]"
      : emphasis === "muted"
      ? "text-muted"
      : "text-text";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-base font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
