import { Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYROLL_STATUSES,
  TRANSACTION_TYPES,
  categoryLabel,
  fmtEur,
  monthLabel,
  payrollStatusBadgeClass,
} from "@/lib/finance";
import { Field, Select, TextInput } from "@/components/form-ui";
import {
  createPayroll,
  createTransaction,
  deletePayroll,
  deleteTransaction,
  markPayrollPaid,
} from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function FinanzasTab() {
  const [transactions, payrolls, professionals] = await Promise.all([
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
  ]);

  const profOptions = professionals.map((p) => ({ value: p.id, label: p.fullName }));

  return (
    <div className="space-y-10">
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
