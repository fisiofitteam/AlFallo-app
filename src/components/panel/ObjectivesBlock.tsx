import {
  MAX_DAY_ITEMS,
  MAX_WEEK_ITEMS,
  quarterKey,
  monthKey,
  weekKey,
  dayKey,
  quarterLabel,
  monthLabel,
  weekLabel,
  readObjective,
  type ObjectiveItem,
} from "@/lib/objectives";
import {
  saveDayObjective,
  saveMonthObjective,
  saveQuarterObjective,
  saveWeekObjective,
} from "@/app/(panel)/objectives-actions";

const inputCls =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";
const textareaCls =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";
const saveBtnCls =
  "rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition hover:opacity-90";

function padItems(items: ObjectiveItem[], max: number): ObjectiveItem[] {
  const out = [...items];
  while (out.length < max) {
    out.push({ id: `slot_${out.length}`, text: "", done: false });
  }
  return out.slice(0, max);
}

export async function ObjectivesBlock({ professionalId }: { professionalId: string }) {
  const now = new Date();
  const [quarter, month, week, day] = await Promise.all([
    readObjective(professionalId, "quarter", quarterKey(now)),
    readObjective(professionalId, "month", monthKey(now)),
    readObjective(professionalId, "week", weekKey(now)),
    readObjective(professionalId, "day", dayKey(now)),
  ]);
  const qLabel = quarterLabel(now);
  const weekItems = padItems(week.items, MAX_WEEK_ITEMS);
  const dayItems = padItems(day.items, MAX_DAY_ITEMS);

  return (
    <div className="mb-6 space-y-4">
      {/* Objetivo del trimestre */}
      <article className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
        <header className="mb-3">
          <h3 className="text-sm font-bold">🎯 Objetivo del trimestre</h3>
          <p className="text-xs text-muted">
            {qLabel.title} · {qLabel.range}
          </p>
        </header>
        <form action={saveQuarterObjective} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
              Temática principal
            </span>
            <textarea
              name="theme"
              rows={2}
              defaultValue={quarter.theme}
              placeholder="La gran apuesta del trimestre en 1-3 frases"
              className={textareaCls}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                🪧 Marketing
              </span>
              <textarea name="marketing" rows={4} defaultValue={quarter.marketing} className={textareaCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                💼 Ventas
              </span>
              <textarea name="ventas" rows={4} defaultValue={quarter.ventas} className={textareaCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                🩺 Servicio
              </span>
              <textarea name="servicio" rows={4} defaultValue={quarter.servicio} className={textareaCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">
                👑 CEO
              </span>
              <textarea name="ceo" rows={4} defaultValue={quarter.ceo} className={textareaCls} />
            </label>
          </div>
          <div className="flex justify-end">
            <button className={saveBtnCls}>Guardar trimestre</button>
          </div>
        </form>
      </article>

      {/* Foco del mes */}
      <article className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
        <header className="mb-3">
          <h3 className="text-sm font-bold capitalize">🎯 Foco de {monthLabel(now)}</h3>
          <p className="text-xs text-muted">
            A qué le estás dando prioridad este mes. 1-3 frases.
          </p>
        </header>
        <form action={saveMonthObjective} className="space-y-2">
          <textarea
            name="focus"
            rows={3}
            defaultValue={month.focus}
            placeholder="Poner el foco en X. Recuperar Y. Cerrar Z."
            className={textareaCls}
          />
          <div className="flex justify-end">
            <button className={saveBtnCls}>Guardar mes</button>
          </div>
        </form>
      </article>

      {/* Objetivos de la semana */}
      <article className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
        <header className="mb-3">
          <h3 className="text-sm font-bold">📅 Objetivos de esta semana</h3>
          <p className="text-xs text-muted">
            Máx {MAX_WEEK_ITEMS}. Puente entre el foco del mes y tu día a día. {weekLabel(now)}.
          </p>
        </header>
        <form action={saveWeekObjective} className="space-y-2">
          {weekItems.map((it, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-white/60 px-2 py-1.5">
              <input type="hidden" name={`id_${i}`} value={it.id} />
              <input
                type="checkbox"
                name={`done_${i}`}
                value="1"
                defaultChecked={it.done}
                className="h-4 w-4 rounded border-border text-primary"
              />
              <span className="w-4 text-center text-xs font-bold text-muted">{i + 1}.</span>
              <input
                type="text"
                name={`text_${i}`}
                defaultValue={it.text}
                placeholder={`Objetivo ${i + 1}`}
                className="flex-1 border-b border-transparent bg-transparent px-1 py-1 text-sm outline-none focus:border-primary"
              />
            </div>
          ))}
          <div className="flex justify-end">
            <button className={saveBtnCls}>Guardar semana</button>
          </div>
        </form>
      </article>

      {/* Las 3 dianas de hoy */}
      <article className="rounded-2xl border border-border bg-surface p-5">
        <header className="mb-3">
          <h3 className="text-sm font-bold">🎯 Las 3 dianas de hoy</h3>
          <p className="text-xs text-muted">Lo único que tiene que pasar hoy.</p>
        </header>
        <form action={saveDayObjective} className="space-y-2">
          {dayItems.map((it, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-border/50 pb-2 last:border-b-0">
              <input type="hidden" name={`id_${i}`} value={it.id} />
              <input
                type="checkbox"
                name={`done_${i}`}
                value="1"
                defaultChecked={it.done}
                className="h-4 w-4 rounded-full border-border text-primary"
              />
              <input
                type="text"
                name={`text_${i}`}
                defaultValue={it.text}
                placeholder={`Diana ${i + 1} — ¿qué vas a hacer hoy sin falta?`}
                className={`flex-1 border-none bg-transparent px-1 py-1 outline-none ${
                  it.text ? "font-semibold text-text" : "text-muted"
                }`}
              />
            </div>
          ))}
          <div className="flex justify-end">
            <button className={saveBtnCls}>Guardar dianas</button>
          </div>
        </form>
      </article>
    </div>
  );
}
