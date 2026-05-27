import type { CheckIn } from "@prisma/client";
import { CheckCircle2, Clock } from "lucide-react";
import { TextArea } from "@/components/form-ui";
import { reviewCheckIn } from "../actions";

function Metric({ label, value, unit = "" }: { label: string; value: number | null; unit?: string }) {
  if (value == null) return null;
  return (
    <span className="text-sm">
      <span className="text-muted">{label}:</span> {value}
      {unit}
    </span>
  );
}

export function CheckInsTab({ checkIns }: { checkIns: CheckIn[] }) {
  if (checkIns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="font-medium">Sin check-ins todavía</p>
        <p className="mt-1 text-sm text-muted">Aparecerán aquí cuando el atleta los envíe desde su app.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {checkIns.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{c.date.toLocaleDateString("es-ES")}</span>
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

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Metric label="Peso" value={c.weightKg} unit=" kg" />
            <Metric label="% Grasa" value={c.bodyFatPct} />
            <Metric label="Cintura" value={c.waistCm} unit=" cm" />
            <Metric label="Cadera" value={c.hipCm} unit=" cm" />
            <Metric label="Brazo" value={c.armCm} unit=" cm" />
            <Metric label="Adherencia" value={c.adherencePct} unit="%" />
            <Metric label="Energía" value={c.energy} unit="/5" />
          </div>

          {c.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{c.notes}</p>}

          <form action={reviewCheckIn} className="mt-3 space-y-2">
            <input type="hidden" name="checkInId" value={c.id} />
            <TextArea
              name="reviewNotes"
              defaultValue={c.reviewNotes ?? ""}
              placeholder="Tu respuesta al atleta…"
            />
            <div className="flex justify-end">
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:opacity-90">
                {c.status === "revisado" ? "Actualizar respuesta" : "Responder y marcar revisado"}
              </button>
            </div>
          </form>
        </div>
      ))}
    </div>
  );
}
