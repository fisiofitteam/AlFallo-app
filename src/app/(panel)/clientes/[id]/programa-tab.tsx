import { Wallet, Calendar, Coins, Check, Clock, ChevronDown, Trash2, Plus } from "lucide-react";
import type { SubscriptionPeriod } from "@prisma/client";
import { periodProgress } from "@/lib/subscriptions";
import {
  createSubscriptionPeriod,
  deleteSubscriptionPeriod,
  updateSubscriptionPeriod,
} from "../actions";

const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "manual", label: "Manual / efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "bizum", label: "Bizum" },
  { value: "stripe", label: "Stripe" },
  { value: "paypal", label: "PayPal" },
  { value: "otro", label: "Otro" },
];

const STATUS_OPTIONS: { value: string; label: string; tone: string }[] = [
  { value: "active", label: "Activo", tone: "bg-emerald-100 text-emerald-800" },
  { value: "scheduled", label: "Programado", tone: "bg-blue-100 text-blue-800" },
  { value: "finished", label: "Finalizado", tone: "bg-neutral-100 text-neutral-700" },
  { value: "lost", label: "Perdido", tone: "bg-rose-100 text-rose-800" },
];

function statusTone(value: string): string {
  return STATUS_OPTIONS.find((s) => s.value === value)?.tone ?? STATUS_OPTIONS[2].tone;
}
function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ProgramaSection({
  clientId,
  active,
  history,
  hasAny,
}: {
  clientId: string;
  active: SubscriptionPeriod | null;
  history: SubscriptionPeriod[];
  hasAny: boolean;
}) {
  const today = formatDateInput(new Date());
  const progress = active ? periodProgress({ startDate: active.startDate, endDate: active.endDate }) : null;

  return (
    <div className="space-y-4">
      {/* Periodo activo */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <Wallet size={18} className="text-primary" />
          <h2 className="font-semibold">Periodo vigente</h2>
        </div>

        {active ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatBlock
                icon={<Calendar size={14} />}
                label="Inicio"
                value={formatDate(active.startDate)}
              />
              <StatBlock
                icon={<Calendar size={14} />}
                label="Fin previsto"
                value={formatDate(active.endDate)}
              />
              <StatBlock
                icon={<Clock size={14} />}
                label="Duración"
                value={`${active.periodMonths} ${active.periodMonths === 1 ? "mes" : "meses"}`}
              />
              <StatBlock
                icon={<Coins size={14} />}
                label="Importe"
                value={active.amountPaid != null ? `${active.amountPaid.toFixed(2)} €` : "—"}
              />
              <StatBlock
                icon={<Check size={14} />}
                label="Método"
                value={
                  PAYMENT_METHOD_OPTIONS.find((m) => m.value === active.paymentMethod)?.label ??
                  active.paymentMethod ??
                  "—"
                }
              />
              <StatBlock
                icon={<Check size={14} />}
                label="Estado"
                value={
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusTone(
                      active.status,
                    )}`}
                  >
                    {statusLabel(active.status)}
                  </span>
                }
              />
            </div>

            {progress ? (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {progress.isExpired
                      ? "Vencido"
                      : `${progress.remainingDays} ${progress.remainingDays === 1 ? "día" : "días"} restantes`}
                  </span>
                  <span className="tabular-nums text-muted">{progress.percent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
                  <div
                    className={`h-full rounded-full ${
                      progress.isExpired ? "bg-rose-500" : "bg-primary"
                    }`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            ) : null}

            {active.notes ? (
              <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">{active.notes}</p>
            ) : null}

            <EditPeriodForm period={active} />
          </div>
        ) : (
          <p className="text-sm text-muted">
            {hasAny
              ? "Sin periodo activo. Registra una renovación cuando el atleta contrate de nuevo."
              : "Aún no ha contratado ningún periodo. Registra su alta abajo."}
          </p>
        )}
      </div>

      {/* Formulario "nueva alta / renovación" */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" />
          <h2 className="font-semibold">
            Registrar {hasAny ? "renovación" : "alta"}
          </h2>
        </div>
        <form action={createSubscriptionPeriod} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="isRenewal" value={hasAny ? "1" : "0"} />
          <FieldNumber name="periodMonths" label="Duración (meses)" required defaultValue={3} min={1} max={24} />
          <FieldDate name="startDate" label="Fecha de inicio" required defaultValue={today} />
          <FieldNumber
            name="amountPaid"
            label="Importe contratado (€)"
            step={0.01}
            min={0}
          />
          <FieldSelect
            name="paymentMethod"
            label="Método de pago"
            options={PAYMENT_METHOD_OPTIONS}
            defaultValue="manual"
          />
          <div className="sm:col-span-2">
            <FieldTextarea name="notes" label="Notas (opcional)" placeholder="Detalles del pago, condiciones, comentarios..." />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
            >
              {hasAny ? "Crear renovación" : "Registrar alta"}
            </button>
          </div>
        </form>
      </div>

      {/* Historial */}
      {history.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface">
          <header className="border-b border-border p-4">
            <h2 className="text-sm font-semibold">Historial de periodos</h2>
            <p className="text-xs text-muted">
              Suma total contratada:{" "}
              {history.reduce((n, p) => n + (p.periodMonths ?? 0), 0) +
                0}{" "}
              meses (histórico).
            </p>
          </header>
          <ul className="divide-y divide-border">
            {history.map((p) => (
              <li key={p.id} className="p-4">
                <details className="group">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(p.status)}`}>
                      {statusLabel(p.status)}
                    </span>
                    <span className="font-semibold">
                      {p.periodMonths} {p.periodMonths === 1 ? "mes" : "meses"}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDate(p.startDate)} → {formatDate(p.endDate)}
                    </span>
                    {p.amountPaid != null ? (
                      <span className="ml-auto text-xs text-muted">
                        {p.amountPaid.toFixed(2)} €
                      </span>
                    ) : null}
                    <ChevronDown
                      size={14}
                      className="text-muted transition group-open:rotate-180"
                    />
                  </summary>
                  <div className="mt-3">
                    <EditPeriodForm period={p} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StatBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-3">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted">
        {icon} {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

function FieldNumber({
  name,
  label,
  required,
  defaultValue,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: number | string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-muted">{label}</span>
      <input
        type="number"
        name={name}
        required={required}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
function FieldDate({
  name,
  label,
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-muted">{label}</span>
      <input
        type="date"
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
function FieldSelect({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function FieldTextarea({
  name,
  label,
  placeholder,
  defaultValue,
  rows = 2,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-muted">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function EditPeriodForm({ period }: { period: SubscriptionPeriod }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-bg/40 p-3">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted">Editar periodo</p>
      <form action={updateSubscriptionPeriod} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="id" value={period.id} />
        <FieldNumber
          name="periodMonths"
          label="Meses"
          defaultValue={period.periodMonths}
          min={1}
          max={24}
        />
        <FieldSelect
          name="status"
          label="Estado"
          options={STATUS_OPTIONS.map(({ value, label }) => ({ value, label }))}
          defaultValue={period.status}
        />
        <FieldDate
          name="startDate"
          label="Inicio"
          defaultValue={formatDateInput(period.startDate)}
        />
        <FieldDate
          name="endDate"
          label="Fin"
          defaultValue={formatDateInput(period.endDate)}
        />
        <FieldNumber
          name="amountPaid"
          label="Importe (€)"
          defaultValue={period.amountPaid ?? undefined}
          step={0.01}
        />
        <FieldSelect
          name="paymentMethod"
          label="Método"
          options={PAYMENT_METHOD_OPTIONS}
          defaultValue={period.paymentMethod ?? "manual"}
        />
        <div className="sm:col-span-2">
          <FieldTextarea name="notes" label="Notas" defaultValue={period.notes ?? ""} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="submit"
            formAction={deleteSubscriptionPeriod}
            className="inline-flex items-center gap-1 rounded-lg text-xs text-red-600 hover:underline"
          >
            <Trash2 size={12} /> Eliminar periodo
          </button>
          <button
            type="submit"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
