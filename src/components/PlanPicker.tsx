"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X, Loader2, Sparkles, UtensilsCrossed, Trophy } from "lucide-react";
import {
  createPlan,
  deletePlan,
  renamePlan,
  generatePlanFromAI,
} from "@/app/(panel)/planes/actions";

export type PlanPickerItem = { id: string; name: string };

/**
 * Barra superior de la pestaña Plan dentro de la ficha del cliente.
 * Se compone de:
 *   - Selector de plan + renombrar + borrar + crear nuevo (fila 1)
 *   - Botones de generación HB / IA (fila 2)
 * La generación se hace contra el plan seleccionado actualmente. Tras
 * completarse, recargamos la página para que el builder embebido vuelva a
 * hidratarse con la estructura nueva.
 */
export function PlanPicker({
  clientId,
  plans,
  selectedPlanId,
}: {
  clientId: string;
  plans: PlanPickerItem[];
  selectedPlanId: string | null;
}) {
  const router = useRouter();
  const [, startNav] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [genBusy, startGen] = useTransition();
  // Modal: 'idle' (cerrado), 'choose' (eligiendo tipo), 'competition' (form competición).
  const [genMode, setGenMode] = useState<"idle" | "choose" | "competition">("idle");

  const selected = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;

  function go(planId: string) {
    startNav(() => router.push(`/clientes/${clientId}?tab=plan&planId=${planId}`));
  }

  function runGenerate(extra?: { competitionName?: string; competitionContext?: string }) {
    if (!selected) return;
    const fd = new FormData();
    fd.set("planId", selected.id);
    if (extra?.competitionContext?.trim()) {
      fd.set("kind", "competition");
      fd.set("competitionContext", extra.competitionContext.trim());
      if (extra.competitionName?.trim()) {
        fd.set("competitionName", extra.competitionName.trim());
      }
    }
    startGen(async () => {
      await generatePlanFromAI(fd);
      window.location.reload();
    });
  }

  function chooseRegular() {
    setGenMode("idle");
    if (
      !confirm(
        "Esto borra el plan actual y genera una PAUTA NUTRICIONAL: Harris-Benedict recalcula los macros del cliente y la IA escribe 5 comidas × 3 opciones con alimentos y gramos. Puede tardar 10-20 s. ¿Seguro?",
      )
    )
      return;
    runGenerate();
  }

  function chooseCompetition() {
    setGenMode("competition");
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
      {/* Fila 1: selector + acciones del plan */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <span className="text-sm font-medium text-muted">Plan:</span>

        {renaming && selected ? (
          <RenameInline
            planId={selected.id}
            current={selected.name}
            onDone={() => setRenaming(false)}
          />
        ) : (
          <>
            <select
              value={selected?.id ?? ""}
              onChange={(e) => go(e.target.value)}
              disabled={plans.length <= 1 && !selected}
              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary disabled:opacity-60"
            >
              {plans.length === 0 ? (
                <option value="">— sin planes —</option>
              ) : (
                plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>

            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  title="Renombrar plan"
                  className="rounded-md border border-border p-1.5 text-muted hover:border-primary hover:text-text"
                >
                  <Pencil size={13} />
                </button>
                <form
                  action={async (fd) => {
                    if (
                      !confirm(
                        `¿Borrar el plan "${selected.name}"? Se eliminan todos sus días, comidas y opciones.`,
                      )
                    )
                      return;
                    await deletePlan(fd);
                  }}
                >
                  <input type="hidden" name="planId" value={selected.id} />
                  <button
                    type="submit"
                    title="Borrar plan"
                    className="rounded-md border border-border p-1.5 text-muted hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </form>
              </>
            ) : null}
          </>
        )}

        <div className="ml-auto">
          {adding ? (
            <NewPlanInline clientId={clientId} onDone={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text hover:border-primary hover:text-primary"
            >
              <Plus size={12} /> Añadir plan
            </button>
          )}
        </div>
      </div>

      {/* Fila 2: generación combinada (HB + IA en un solo clic) */}
      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-bg/40 px-5 py-3">
          <p className="text-xs text-muted">
            <span className="font-medium text-text">Harris-Benedict</span> recalcula los macros objetivo del
            cliente y la <span className="font-medium text-text">IA</span> escribe cada opción con alimentos
            y gramos.
          </p>
          <button
            type="button"
            onClick={() => setGenMode("choose")}
            disabled={genBusy}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--c-primary)" }}
            title="Pauta nutricional o plan de competición"
          >
            {genBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generar plan
          </button>
        </div>
      ) : null}

      {genMode !== "idle" ? (
        <GenerateModal
          mode={genMode}
          busy={genBusy}
          onClose={() => setGenMode("idle")}
          onChooseRegular={chooseRegular}
          onChooseCompetition={chooseCompetition}
          onSubmitCompetition={(name, ctx) => runGenerate({ competitionName: name, competitionContext: ctx })}
        />
      ) : null}
    </section>
  );
}

function GenerateModal({
  mode,
  busy,
  onClose,
  onChooseRegular,
  onChooseCompetition,
  onSubmitCompetition,
}: {
  mode: "choose" | "competition";
  busy: boolean;
  onClose: () => void;
  onChooseRegular: () => void;
  onChooseCompetition: () => void;
  onSubmitCompetition: (name: string, ctx: string) => void;
}) {
  const [name, setName] = useState("");
  const [ctx, setCtx] = useState("");

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-2xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="font-semibold">
            {mode === "choose" ? "¿Qué quieres generar?" : "Plan de competición"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-text"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </header>

        {mode === "choose" ? (
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={onChooseRegular}
              disabled={busy}
              className="flex flex-col items-start gap-2 rounded-xl border border-border bg-bg p-4 text-left hover:border-primary disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <UtensilsCrossed size={18} />
              </span>
              <span className="font-semibold">Pauta nutricional</span>
              <span className="text-xs text-muted">
                Plan habitual del cliente. HB recalcula sus macros base y la IA escribe 5 comidas
                × 3 opciones según su objetivo.
              </span>
            </button>
            <button
              type="button"
              onClick={onChooseCompetition}
              disabled={busy}
              className="flex flex-col items-start gap-2 rounded-xl border border-border bg-bg p-4 text-left hover:border-primary disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Trophy size={18} />
              </span>
              <span className="font-semibold">Plan de competición</span>
              <span className="text-xs text-muted">
                Plan puntual para una prueba. Aplica el brief de Rendimiento y pega los WODs,
                horarios y fecha del evento para que la IA construya el plan en torno a eso.
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <label className="block">
              <span className="block text-sm font-semibold">Nombre del evento</span>
              <span className="block text-xs text-muted">
                Solo para identificarlo en el plan (ej. "Hyrox Madrid 14 jul"). Opcional.
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hyrox Madrid 14 jul"
                className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold">WODs, horarios y contexto</span>
              <span className="block text-xs text-muted">
                Pega aquí los WODs (warm-up, formato, duración estimada), el horario del día, la
                fecha del evento, cualquier nota relevante (logística, comidas con el equipo, etc.).
                La IA lo usará para diseñar el plan.
              </span>
              <textarea
                rows={10}
                value={ctx}
                onChange={(e) => setCtx(e.target.value)}
                placeholder={`Ej:\n\n14 jul 2026 — Hyrox Madrid\nLlegada al recinto 08:00. WOD 11:30:\n  Run 1km · Ski 1km · Run 1km · Sled push 50m · ...\nNecesidad de carga 36-24h previa. Postwod: cervecera 19:00.`}
                className="mt-2 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <p className="text-xs text-muted">
              El brief de <strong>Plan de competición</strong> que tengas guardado en{" "}
              <strong>Biblioteca → Brief IA → Plan de competición</strong> se aplicará automáticamente
              junto a este contexto.
            </p>
          </div>
        )}

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg hover:text-text"
          >
            Cancelar
          </button>
          {mode === "competition" ? (
            <button
              type="button"
              onClick={() => onSubmitCompetition(name, ctx)}
              disabled={busy || !ctx.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--c-primary)" }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generar plan de competición
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

function RenameInline({
  planId,
  current,
  onDone,
}: {
  planId: string;
  current: string;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      action={async (fd) => {
        const name = String(fd.get("name") ?? "").trim();
        if (name && name !== current) {
          start(async () => {
            await renamePlan(fd);
            onDone();
          });
        } else {
          onDone();
        }
      }}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="planId" value={planId} />
      <input
        name="name"
        defaultValue={current}
        autoFocus
        required
        className="rounded-md border border-primary/50 bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={pending}
        title="Guardar"
        className="rounded-md p-1.5 text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--c-primary)" }}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button
        type="button"
        onClick={onDone}
        title="Cancelar"
        className="rounded-md p-1.5 text-muted hover:bg-bg"
      >
        <X size={12} />
      </button>
    </form>
  );
}

function NewPlanInline({
  clientId,
  onDone,
}: {
  clientId: string;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      action={async (fd) => {
        const name = String(fd.get("name") ?? "").trim();
        if (!name) {
          onDone();
          return;
        }
        start(async () => {
          // createPlan redirige a /clientes/<id>?tab=plan&planId=<new>
          await createPlan(fd);
        });
      }}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input
        name="name"
        autoFocus
        required
        placeholder="Nombre del plan"
        className="rounded-md border border-primary/50 bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={pending}
        title="Crear"
        className="rounded-md p-1.5 text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--c-primary)" }}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button
        type="button"
        onClick={onDone}
        title="Cancelar"
        className="rounded-md p-1.5 text-muted hover:bg-bg"
      >
        <X size={12} />
      </button>
    </form>
  );
}
