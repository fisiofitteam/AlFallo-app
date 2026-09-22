import Link from "next/link";
import { CheckCircle2, Clock, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import {
  CheckInWeekly,
  type CheckInActive,
  type CustomMetricInput,
  type MetricInput,
} from "@/components/cliente/CheckInWeekly";
import { listMetricsForClient } from "@/lib/metricDefinitions";
import { getLatestRequestSince } from "@/lib/weeklyCheckin";

export const metadata = { title: "Check-in · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const me = await requireOnboardedClient();
  // Criterio único: la petición de check-in vigente empieza en el último
  // día configurado del cliente (L, V, D...). Antes usábamos el lunes ISO,
  // lo que hacía que el "check-in activo" y el guard del server action
  // apuntaran a semanas distintas → check-ins fantasma o silenciosos.
  const since = (await getLatestRequestSince(me.id)) ?? new Date(0);

  const activeRaw = await prisma.checkIn.findFirst({
    where: { clientId: me.id, date: { gte: since } },
    orderBy: { date: "desc" },
  });
  const active: CheckInActive | null = activeRaw
    ? {
        id: activeRaw.id,
        weightKg: activeRaw.weightKg,
        waistCm: activeRaw.waistCm,
        hipCm: activeRaw.hipCm,
        armCm: activeRaw.armCm,
        bodyFatPct: activeRaw.bodyFatPct,
        adherencePct: activeRaw.adherencePct,
        energy: activeRaw.energy,
        notes: activeRaw.notes,
        extraAnswers: activeRaw.extraAnswers as CheckInActive["extraAnswers"],
        status: activeRaw.status,
        reviewNotes: activeRaw.reviewNotes,
      }
    : null;

  // Histórico (peticiones anteriores). Excluimos el de la petición vigente
  // porque ya se muestra arriba con su propio bloque editable.
  const previousCheckIns = await prisma.checkIn.findMany({
    where: { clientId: me.id, date: { lt: since } },
    orderBy: { date: "desc" },
    take: 12,
  });

  // Métricas personalizadas ACTIVAS que el nutri ha definido para este
  // cliente. Aparecen como inputs extra en el form del check-in.
  const customMetricsRaw = await prisma.customMetric.findMany({
    where: { clientId: me.id, active: true },
    orderBy: { order: "asc" },
  });
  let activeValues: { metricId: string; value: number }[] = [];
  if (activeRaw && customMetricsRaw.length > 0) {
    const vals = await prisma.customMetricValue.findMany({
      where: { checkInId: activeRaw.id },
      select: { metricId: true, value: true },
    });
    activeValues = vals;
  }
  const customMetrics: CustomMetricInput[] = customMetricsRaw.map((m) => ({
    id: m.id,
    name: m.name,
    unit: m.unit,
    type: m.type,
    value: activeValues.find((v) => v.metricId === m.id)?.value ?? null,
  }));

  // Si el atleta aún no ha registrado su primer check-in, lo tratamos
  // como "medida inicial" en el título/copy — es lo que le hemos pedido
  // en la home.
  const clientMeta = await prisma.client.findUnique({
    where: { id: me.id },
    select: { initialCheckInDone: true, useAdvancedCheckIn: true },
  });
  const isInitial = !clientMeta?.initialCheckInDone;
  const useAdvanced = !!clientMeta?.useAdvancedCheckIn;

  // Métricas activas para este cliente según el flag básico/avanzado.
  const rawMetrics = await listMetricsForClient(useAdvanced);
  const metrics: MetricInput[] = rawMetrics.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    type: m.type,
    unit: m.unit,
    coreField: m.coreField,
    category: m.category,
    frequency: m.frequency,
    options: Array.isArray(m.options)
      ? (m.options as { value: string; label: string }[])
      : null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {isInitial ? "Medida inicial" : "Check-in semanal"}
      </h1>
      <p className="mt-1 text-muted">
        {isInitial
          ? "Registra tus datos de partida. Los usaremos como referencia para tu evolución."
          : "Registra tu progreso de la semana para que tu nutricionista lo revise."}
      </p>

      <CheckInWeekly active={active} metrics={metrics} customMetrics={customMetrics} />

      {/* Histórico de semanas anteriores. */}
      {previousCheckIns.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Semanas anteriores
          </h2>
          <div className="space-y-3">
            {previousCheckIns.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.date.toLocaleDateString("es-ES")}</span>
                  {c.status === "revisado" ? (
                    <span className="flex items-center gap-1 text-xs text-[#1fa971]">
                      <CheckCircle2 size={14} /> Revisado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-[#e07b1a]">
                      <Clock size={14} /> Pendiente
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {c.weightKg != null && `${c.weightKg} kg · `}
                  {c.adherencePct != null && `${c.adherencePct}% adherencia`}
                </p>
                {c.reviewNotes && (
                  <div className="mt-2 rounded-xl bg-primary-soft p-3 text-sm">
                    <p className="mb-0.5 text-xs font-semibold text-primary">Tu nutricionista</p>
                    {c.reviewNotes}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Link
                    href={`/cliente/checkin/${c.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-2"
                  >
                    <Pencil size={12} /> Editar respuestas
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
