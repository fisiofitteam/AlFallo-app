import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarPlus, Phone, DollarSign, XCircle, CheckCircle2, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { Field, Select, TextArea, TextInput } from "@/components/form-ui";
import {
  CALL_RESULT_OPTIONS,
  CRM_ACCESS_ROLES,
  LEAD_SOURCE_OPTIONS,
  callResultBadgeClass,
  callResultLabel,
  leadStatusBadgeClass,
  leadStatusLabel,
  sourceLabel,
} from "@/lib/crm";
import { fmtEur } from "@/lib/finance";
import { isManager } from "@/lib/roles";
import {
  assignLead,
  closeSale,
  deleteCall,
  deleteLead,
  markLeadLost,
  markLeadQualified,
  scheduleCall,
  updateCallResult,
  updateLead,
} from "../../actions";

export const metadata = { title: "Lead · CRM" };

function dtLocal(d: Date | null): string {
  if (!d) return "";
  // input datetime-local espera YYYY-MM-DDTHH:mm sin zona.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const me = await requireProfessional();
  if (!CRM_ACCESS_ROLES.includes(me.role)) redirect("/");

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { fullName: true } },
      calls: {
        orderBy: { scheduledFor: "desc" },
        include: { closer: { select: { fullName: true } } },
      },
      sale: { include: { closer: { select: { fullName: true } } } },
    },
  });
  if (!lead) redirect("/crm");

  const professionals = await prisma.professional.findMany({
    where: { isActive: true, role: { in: CRM_ACCESS_ROLES } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
  const profOptions = professionals.map((p) => ({ value: p.id, label: p.fullName }));
  const canSeeAmounts = isManager(me.role);
  const isClosed = lead.status === "cliente";
  const isLost = lead.status === "perdido";

  // Próxima cita pendiente (si existe)
  const nextCall = lead.calls.find((c) => c.result === "pendiente");

  // Defaults: cita a 30 min vista
  const defaultCallDate = new Date(Date.now() + 30 * 60000);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/crm" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> CRM
      </Link>

      {/* Cabecera del lead */}
      <header className="mb-5 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
              {lead.fullName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{lead.fullName}</h1>
              <p className="text-sm text-muted">
                {lead.email ?? "Sin email"}
                {lead.phone && ` · ${lead.phone}`}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${leadStatusBadgeClass(lead.status)}`}>
            {leadStatusLabel(lead.status)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-3 text-sm text-muted sm:grid-cols-3">
          <span>Origen: <span className="text-text">{sourceLabel(lead.source)}</span></span>
          <span>Asignado a: <span className="text-text">{lead.assignedTo?.fullName ?? "—"}</span></span>
          <span>Creado: <span className="text-text">{lead.createdAt.toLocaleDateString("es-ES")}</span></span>
        </div>
        {lead.notes && (
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{lead.notes}</p>
        )}
        {isLost && lead.lostReason && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <span className="font-semibold">Motivo de pérdida:</span> {lead.lostReason}
          </p>
        )}
        {isClosed && lead.sale && (
          <div className="mt-3 rounded-xl bg-[#e7f6ec] p-3 text-sm text-[#15803d]">
            <p className="font-semibold">✓ Venta cerrada</p>
            <p className="mt-0.5">
              {canSeeAmounts && <>Importe: {fmtEur(lead.sale.amount, 2)} · </>}
              {lead.sale.planMonths && <>Plan: {lead.sale.planMonths} meses · </>}
              {lead.sale.closer && <>Cerrada por {lead.sale.closer.fullName} · </>}
              {lead.sale.startDate.toLocaleDateString("es-ES")}
              {lead.clientId && (
                <>
                  {" · "}
                  <Link href={`/clientes/${lead.clientId}`} className="font-medium underline">
                    Ver ficha del cliente
                  </Link>
                </>
              )}
            </p>
          </div>
        )}
      </header>

      {/* Acciones rápidas según el estado */}
      {!isClosed && !isLost && (
        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Cualificar */}
          {lead.status === "nuevo" && (
            <form action={markLeadQualified} className="rounded-2xl border border-border bg-surface p-4">
              <input type="hidden" name="id" value={lead.id} />
              <p className="font-semibold">Cualificar</p>
              <p className="mt-0.5 text-xs text-muted">Marca el lead como cualificado tras el primer contacto.</p>
              <button className="mt-3 flex items-center gap-1.5 rounded-xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary">
                <CheckCircle2 size={15} /> Marcar cualificado
              </button>
            </form>
          )}

          {/* Agendar llamada */}
          <form action={scheduleCall} className="rounded-2xl border border-border bg-surface p-4">
            <input type="hidden" name="leadId" value={lead.id} />
            <p className="font-semibold">Agendar videollamada</p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <input
                type="datetime-local"
                name="scheduledFor"
                defaultValue={dtLocal(defaultCallDate)}
                required
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  name="closerId"
                  defaultValue={me.id}
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Sin closer</option>
                  {profOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  name="durationMin"
                  defaultValue={30}
                  placeholder="min"
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <button className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-fg hover:opacity-90">
                <CalendarPlus size={15} /> Agendar llamada
              </button>
            </div>
          </form>

          {/* Marcar perdido */}
          <form action={markLeadLost} className="rounded-2xl border border-border bg-surface p-4">
            <input type="hidden" name="id" value={lead.id} />
            <p className="font-semibold">Marcar como perdido</p>
            <div className="mt-3 space-y-2">
              <input
                name="lostReason"
                placeholder="Motivo (precio, no es el momento…)"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                <XCircle size={15} /> Marcar perdido
              </button>
            </div>
          </form>

          {/* Cerrar venta */}
          <form action={closeSale} className="rounded-2xl border border-primary bg-primary-soft p-4">
            <input type="hidden" name="leadId" value={lead.id} />
            <p className="font-semibold text-primary">Cerrar venta</p>
            <p className="mt-0.5 text-xs text-primary/80">
              Crea el cliente, suma el ingreso y deja el lead como "cliente".
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                name="amount"
                inputMode="decimal"
                placeholder="Importe (€)"
                required
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                name="planMonths"
                inputMode="numeric"
                placeholder="Meses"
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-fg hover:opacity-90">
              <DollarSign size={15} /> Marcar vendida
            </button>
          </form>
        </section>
      )}

      {/* Historial de llamadas */}
      <section className="mb-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Historial de llamadas ({lead.calls.length})
        </h2>
        {lead.calls.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Sin llamadas agendadas.
          </p>
        ) : (
          <div className="space-y-3">
            {lead.calls.map((c) => (
              <article key={c.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-muted" />
                    <span className="font-semibold">
                      {c.scheduledFor.toLocaleString("es-ES", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {c.closer && <span className="text-muted">· {c.closer.fullName}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${callResultBadgeClass(c.result)}`}>
                      {callResultLabel(c.result)}
                    </span>
                    <form action={deleteCall}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="rounded-lg p-1 text-muted hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                </div>

                {c.resultNotes && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-sm">{c.resultNotes}</p>}
                {c.objections && (
                  <p className="mt-2 text-xs text-muted">
                    <span className="font-semibold">Objeciones:</span> {c.objections}
                  </p>
                )}
                {c.followUpAt && (
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-semibold">Re-contactar:</span>{" "}
                    {c.followUpAt.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </p>
                )}

                {/* Form para registrar/editar resultado */}
                {!isClosed && (
                  <details className="mt-3 group">
                    <summary className="cursor-pointer text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Registrar resultado</span>
                      <span className="hidden group-open:inline">Cerrar</span>
                    </summary>
                    <form action={updateCallResult} className="mt-3 space-y-2 border-t border-border pt-3">
                      <input type="hidden" name="id" value={c.id} />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Field label="Resultado" htmlFor={`result-${c.id}`}>
                          <Select
                            id={`result-${c.id}`}
                            name="result"
                            options={CALL_RESULT_OPTIONS}
                            defaultValue={c.result === "pendiente" ? "" : c.result}
                          />
                        </Field>
                        <Field label="Fecha de re-contacto (follow-up)" htmlFor={`followUpAt-${c.id}`}>
                          <input
                            id={`followUpAt-${c.id}`}
                            name="followUpAt"
                            type="datetime-local"
                            defaultValue={dtLocal(c.followUpAt)}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
                          />
                        </Field>
                      </div>
                      <Field label="Objeciones / situación" htmlFor={`obj-${c.id}`}>
                        <TextArea id={`obj-${c.id}`} name="objections" defaultValue={c.objections ?? ""} />
                      </Field>
                      <Field label="Notas del resultado" htmlFor={`rn-${c.id}`}>
                        <TextArea id={`rn-${c.id}`} name="resultNotes" defaultValue={c.resultNotes ?? ""} />
                      </Field>
                      <Field label="Motivo si se pierde" htmlFor={`lr-${c.id}`}>
                        <TextInput id={`lr-${c.id}`} name="lostReason" defaultValue={c.lostReason ?? ""} />
                      </Field>
                      <div className="flex justify-end">
                        <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90">
                          Guardar
                        </button>
                      </div>
                      <p className="text-[11px] text-muted">
                        Si marcas <span className="font-medium">Vendida</span>: registra abajo el cierre con importe;{" "}
                        si <span className="font-medium">Follow-up</span>: el lead pasa a "Seguimiento";{" "}
                        si <span className="font-medium">Perdida / No acude</span>: el lead pasa a "Perdido".
                      </p>
                    </form>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Datos del lead (editar + asignación + borrar) */}
      <section className="mb-5">
        <details className="rounded-2xl border border-border bg-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Editar datos del lead
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form action={updateLead} className="space-y-3 sm:col-span-2">
              <input type="hidden" name="id" value={lead.id} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="ed-name">
                  <TextInput id="ed-name" name="fullName" defaultValue={lead.fullName} />
                </Field>
                <Field label="Email" htmlFor="ed-email">
                  <TextInput id="ed-email" name="email" type="email" defaultValue={lead.email ?? ""} />
                </Field>
                <Field label="Teléfono" htmlFor="ed-phone">
                  <TextInput id="ed-phone" name="phone" type="tel" defaultValue={lead.phone ?? ""} />
                </Field>
                <Field label="Origen" htmlFor="ed-source">
                  <Select id="ed-source" name="source" options={LEAD_SOURCE_OPTIONS} defaultValue={lead.source ?? ""} />
                </Field>
              </div>
              <Field label="Notas" htmlFor="ed-notes">
                <TextArea id="ed-notes" name="notes" defaultValue={lead.notes ?? ""} />
              </Field>
              <div className="flex justify-end">
                <button className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2">
                  Guardar cambios
                </button>
              </div>
            </form>

            <form action={assignLead} className="flex items-end gap-2 sm:col-span-2">
              <input type="hidden" name="id" value={lead.id} />
              <div className="flex-1">
                <Field label="Asignar a" htmlFor="ed-assign">
                  <Select
                    id="ed-assign"
                    name="assignedToId"
                    options={profOptions}
                    defaultValue={lead.assignedToId ?? ""}
                    placeholder="Sin asignar"
                  />
                </Field>
              </div>
              <button className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2">
                Asignar
              </button>
            </form>

            <form
              action={deleteLead}
              className="sm:col-span-2"
            >
              <input type="hidden" name="id" value={lead.id} />
              <button className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                <Trash2 size={15} /> Eliminar lead
              </button>
            </form>
          </div>
        </details>
      </section>
    </div>
  );
}
