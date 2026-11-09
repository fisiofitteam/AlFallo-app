import { Plus, Trash2, Users, Sparkles, Eye, EyeOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtEur } from "@/lib/finance";
import { currentMadridYmd, type FinanceRange } from "@/lib/compensation-range";
import {
  COMPENSATION_KINDS,
  COMPENSATION_SCOPES,
  compensationKindLabel,
  computeCompensationsForRange,
} from "@/lib/compensation";
import { Select, TextInput } from "@/components/form-ui";
import {
  createCompensationRule,
  deleteCompensationRule,
  generatePayrollsForMonth,
  toggleCompensationRuleActive,
  updateCompensationRule,
} from "./actions";

const kindOptions = COMPENSATION_KINDS.map((k) => ({ value: k.value, label: k.label }));
const scopeOptions = COMPENSATION_SCOPES.map((s) => ({ value: s.value, label: s.label }));

function dateInput(d: Date | null | undefined): string {
  if (!d) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function EquipoTab({ range }: { range: FinanceRange }) {
  const periodKey = range.fullMonthKey;
  const [professionals, computed, existingPayrolls] = await Promise.all([
    prisma.professional.findMany({
      where: { isActive: true },
      select: {
        id: true, fullName: true, role: true,
        compensationRules: { orderBy: [{ active: "desc" }, { createdAt: "asc" }] },
      },
      orderBy: { fullName: "asc" },
    }),
    computeCompensationsForRange(range),
    periodKey
      ? prisma.payrollPayment.findMany({ where: { period: periodKey }, select: { professionalId: true } })
      : Promise.resolve([]),
  ]);
  const { compensations, totals } = computed;
  const nowMadrid = currentMadridYmd();
  const previousMonthEnd = new Date(Date.parse(`${nowMadrid.slice(0,7)}-01T00:00:00.000Z`) - 86_400_000).toISOString().slice(0,10);
  const monthBefore = `${previousMonthEnd.slice(0,7)}-01`;
  const monthThis = `${nowMadrid.slice(0,7)}-01`;
  const last30From = new Date(Date.parse(`${nowMadrid}T00:00:00.000Z`) - 29 * 86_400_000).toISOString().slice(0,10);
  const thisMonthUrl = `/finanzas?tab=equipo&from=${monthThis}&to=${new Date(Date.UTC(Number(nowMadrid.slice(0,4)),Number(nowMadrid.slice(5,7)),0)).toISOString().slice(0,10)}`;
  const previousMonthUrl = `/finanzas?tab=equipo&from=${monthBefore}&to=${previousMonthEnd}`;
  const last30Url = `/finanzas?tab=equipo&from=${last30From}&to=${nowMadrid}`;

  const compMap = new Map(compensations.map((c) => [c.professionalId, c]));
  const payrollMap = new Set(existingPayrolls.map((p) => p.professionalId));
  const grandTotal = compensations.reduce((s, c) => s + c.total, 0);
  const pendingToGenerate = periodKey ? compensations.filter(
    (c) => c.total > 0 && !payrollMap.has(c.professionalId),
  ) : [];

  return (
    <div className="space-y-8">
      {/* El intervalo solo afecta al informe, no modifica pagos ni reglas. */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">Período de cálculo del equipo</h2>
            <p className="mt-1 text-xs text-muted">Selecciona cualquier intervalo (hasta dos años). Todos los importes inferiores se recalculan con esas fechas.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <a href={thisMonthUrl} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-surface-2">Este mes</a>
            <a href={previousMonthUrl} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-surface-2">Mes anterior</a>
            <a href={last30Url} className="rounded-lg border border-border px-2.5 py-1.5 font-semibold hover:bg-surface-2">Últimos 30 días</a>
          </div>
        </div>
        <form method="GET" action="/finanzas" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value="equipo" />
          <label className="flex min-w-[155px] flex-col gap-1 text-xs font-semibold">Desde
            <input type="date" name="from" required defaultValue={range.from} min="2000-01-01" max="2100-12-31" className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text" />
          </label>
          <label className="flex min-w-[155px] flex-col gap-1 text-xs font-semibold">Hasta (inclusive)
            <input type="date" name="to" required defaultValue={range.to} min="2000-01-01" max="2100-12-31" className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text" />
          </label>
          <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90">Aplicar fechas</button>
        </form>
        {range.validationError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{range.validationError} Se muestra el mes actual.</p>}
        <p className="mt-3 text-xs font-semibold text-primary">Mostrando: {range.label}</p>
      </section>

      {/* Resumen del intervalo seleccionado */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Users size={18} className="text-primary" /> Compensación del equipo ·{" "}
            {range.label}
          </h2>
          {periodKey ? (
            <form action={generatePayrollsForMonth}>
              <input type="hidden" name="period" value={periodKey} />
              <button
                type="submit" disabled={pendingToGenerate.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
                title={pendingToGenerate.length === 0 ? "No hay facturas pendientes de este mes" : "Generar facturas del mes completo seleccionado"}
              >
                <Sparkles size={14} /> Generar facturas del mes ({pendingToGenerate.length})
              </button>
            </form>
          ) : (
            <span className="rounded-lg border border-border bg-bg/40 px-3 py-2 text-xs text-muted">Facturas: selecciona un mes completo para generarlas</span>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Cell label="Ingresos del período" value={fmtEur(totals.revenue, 2)} />
            <Cell label="Gastos del período" value={fmtEur(totals.expenses, 2)} />
            <Cell label="Beneficio bruto" value={fmtEur(totals.profit, 2)} emphasis={totals.profit >= 0 ? "pos" : "neg"} />
            <Cell label="Total a pagar al equipo" value={fmtEur(grandTotal, 2)} emphasis="primary" />
          </div>
          <p className="text-[11px] text-muted">
            Nuevas altas del período: <strong>{totals.newClients.all}</strong> · Renovaciones:{" "}
            <strong>{totals.renewals.all}</strong> · Clientes activos hoy:{" "}
            <strong>{totals.activeClients.all}</strong>.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Los fijos mensuales y los importes por cliente activo se prorratean por días de cada mes cuando corresponde.
            Las comisiones sobre operaciones usan sus fechas reales. Los activos y las asignaciones de nutricionista
            se calculan con el estado actual, porque todavía no disponemos de un histórico de esos cambios.
            Los totales son estimaciones conforme a las reglas vigentes hoy; las facturas ya generadas no se recalculan.
          </p>
        </div>
      </section>

      {/* Lista de profesionales con sus reglas */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Reglas por miembro del equipo
        </h2>
        {professionals.length === 0 ? (
          <p className="text-sm text-muted">No hay miembros del equipo activos.</p>
        ) : (
          <ul className="space-y-3">
            {professionals.map((p) => {
              const comp = compMap.get(p.id);
              const total = comp?.total ?? 0;
              const alreadyGenerated = payrollMap.has(p.id);
              return (
                <li
                  key={p.id}
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{p.fullName}</p>
                      <p className="text-[11px] text-muted">
                        {p.role} · {p.compensationRules.length} regla(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        Período seleccionado
                      </p>
                      <p className="text-xl font-bold text-primary">
                        {fmtEur(total, 2)}
                      </p>
                      {periodKey && alreadyGenerated ? (
                        <p className="text-[10px] text-emerald-700">Factura ya generada</p>
                      ) : null}
                    </div>
                  </header>

                  {/* Desglose de reglas aplicadas al intervalo */}
                  {comp && comp.rules.length > 0 ? (
                    <ul className="mb-3 space-y-0.5 rounded-xl bg-bg/50 p-3 text-[11px]">
                      {comp.rules.map((e) => (
                        <li key={e.ruleId} className="flex items-center justify-between gap-2">
                          <span className="text-muted">{e.note}</span>
                          <span className="font-semibold tabular-nums">
                            {fmtEur(e.amount, 2)}
                            {e.amount !== e.gross ? (
                              <span className="ml-1 text-[10px] text-muted">
                                (bruto {fmtEur(e.gross, 2)})
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {/* Lista editable de reglas */}
                  {p.compensationRules.length > 0 ? (
                    <ul className="mb-3 space-y-2">
                      {p.compensationRules.map((r) => (
                        <li
                          key={r.id}
                          className={`rounded-xl border p-3 ${
                            r.active ? "border-border bg-bg/40" : "border-dashed border-border bg-bg/20 opacity-70"
                          }`}
                        >
                          <form
                            action={updateCompensationRule}
                            className="grid grid-cols-1 gap-2 sm:grid-cols-[1.3fr_0.8fr_1fr_1fr_1fr_1fr_1fr_auto]"
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <Select
                              name="kind"
                              options={kindOptions}
                              defaultValue={r.kind}
                            />
                            <TextInput
                              name="value"
                              inputMode="decimal"
                              defaultValue={String(r.value)}
                              placeholder="Importe o %"
                              required
                            />
                            <Select
                              name="scope"
                              options={scopeOptions}
                              defaultValue={r.scope ?? "all"}
                              placeholder="Alcance"
                            />
                            <TextInput
                              name="floor"
                              inputMode="decimal"
                              defaultValue={r.floor != null ? String(r.floor) : ""}
                              placeholder="Mínimo €"
                            />
                            <TextInput
                              name="cap"
                              inputMode="decimal"
                              defaultValue={r.cap != null ? String(r.cap) : ""}
                              placeholder="Tope €"
                            />
                            <TextInput
                              name="startDate"
                              type="date"
                              defaultValue={dateInput(r.startDate)}
                            />
                            <TextInput
                              name="endDate"
                              type="date"
                              defaultValue={dateInput(r.endDate)}
                            />
                            <div className="flex items-center gap-1">
                              <button
                                type="submit"
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
                              >
                                Guardar
                              </button>
                            </div>
                          </form>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted">
                            <span>
                              {compensationKindLabel(r.kind)}
                              {r.notes ? ` · ${r.notes}` : ""}
                            </span>
                            <div className="flex items-center gap-1">
                              <form action={toggleCompensationRuleActive}>
                                <input type="hidden" name="id" value={r.id} />
                                <button
                                  type="submit"
                                  title={r.active ? "Desactivar" : "Reactivar"}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-surface-2"
                                >
                                  {r.active ? <Eye size={11} /> : <EyeOff size={11} />}
                                  {r.active ? "Activa" : "Inactiva"}
                                </button>
                              </form>
                              <form action={deleteCompensationRule}>
                                <input type="hidden" name="id" value={r.id} />
                                <button className="rounded-md p-1 hover:text-red-600" title="Borrar regla">
                                  <Trash2 size={13} />
                                </button>
                              </form>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mb-3 text-xs italic text-muted">Sin reglas todavía.</p>
                  )}

                  {/* Alta rápida */}
                  <form
                    action={createCompensationRule}
                    className="rounded-xl border border-dashed border-border bg-bg/30 p-3"
                  >
                    <input type="hidden" name="professionalId" value={p.id} />
                    <p className="mb-2 text-[11px] font-semibold text-muted">Añadir regla</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.3fr_0.8fr_1fr_1fr_1fr_auto]">
                      <Select name="kind" options={kindOptions} placeholder="Tipo" />
                      <TextInput
                        name="value"
                        inputMode="decimal"
                        placeholder="Importe o %"
                        required
                      />
                      <Select name="scope" options={scopeOptions} placeholder="Alcance" />
                      <TextInput name="floor" inputMode="decimal" placeholder="Mínimo €" />
                      <TextInput name="cap" inputMode="decimal" placeholder="Tope €" />
                      <button className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90">
                        <Plus size={12} /> Añadir
                      </button>
                    </div>
                    <div className="mt-2">
                      <TextInput name="notes" placeholder="Notas (opcional)" />
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Cell({
  label,
  value,
  emphasis = "neutral",
}: {
  label: string;
  value: string;
  emphasis?: "pos" | "neg" | "primary" | "neutral";
}) {
  const color =
    emphasis === "pos"
      ? "text-[#15803d]"
      : emphasis === "neg"
      ? "text-[#b45309]"
      : emphasis === "primary"
      ? "text-primary"
      : "text-text";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
