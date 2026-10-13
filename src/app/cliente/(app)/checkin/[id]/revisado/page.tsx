import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Stethoscope } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { listMetricsForClient } from "@/lib/metricDefinitions";

export const metadata = { title: "Revisión del nutri · Al Fallo" };
export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export default async function CheckInReviewedPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireOnboardedClient();
  const checkIn = await prisma.checkIn.findUnique({ where: { id: params.id } });
  if (!checkIn || checkIn.clientId !== me.id) notFound();
  if (!checkIn.reviewedAt) notFound();

  // Marcamos como visto en el mismo request. Idempotente: si ya estaba
  // visto, no hace nada visible. El banner de la home deja de salir.
  if (!checkIn.clientSeenReviewAt) {
    await prisma.checkIn.update({
      where: { id: checkIn.id },
      data: { clientSeenReviewAt: new Date() },
    });
  }

  const clientMeta = await prisma.client.findUnique({
    where: { id: me.id },
    select: { useAdvancedCheckIn: true, nutritionist: { select: { fullName: true } } },
  });
  const useAdvanced = !!clientMeta?.useAdvancedCheckIn;

  // Catálogo de métricas activo del atleta — para pintar el resumen con
  // nombres amigables y las métricas custom que haya respondido.
  const metrics = await listMetricsForClient(useAdvanced);

  // Catálogo de métricas custom con sus valores en este check-in.
  const customMetrics = await prisma.customMetric.findMany({
    where: { clientId: me.id, active: true },
    orderBy: { order: "asc" },
  });
  const customValues = await prisma.customMetricValue.findMany({
    where: { checkInId: checkIn.id },
    select: { metricId: true, value: true },
  });
  const customValueById = new Map(customValues.map((v) => [v.metricId, v.value]));

  // Resumen a renderizar: iteramos las métricas activas y resolvemos su
  // valor desde columnas tipadas (coreField) o desde extraAnswers JSON.
  type Row = { label: string; value: string; unit: string | null };
  const extra = (checkIn.extraAnswers ?? {}) as Record<string, unknown>;
  const rows: Row[] = [];
  for (const m of metrics) {
    let raw: unknown = undefined;
    if (m.coreField) {
      raw = (checkIn as unknown as Record<string, unknown>)[m.coreField];
    } else {
      raw = extra[m.id];
    }
    if (raw == null || raw === "") continue;
    const display = typeof raw === "boolean" ? (raw ? "Sí" : "No") : String(raw);
    rows.push({ label: m.name, value: display, unit: m.unit });
  }
  for (const cm of customMetrics) {
    const v = customValueById.get(cm.id);
    if (v == null) continue;
    rows.push({ label: cm.name, value: String(v), unit: cm.unit });
  }

  return (
    <div>
      <Link
        href="/cliente"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
      >
        <ArrowLeft size={12} /> Volver
      </Link>

      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
        <CheckCircle2 size={22} className="text-emerald-600" /> Check-in revisado
      </h1>
      <p className="mt-1 text-sm text-muted">
        Enviado el {fmtDate(checkIn.date)} · Revisado el {fmtDate(checkIn.reviewedAt)}
        {clientMeta?.nutritionist?.fullName
          ? ` por ${clientMeta.nutritionist.fullName}`
          : ""}
      </p>

      {/* Comentario del nutri — pieza central */}
      {checkIn.reviewNotes ? (
        <section className="mt-5 rounded-2xl border border-primary/40 bg-primary-soft p-5">
          <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Stethoscope size={13} />
            {clientMeta?.nutritionist?.fullName
              ? `Mensaje de ${clientMeta.nutritionist.fullName.split(" ")[0]}`
              : "Mensaje de tu nutri"}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
            {checkIn.reviewNotes}
          </p>
        </section>
      ) : (
        <section className="mt-5 rounded-2xl border border-dashed border-border bg-surface/50 p-5 text-sm text-muted">
          Tu nutri revisó el check-in pero no dejó comentarios esta semana.
        </section>
      )}

      {/* Resumen del check-in */}
      <section className="mt-5 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
          Tu check-in
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No se registraron métricas en este check-in.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {rows.map((r, i) => (
              <div key={i} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-muted">
                  {r.label}
                </dt>
                <dd className="mt-0.5 truncate text-base font-semibold">
                  {r.value}
                  {r.unit ? <span className="ml-1 text-xs text-muted">{r.unit}</span> : ""}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {checkIn.notes ? (
          <div className="mt-4 rounded-xl bg-bg/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">Lo que escribiste</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-text">{checkIn.notes}</p>
          </div>
        ) : null}
      </section>

      <div className="mt-5 flex justify-end">
        <Link
          href="/cliente/checkin"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
        >
          Ir a mis check-ins
        </Link>
      </div>
    </div>
  );
}
