import { Target } from "lucide-react";
import type { MacroTargets } from "@prisma/client";
import { Field, TextInput } from "@/components/form-ui";
import { updateMacroTargets } from "../actions";

// Objetivos diarios de macros del cliente. Hasta junio 2026 separábamos
// entreno y descanso; ya no — el cliente come igual cada día y solo
// guardamos un set único. Las columnas *Rest siguen en BD por compatibilidad
// pero ya no se editan ni se persisten desde aquí.
export function MacroTargetsForm({
  clientId,
  targets,
}: {
  clientId: string;
  targets: MacroTargets | null;
}) {
  const t = targets;

  return (
    <form action={updateMacroTargets} className="rounded-2xl border border-border bg-surface p-5">
      <input type="hidden" name="clientId" value={clientId} />

      <h2 className="flex items-center gap-2 font-semibold">
        <Target size={18} className="text-primary" />
        Objetivos de macros
      </h2>
      <p className="mt-1 text-xs text-muted">
        Macros diarios del cliente. Cada plan se compara con estos números para
        ver si las opciones del día cuadran con el objetivo.
      </p>

      <div className="mt-4 rounded-xl border border-border p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">
          💪 Diario
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Kcal" htmlFor="kcalTraining">
            <TextInput
              id="kcalTraining"
              name="kcalTraining"
              inputMode="numeric"
              defaultValue={t?.kcalTraining ?? ""}
            />
          </Field>
          <Field label="Proteína (g)" htmlFor="proteinTraining">
            <TextInput
              id="proteinTraining"
              name="proteinTraining"
              inputMode="decimal"
              defaultValue={t?.proteinTraining ?? ""}
            />
          </Field>
          <Field label="Carbos (g)" htmlFor="carbsTraining">
            <TextInput
              id="carbsTraining"
              name="carbsTraining"
              inputMode="decimal"
              defaultValue={t?.carbsTraining ?? ""}
            />
          </Field>
          <Field label="Grasa (g)" htmlFor="fatTraining">
            <TextInput
              id="fatTraining"
              name="fatTraining"
              inputMode="decimal"
              defaultValue={t?.fatTraining ?? ""}
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
          Guardar objetivos
        </button>
      </div>
    </form>
  );
}
