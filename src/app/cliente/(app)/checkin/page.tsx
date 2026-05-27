import { CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { Field, Select, TextArea, TextInput } from "@/components/form-ui";
import { submitCheckIn } from "../../actions";

export const metadata = { title: "Check-in · Al Fallo" };

const SCALE_1_5 = [
  { value: "1", label: "1 · Muy baja" },
  { value: "2", label: "2 · Baja" },
  { value: "3", label: "3 · Normal" },
  { value: "4", label: "4 · Alta" },
  { value: "5", label: "5 · Muy alta" },
];

export default async function CheckInPage() {
  const me = await requireOnboardedClient();
  const checkIns = await prisma.checkIn.findMany({
    where: { clientId: me.id },
    orderBy: { date: "desc" },
    take: 12,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Check-in semanal</h1>
      <p className="mt-1 text-muted">Registra tu progreso de la semana para que tu nutricionista lo revise.</p>

      <form action={submitCheckIn} className="mt-5 space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Peso (kg)" htmlFor="weightKg">
            <TextInput id="weightKg" name="weightKg" inputMode="decimal" />
          </Field>
          <Field label="% Grasa" htmlFor="bodyFatPct">
            <TextInput id="bodyFatPct" name="bodyFatPct" inputMode="decimal" />
          </Field>
          <Field label="Cintura (cm)" htmlFor="waistCm">
            <TextInput id="waistCm" name="waistCm" inputMode="decimal" />
          </Field>
          <Field label="Cadera (cm)" htmlFor="hipCm">
            <TextInput id="hipCm" name="hipCm" inputMode="decimal" />
          </Field>
          <Field label="Brazo (cm)" htmlFor="armCm">
            <TextInput id="armCm" name="armCm" inputMode="decimal" />
          </Field>
          <Field label="Adherencia (%)" htmlFor="adherencePct">
            <TextInput id="adherencePct" name="adherencePct" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Energía" htmlFor="energy">
          <Select id="energy" name="energy" options={SCALE_1_5} />
        </Field>
        <Field label="¿Cómo ha ido la semana?" htmlFor="notes" hint="Sensaciones, dificultades, dudas…">
          <TextArea id="notes" name="notes" />
        </Field>
        <button className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-fg transition hover:opacity-90">
          Enviar check-in
        </button>
      </form>

      {/* Historial */}
      {checkIns.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Anteriores</h2>
          <div className="space-y-3">
            {checkIns.map((c) => (
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
