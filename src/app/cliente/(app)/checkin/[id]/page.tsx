import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import {
  CheckInWeekly,
  type CheckInActive,
  type CustomMetricInput,
  type MetricInput,
} from "@/components/cliente/CheckInWeekly";
import { listMetricsForClient } from "@/lib/metricDefinitions";

export const metadata = { title: "Editar check-in · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function EditCheckInPage({ params }: { params: { id: string } }) {
  const me = await requireOnboardedClient();
  const raw = await prisma.checkIn.findUnique({ where: { id: params.id } });
  if (!raw || raw.clientId !== me.id) notFound();

  const active: CheckInActive = {
    id: raw.id,
    weightKg: raw.weightKg,
    waistCm: raw.waistCm,
    hipCm: raw.hipCm,
    armCm: raw.armCm,
    bodyFatPct: raw.bodyFatPct,
    adherencePct: raw.adherencePct,
    energy: raw.energy,
    notes: raw.notes,
    extraAnswers: raw.extraAnswers as CheckInActive["extraAnswers"],
    status: raw.status,
    reviewNotes: raw.reviewNotes,
  };

  const clientMeta = await prisma.client.findUnique({
    where: { id: me.id },
    select: { useAdvancedCheckIn: true },
  });
  const useAdvanced = !!clientMeta?.useAdvancedCheckIn;
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

  const customMetricsRaw = await prisma.customMetric.findMany({
    where: { clientId: me.id, active: true },
    orderBy: { order: "asc" },
  });
  const vals = await prisma.customMetricValue.findMany({
    where: { checkInId: raw.id },
    select: { metricId: true, value: true },
  });
  const customMetrics: CustomMetricInput[] = customMetricsRaw.map((m) => ({
    id: m.id,
    name: m.name,
    unit: m.unit,
    type: m.type,
    value: vals.find((v) => v.metricId === m.id)?.value ?? null,
  }));

  return (
    <div>
      <Link
        href="/cliente/checkin"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
      >
        <ArrowLeft size={12} /> Volver
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        Editar check-in del {raw.date.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Corrige lo que necesites. Al guardar se actualizan las respuestas de ese check-in.
      </p>

      <CheckInWeekly
        active={active}
        metrics={metrics}
        customMetrics={customMetrics}
        startEditing
        editOnly
      />
    </div>
  );
}
