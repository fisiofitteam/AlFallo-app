import { Target } from "lucide-react";
import type { MacroTargets } from "@prisma/client";
import { Field, TextInput } from "@/components/form-ui";
import { updateMacroTargets } from "../actions";

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
        Objetivos diarios. Separa entreno y descanso si el cliente come distinto cuando entrena.
        En el plan, cada día se compara con estos números.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Entreno */}
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">💪 Día de entreno</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kcal" htmlFor="kcalTraining">
              <TextInput id="kcalTraining" name="kcalTraining" inputMode="numeric" defaultValue={t?.kcalTraining ?? ""} />
            </Field>
            <Field label="Proteína (g)" htmlFor="proteinTraining">
              <TextInput id="proteinTraining" name="proteinTraining" inputMode="decimal" defaultValue={t?.proteinTraining ?? ""} />
            </Field>
            <Field label="Carbos (g)" htmlFor="carbsTraining">
              <TextInput id="carbsTraining" name="carbsTraining" inputMode="decimal" defaultValue={t?.carbsTraining ?? ""} />
            </Field>
            <Field label="Grasa (g)" htmlFor="fatTraining">
              <TextInput id="fatTraining" name="fatTraining" inputMode="decimal" defaultValue={t?.fatTraining ?? ""} />
            </Field>
          </div>
        </div>

        {/* Descanso */}
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">🛌 Día de descanso</h3>
          <p className="mb-2 text-[11px] text-muted">Si lo dejas vacío, se usan los de entreno.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kcal" htmlFor="kcalRest">
              <TextInput id="kcalRest" name="kcalRest" inputMode="numeric" defaultValue={t?.kcalRest ?? ""} />
            </Field>
            <Field label="Proteína (g)" htmlFor="proteinRest">
              <TextInput id="proteinRest" name="proteinRest" inputMode="decimal" defaultValue={t?.proteinRest ?? ""} />
            </Field>
            <Field label="Carbos (g)" htmlFor="carbsRest">
              <TextInput id="carbsRest" name="carbsRest" inputMode="decimal" defaultValue={t?.carbsRest ?? ""} />
            </Field>
            <Field label="Grasa (g)" htmlFor="fatRest">
              <TextInput id="fatRest" name="fatRest" inputMode="decimal" defaultValue={t?.fatRest ?? ""} />
            </Field>
          </div>
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
