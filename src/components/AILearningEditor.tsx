"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import {
  upsertPlanGenerationRule,
  togglePlanGenerationRule,
  deletePlanGenerationRule,
  deletePlanGenerationFeedback,
} from "@/app/(panel)/planes/actions";

/**
 * Editor del "aprendizaje de la IA": las reglas globales que se inyectan en
 * TODOS los prompts y el histórico de feedback (good/bad con razón).
 *
 * Las reglas se crean también solas cuando el nutri marca "guardar como
 * regla general" en el modal de revisión tras pedir un ajuste. Aquí se
 * pueden añadir a mano, desactivar temporalmente y borrar.
 *
 * El feedback se acumula con cada plan aceptado/rechazado. Solo se puede
 * borrar (no editar) — es histórico.
 */

export type RuleDTO = {
  id: string;
  text: string;
  active: boolean;
  order: number;
  createdAt: string;
};

export type FeedbackDTO = {
  id: string;
  verdict: "good" | "bad";
  reason: string;
  clientName: string | null;
  planName: string | null;
  createdAt: string;
};

export function AILearningEditor({
  initialRules,
  initialFeedback,
}: {
  initialRules: RuleDTO[];
  initialFeedback: FeedbackDTO[];
}) {
  return (
    <div className="space-y-6">
      <RulesSection initial={initialRules} />
      <FeedbackSection initial={initialFeedback} />
    </div>
  );
}

function RulesSection({ initial }: { initial: RuleDTO[] }) {
  const [rules, setRules] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [pending, start] = useTransition();

  function add() {
    if (!newText.trim()) return;
    const fd = new FormData();
    fd.set("text", newText.trim());
    start(async () => {
      await upsertPlanGenerationRule(fd);
      // No tenemos el row creado de vuelta — refrescamos por hidratación
      // del Server Component. window.location.reload() es lo más rápido y
      // estamos en una pestaña de gestión, no hay estado precioso que perder.
      window.location.reload();
    });
    setNewText("");
    setAdding(false);
  }

  function toggle(id: string, active: boolean) {
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      await togglePlanGenerationRule(fd);
    });
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, active: !active } : r)));
  }

  function remove(id: string) {
    if (!confirm("¿Borrar esta regla? Dejará de aplicarse al generar planes.")) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      await deletePlanGenerationRule(fd);
    });
    setRules((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <p className="font-semibold">Reglas globales</p>
          <p className="text-xs text-muted">
            Se aplican a TODAS las generaciones de plan. Una por línea, en español, sin números.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={pending || adding}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={13} /> Nueva regla
        </button>
      </header>

      <div className="space-y-2 px-5 py-4">
        {adding ? (
          <div className="rounded-xl border border-primary/40 bg-bg p-3">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Ej. Nunca repetir pollo más de 2 veces en el día. Las raciones de carbo no exceden 120 g cocido."
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewText("");
                }}
                disabled={pending}
                className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-bg/40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={add}
                disabled={pending || !newText.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        ) : null}

        {rules.length === 0 && !adding ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            No hay reglas globales aún. Añade aquí pautas que la IA debe respetar SIEMPRE, o márcalas
            desde el modal de revisión cuando ajustes un plan.
          </p>
        ) : null}

        {rules.map((r) => (
          <div
            key={r.id}
            className={`flex items-start gap-2 rounded-xl border p-3 transition ${
              r.active ? "border-border bg-bg/40" : "border-dashed border-border bg-bg/20 opacity-60"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(r.id, r.active)}
              disabled={pending}
              title={r.active ? "Desactivar (no se usará al generar)" : "Activar"}
              className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border ${
                r.active
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-surface text-muted"
              }`}
            >
              {r.active ? <Check size={12} /> : null}
            </button>
            <p className="flex-1 whitespace-pre-wrap text-sm leading-snug">{r.text}</p>
            <button
              type="button"
              onClick={() => remove(r.id)}
              disabled={pending}
              title="Borrar regla"
              className="rounded-md p-1 text-muted hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeedbackSection({ initial }: { initial: FeedbackDTO[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"all" | "good" | "bad">("all");
  const [pending, start] = useTransition();

  function remove(id: string) {
    if (!confirm("¿Borrar este feedback? La IA dejará de tenerlo en cuenta.")) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      await deletePlanGenerationFeedback(fd);
    });
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  const shown = filter === "all" ? items : items.filter((i) => i.verdict === filter);
  const counts = {
    all: items.length,
    good: items.filter((i) => i.verdict === "good").length,
    bad: items.filter((i) => i.verdict === "bad").length,
  };

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <p className="font-semibold">Histórico de feedback</p>
          <p className="text-xs text-muted">
            Razones de planes aceptados y rechazados. Las últimas se inyectan en el prompt como
            aprendizajes previos.
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-bg p-0.5 text-xs">
          {(["all", "good", "bad"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 font-semibold transition ${
                filter === f ? "bg-text text-bg" : "text-muted hover:text-text"
              }`}
            >
              {f === "all" ? "Todos" : f === "good" ? "Buenos" : "Malos"}{" "}
              <span className="opacity-70">({counts[f]})</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="space-y-2 px-5 py-4">
        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Aún no hay feedback archivado. Aparecerá cada vez que aceptes un plan "como ejemplo de
            referencia" o lo rechaces explicando por qué.
          </p>
        ) : null}

        {shown.map((f) => (
          <div
            key={f.id}
            className={`flex gap-3 rounded-xl border p-3 ${
              f.verdict === "good"
                ? "border-emerald-200 bg-emerald-50/40"
                : "border-red-200 bg-red-50/40"
            }`}
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                f.verdict === "good"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {f.verdict === "good" ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-muted">
                  {f.clientName ? `${f.clientName} · ` : ""}
                  {f.planName ?? "Plan eliminado"}
                </p>
                <span className="shrink-0 text-[11px] text-muted">{formatDate(f.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">{f.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => remove(f.id)}
              disabled={pending}
              title="Borrar feedback"
              className="self-start rounded-md p-1 text-muted hover:bg-red-50 hover:text-red-600"
            >
              <X size={14} />
            </button>
            {pending ? <Loader2 size={12} className="animate-spin self-start text-muted" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
