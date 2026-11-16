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
  monthLabel,
  payrollStatusBadgeClass,
} from "@/lib/finance";
import { Field, Select, TextInput } from "@/components/form-ui";
import { ensureRecurringExpensesForMonth } from "@/lib/recurringExpenses";
import { withHeartbeatCache } from "@/lib/heartbeat-cache";
import { getTaxSettings, estimateTaxes, totalsInRange } from "@/lib/taxes";
import { currentMadridYmd, resolveFinanceRange, type FinanceRange } from "@/lib/compensation-range";
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

const MOVEMENT_PAGE_SIZE = 100;

function minusDays(ymd: string, numberOfDays: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00.000Z`) - numberOfDays * 86400_000)
    .toISOString().slice(0, 10);
}

function lastDayOfMonth(ymd: string): string {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function financeUrl(from: string, to: string, movementPage?: number): string {
  const params = new URLSearchParams({ tab: "finanzas", from, to });
  if (movementPage && movementPage > 1) params.set("movementPage", String(movementPage));
  return `/finanzas?${params.toString()}`;
}

export async function FinanzasTab({
  range, movementPage,
}: { range: FinanceRange; movementPage?: string }) {
  // Conservamos la materialización mensual de gastos recurrentes existente
  // (idempotente). El filtro nunca crea movimientos para períodos históricos.
  const now = new Date();
  await withHeartbeatCache(
    `recurring-expenses:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`,
    5 * 60 * 1000,
    () => ensureRecurringExpensesForMonth(now),
  );

  const endYear = Number(range.to.slice(0, 4));
  const endMonth = Number(range.to.slice(5, 7));
  const quarterNumber = Math.floor((endMonth - 1) / 3) + 1;
  const quarterStartMonth = String((quarterNumber - 1) * 3 + 1).padStart(2, "0");
  const quarterFrom = `${endYear}-${quarterStartMonth}-01`;
  const quarterTo = new Date(Date.UTC(endYear, quarterNumber * 3, 0)).toISOString().slice(0, 10);
  const quarterRange = resolveFinanceRange({ from: quarterFrom, to: quarterTo });

  const requestedPage = Number(movementPage ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 10000) : 1;
  const movementWhere = { date: { gte: range.fromDate, lt: range.toExclusive } };

  const [
    transactions,
    movementCount,
    payrolls,
    professionals,
    recurring,
    taxCfg,
    selectedTotals,
    quarterTotals,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: movementWhere,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (page - 1) * MOVEMENT_PAGE_SIZE,
      take: MOVEMENT_PAGE_SIZE,
    }),
    prisma.transaction.count({ where: movementWhere }),
    prisma.payrollPayment.findMany({
      where: { period: { gte: range.from.slice(0, 7), lte: range.to.slice(0, 7) } },
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
    totalsInRange(range.fromDate, range.toExclusive),
    totalsInRange(quarterRange.fromDate, quarterRange.toExclusive),
  ]);

  const profOptions = professionals.map((p) => ({ value: p.id, label: p.fullName }));
  const expenseCatOptions = EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));
  const selectedEstimate = estimateTaxes(selectedTotals, taxCfg);
  const quarterEstimate = estimateTaxes(quarterTotals, taxCfg);
  const margin = marginPct(selectedTotals.ingresos, selectedTotals.gastos);
  const todayMadrid = currentMadridYmd(now);
  const monthFrom = `${todayMadrid.slice(0, 7)}-01`;
  const monthTo = lastDayOfMonth(todayMadrid);
  const prevMonthTo = minusDays(monthFrom, 1);
  const prevMonthFrom = `${prevMonthTo.slice(0, 7)}-01`;
  const last30From = minusDays(todayMadrid, 29);
  const currentQuarter = Math.floor((Number(todayMadrid.slice(5, 7)) - 1) / 3) + 1;
  const quarterThisYear = Number(todayMadrid.slice(0, 4));
  const quarterThisFrom = `${quarterThisYear}-${String((currentQuarter - 1) * 3 + 1).padStart(2, "0")}-01`;
  const quarterThisTo = new Date(Date.UTC(quarterThisYear, currentQuarter * 3, 0)).toISOString().slice(0, 10);
  const quarterIsSelected = range.from === quarterRange.from && range.to === quarterRange.to;

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Período de consulta de Finanzas</h2>
            <p className="mt-1 text-xs text-muted">Filtra el resumen económico, los movimientos y las facturas por las fechas seleccionadas.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <a href={financeUrl(monthFrom, monthTo)} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-surface-2">Este mes</a>
            <a href={financeUrl(prevMonthFrom, prevMonthTo)} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-surface-2">Mes anterior</a>
            <a href={financeUrl(last30From, todayMadrid)} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-surface-2">Últimos 30 días</a>
            <a href={financeUrl(quarterThisFrom, quarterThisTo)} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-surface-2">Trimestre actual</a>
          </div>
        </div>
        <form method="GET" action="/finanzas" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value="finanzas" />
          <label className="flex min-w-[155px] flex-col gap-1 text-xs font-semibold">Desde
            <input type="date" name="from" required min="2000-01-01" max="2100-12-31" defaultValue={range.from} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text" />
          </label>
          <label className="flex min-w-[155px] flex-col gap-1 text-xs font-semibold">Hasta (inclusive)
            <input type="date" name="to" required min="2000-01-01" max="2100-12-31" defaultValue={range.to} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text" />
          </label>
          <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90">Aplicar fechas</button>
        </form>
        {range.validationError && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {range.validationError} Se muestra el mes actual.
          </p>
        )}
        <p className="mt-3 text-xs font-semibold text-primary">Mostrando: {range.label}</p>
      </section>

      {/* ── Resumen fiscal del periodo ─────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Resumen fiscal</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted">
              Período seleccionado · {range.label}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FiscalCell label="Ingresos" value={fmtEur(selectedEstimate.period.ingresos, 2)} />
              <FiscalCell label="Gastos" value={fmtEur(selectedEstimate.period.gastos, 2)} />
              <FiscalCell
                label="Beneficio bruto"
                value={fmtEur(selectedEstimate.period.base, 2)}
                emphasis={selectedEstimate.period.base >= 0 ? "pos" : "neg"}
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
                value={fmtEur(selectedEstimate.vatOwed, 2)}
                emphasis="muted"
              />
              <FiscalCell
                label={`IRPF retenido (${taxCfg.irpfIncomeRate}%)`}
                value={fmtEur(selectedEstimate.irpfWithheld, 2)}
                emphasis="muted"
              />
              <FiscalCell
                label="Neto estimado"
                value={fmtEur(selectedEstimate.netAfterTaxes, 2)}
                emphasis={selectedEstimate.netAfterTaxes >= 0 ? "pos" : "neg"}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted">
              Trimestre fiscal de referencia · Q{quarterNumber} {endYear}
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
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                {quarterIsSelected
                  ? "Has seleccionado el trimestre completo."
                  : `Esta tarjeta muestra el trimestre natural Q${quarterNumber} ${endYear}, que contiene la fecha «Hasta». No es una cuota calculada para el intervalo personalizado.`}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Los importes del período se basan en movimientos registrados según la fecha de España peninsular.
          Los cálculos de IVA, retenciones y neto son estimaciones con la configuración fiscal actual;
          no sustituyen la liquidación oficial ni contemplan todos los ajustes fiscales posibles.
        </p>

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
            Configuración general (no se filtra por fechas). Los cargos registrados aparecen en Movimientos.
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Movimientos</h2>
          <p className="text-xs text-muted">{movementCount} movimiento(s) en el período · {MOVEMENT_PAGE_SIZE} por página</p>
        </div>

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
          <div className="rounded-xl border border-border p-4 text-sm text-muted">
            {movementCount ? "No hay movimientos en esta página del intervalo." : "No hay movimientos registrados en las fechas seleccionadas."}
            {movementCount > 0 && <a className="ml-2 font-semibold text-primary underline" href={financeUrl(range.from, range.to)}>Ir a la primera página</a>}
          </div>
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
                    <td className="px-4 py-2.5 text-muted">{t.date.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}</td>
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
            {movementCount > MOVEMENT_PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-2 px-4 py-3 text-xs">
                <span className="text-muted">Página {page} de {Math.ceil(movementCount / MOVEMENT_PAGE_SIZE)}</span>
                <div className="flex gap-2">
                  {page > 1 && <a href={financeUrl(range.from, range.to, page - 1)} className="rounded-lg border border-border bg-white px-3 py-1.5 font-medium hover:bg-surface">Anterior</a>}
                  {page * MOVEMENT_PAGE_SIZE < movementCount && <a href={financeUrl(range.from, range.to, page + 1)} className="rounded-lg border border-border bg-white px-3 py-1.5 font-medium hover:bg-surface">Siguiente</a>}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Facturas del equipo ──────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-lg font-bold">Facturas del equipo</h2>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Se muestran las facturas de los meses naturales que coincidan con el intervalo seleccionado
          ({range.from.slice(0, 7)} a {range.to.slice(0, 7)}). La factura de un mes es indivisible,
          aunque hayas seleccionado solo algunos días. No se recalculan importes ni se alteran estados.
        </p>

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
          <p className="text-sm text-muted">Sin facturas de los meses seleccionados.</p>
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
