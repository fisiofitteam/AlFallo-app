"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Loader2,
  Pencil,
  Sparkles,
  ThumbsDown,
  X,
} from "lucide-react";
import {
  acceptPlanDraft,
  rejectPlanDraft,
  regeneratePlanDraft,
  type DraftPayload,
} from "@/app/(panel)/planes/actions";

/**
 * Modal de revisión post-generación. La IA acaba de proponer un plan: el
 * nutri lo ve aquí y decide aceptar / ajustar / rechazar. Cada decisión va
 * a una server action distinta; "ajustar" reabre el mismo modal con el
 * nuevo borrador.
 *
 * Lo monta el caller pasando draftId + payload iniciales (el resultado de
 * previewPlanGeneration o createPlan con autoGenerate). El propio modal
 * mantiene el estado del intento actual y se autoactualiza al regenerar.
 */

type Mode = "accept" | "adjust" | "reject";

const MEAL_LABEL: Record<string, string> = {
  desayuno: "Desayuno",
  media_manana: "Media mañana",
  comida: "Comida",
  merienda: "Merienda",
  cena: "Cena",
};

const SUB_LABEL: Record<string, string> = {
  intro: "Intro",
  grasas: "Grasas",
  carbos: "Carbos",
  proteina: "Proteína",
  postre: "Postre",
};

export function PlanReviewModal({
  draftId: initialDraftId,
  payload: initialPayload,
  onClose,
  onAccepted,
  onRejected,
}: {
  draftId: string;
  payload: DraftPayload;
  onClose: () => void;
  onAccepted: (planId: string) => void;
  onRejected: () => void;
}) {
  const [draftId, setDraftId] = useState(initialDraftId);
  const [payload, setPayload] = useState<DraftPayload>(initialPayload);
  const [mode, setMode] = useState<Mode>("accept");
  const [acceptReason, setAcceptReason] = useState("");
  const [saveAsExample, setSaveAsExample] = useState(false);
  const [adjustInstruction, setAdjustInstruction] = useState("");
  const [saveAsRule, setSaveAsRule] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleAccept() {
    setError(null);
    const fd = new FormData();
    fd.set("draftId", draftId);
    if (saveAsExample && acceptReason.trim()) {
      fd.set("saveAsExample", "true");
      fd.set("reason", acceptReason.trim());
    }
    start(async () => {
      const r = await acceptPlanDraft(fd);
      if ("error" in r) {
        setError(r.error ?? "Error desconocido");
        return;
      }
      onAccepted(r.planId);
    });
  }

  function handleReject() {
    setError(null);
    if (!rejectReason.trim()) {
      setError("Cuéntale a la IA qué no funcionó.");
      return;
    }
    const fd = new FormData();
    fd.set("draftId", draftId);
    fd.set("reason", rejectReason.trim());
    start(async () => {
      const r = await rejectPlanDraft(fd);
      if ("error" in r) {
        setError(r.error ?? "Error desconocido");
        return;
      }
      onRejected();
    });
  }

  function handleAdjust() {
    setError(null);
    if (!adjustInstruction.trim()) {
      setError("Escribe el ajuste que quieres que aplique.");
      return;
    }
    const fd = new FormData();
    fd.set("draftId", draftId);
    fd.set("instruction", adjustInstruction.trim());
    if (saveAsRule) fd.set("saveAsRule", "true");
    start(async () => {
      const r = await regeneratePlanDraft(fd);
      if ("error" in r) {
        setError(r.error ?? "Error desconocido");
        return;
      }
      // Recibido un draft nuevo: lo sustituimos in-situ y reseteamos el form
      // de ajuste para el siguiente intento.
      setDraftId(r.draftId);
      setPayload(r.payload);
      setAdjustInstruction("");
      setSaveAsRule(false);
      setMode("accept");
    });
  }

  const ctx = payload.contextSnapshot;
  const totals = sumDraftMacros(payload);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface shadow-2xl">
        <header className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Revisa el plan generado
            </p>
            <h2 className="mt-0.5 truncate text-lg font-bold">
              {ctx.planName} · {ctx.clientName}
            </h2>
            {ctx.lastInstruction ? (
              <p className="mt-1 text-xs italic text-muted">
                Ajuste aplicado: "{ctx.lastInstruction}"
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            title="Cerrar sin decidir (se descartará el borrador)"
            className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-text"
          >
            <X size={16} />
          </button>
        </header>

        {/* Resumen de macros del día */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-bg/40 px-5 py-3 text-sm">
          <span className="rounded-full bg-primary-soft px-3 py-1 font-bold text-primary">
            {totals.kcal} kcal
          </span>
          <span className="text-muted">
            <span className="font-semibold text-text">P</span> {totals.protein} g ·{" "}
            <span className="font-semibold text-text">C</span> {totals.carbs} g ·{" "}
            <span className="font-semibold text-text">G</span> {totals.fat} g
          </span>
          {payload.targets ? (
            <span className="ml-auto text-xs text-muted">
              Objetivo: {payload.targets.kcal} kcal · P {payload.targets.protein} · C{" "}
              {payload.targets.carbs} · G {payload.targets.fat}
            </span>
          ) : null}
        </div>

        {/* Cuerpo: plan completo, scroll interno */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DraftPreview payload={payload} />
        </div>

        {/* Tabs de decisión */}
        <div className="border-t border-border bg-bg/30">
          <div className="flex border-b border-border">
            <DecisionTab
              icon={<Check size={14} />}
              label="Está genial"
              active={mode === "accept"}
              onClick={() => setMode("accept")}
              color="green"
            />
            <DecisionTab
              icon={<Pencil size={14} />}
              label="Ajustar"
              active={mode === "adjust"}
              onClick={() => setMode("adjust")}
              color="amber"
            />
            <DecisionTab
              icon={<ThumbsDown size={14} />}
              label="Está mal"
              active={mode === "reject"}
              onClick={() => setMode("reject")}
              color="red"
            />
          </div>

          <div className="space-y-3 px-5 py-4">
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : null}

            {mode === "accept" ? (
              <>
                <label className="flex items-start gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveAsExample}
                    onChange={(e) => setSaveAsExample(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[color:var(--c-primary)]"
                  />
                  <span>
                    <strong>Archivar como ejemplo de referencia</strong>
                    <span className="block text-xs text-muted">
                      La IA verá la razón en futuras generaciones para repetir lo que hizo bien.
                    </span>
                  </span>
                </label>
                {saveAsExample ? (
                  <textarea
                    value={acceptReason}
                    onChange={(e) => setAcceptReason(e.target.value)}
                    rows={3}
                    placeholder="¿Por qué este plan está bien? Ej. variedad en proteínas, distribución de carbos coherente, opciones realistas para hacer en 5 min…"
                    className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                ) : null}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={pending}
                    className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={pending || (saveAsExample && !acceptReason.trim())}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1fa971] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Guardar plan
                  </button>
                </div>
              </>
            ) : null}

            {mode === "adjust" ? (
              <>
                <textarea
                  value={adjustInstruction}
                  onChange={(e) => setAdjustInstruction(e.target.value)}
                  rows={3}
                  placeholder="Dile a la IA qué cambiar. Ej. 'Añade más variedad de proteínas, pollo solo una vez. Mete más fruta en las meriendas.'"
                  className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <label className="flex items-start gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveAsRule}
                    onChange={(e) => setSaveAsRule(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[color:var(--c-primary)]"
                  />
                  <span>
                    <strong>Guardar como regla general</strong>
                    <span className="block text-xs text-muted">
                      Esta instrucción se aplicará a TODOS los planes futuros (gestionable desde
                      Biblioteca → Aprendizaje IA).
                    </span>
                  </span>
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={pending}
                    className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAdjust}
                    disabled={pending || !adjustInstruction.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Regenerar con este ajuste
                  </button>
                </div>
              </>
            ) : null}

            {mode === "reject" ? (
              <>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="¿Qué falla en este plan? Ej. 'Demasiado pollo, falta pescado. Las raciones de carbos son altas para una mujer de 55 kg.'"
                  className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="text-xs text-muted">
                  El plan no se guarda. La razón se archiva como aprendizaje para que la IA evite
                  el mismo error en futuras generaciones.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={pending}
                    className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={pending || !rejectReason.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsDown size={14} />}
                    Descartar y archivar feedback
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DecisionTab({
  icon,
  label,
  active,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color: "green" | "amber" | "red";
}) {
  const activeCls =
    color === "green"
      ? "border-[#1fa971] text-[#15803d]"
      : color === "amber"
        ? "border-amber-500 text-amber-700"
        : "border-red-600 text-red-700";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition ${
        active ? activeCls : "border-transparent text-muted hover:text-text"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DraftPreview({ payload }: { payload: DraftPayload }) {
  const days = payload.draft.days;
  return (
    <div className="space-y-4">
      {days.map((day, di) => (
        <section key={di}>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">
            {day.name}
          </h3>
          <div className="space-y-2">
            {day.meals.map((meal, mi) => {
              const composed = meal.name === "comida" || meal.name === "cena";
              if (!composed) {
                return (
                  <div key={mi} className="rounded-xl bg-bg p-3">
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                      {MEAL_LABEL[meal.name] ?? meal.name}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {meal.options.map((o, oi) => (
                        <li key={oi} className="rounded-md bg-surface p-2 leading-snug">
                          <span className="mr-2 text-[10px] font-bold text-primary">
                            Opción {oi + 1}
                          </span>
                          {o.text}
                          <span className="ml-2 text-[10px] text-muted">
                            ({o.kcal} kcal · P{o.protein} · C{o.carbs} · G{o.fat})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              // comida/cena con subgrupos
              const groups: Record<string, typeof meal.options> = {};
              for (const o of meal.options) {
                const k = o.subType ?? "_";
                (groups[k] ||= []).push(o);
              }
              const order = ["intro", "grasas", "carbos", "proteina", "postre"];
              return (
                <div key={mi} className="rounded-xl bg-bg p-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                    {MEAL_LABEL[meal.name] ?? meal.name}
                  </p>
                  {order
                    .filter((k) => groups[k]?.length)
                    .map((k) => (
                      <div key={k} className="mb-2 last:mb-0">
                        <p className="mb-1 text-[10px] font-bold tracking-wider text-primary">
                          {SUB_LABEL[k]?.toUpperCase()}
                        </p>
                        <ul className="space-y-1 text-sm">
                          {groups[k].map((o, oi) => (
                            <li key={oi} className="rounded-md bg-surface p-2 leading-snug">
                              {o.text}
                              <span className="ml-2 text-[10px] text-muted">
                                ({o.kcal} kcal)
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Observaciones + suplementación generadas por la IA */}
      {payload.draft.notes ? (
        <section className="rounded-xl border border-primary/20 bg-primary-soft/30 p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
            Observaciones
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{payload.draft.notes}</p>
        </section>
      ) : null}
      {payload.draft.supplementation ? (
        <section className="rounded-xl border border-primary/20 bg-primary-soft/30 p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
            Suplementación
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {payload.draft.supplementation}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function sumDraftMacros(payload: DraftPayload) {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  // En comida/cena los subgrupos representan UNA combinación: tomamos la
  // primera opción de cada subgrupo (es la que queda "seleccionada" tras
  // commit). Para comidas simples, la primera opción del array.
  for (const day of payload.draft.days) {
    for (const meal of day.meals) {
      const seen = new Set<string>();
      for (const o of meal.options) {
        const key = o.subType ?? "_flat";
        if (seen.has(key)) continue;
        seen.add(key);
        kcal += o.kcal;
        protein += o.protein;
        carbs += o.carbs;
        fat += o.fat;
        if (!o.subType) break; // simple meal: solo la primera
      }
    }
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}
