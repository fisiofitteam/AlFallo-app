import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { Field, Select, TextArea, TextInput } from "@/components/form-ui";
import { saveDailyLog } from "../../actions";

export const metadata = { title: "Registro diario · Al Fallo" };

const SCALE_1_5 = [
  { value: "1", label: "1 · Muy baja" },
  { value: "2", label: "2 · Baja" },
  { value: "3", label: "3 · Normal" },
  { value: "4", label: "4 · Alta" },
  { value: "5", label: "5 · Muy alta" },
];

export default async function DailyLogPage() {
  const me = await requireOnboardedClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const date = new Date(`${todayStr}T00:00:00.000Z`);

  const log = await prisma.dailyLog.findUnique({
    where: { clientId_date: { clientId: me.id, date } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Registro de hoy</h1>
      <p className="mt-1 text-muted">
        {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <form action={saveDailyLog} className="mt-5 space-y-4 rounded-2xl border border-border bg-surface p-5">
        <input type="hidden" name="date" value={todayStr} />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Peso (kg)" htmlFor="weightKg">
            <TextInput id="weightKg" name="weightKg" inputMode="decimal" defaultValue={log?.weightKg ?? ""} />
          </Field>
          <Field label="Horas de sueño" htmlFor="sleepHours">
            <TextInput id="sleepHours" name="sleepHours" inputMode="decimal" defaultValue={log?.sleepHours ?? ""} />
          </Field>
          <Field label="Energía" htmlFor="energy">
            <Select id="energy" name="energy" options={SCALE_1_5} defaultValue={log?.energy?.toString() ?? ""} />
          </Field>
          <Field label="Hambre" htmlFor="hunger">
            <Select id="hunger" name="hunger" options={SCALE_1_5} defaultValue={log?.hunger?.toString() ?? ""} />
          </Field>
        </div>

        <Field label="Adherencia al plan (%)" htmlFor="adherencePct" hint="0 a 100">
          <TextInput
            id="adherencePct"
            name="adherencePct"
            inputMode="numeric"
            defaultValue={log?.adherencePct ?? ""}
          />
        </Field>

        <Field label="Notas" htmlFor="notes" hint="Cómo te has sentido, digestión, antojos…">
          <TextArea id="notes" name="notes" defaultValue={log?.notes ?? ""} />
        </Field>

        <button className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-fg transition hover:opacity-90">
          {log ? "Actualizar registro" : "Guardar registro"}
        </button>
      </form>
    </div>
  );
}
