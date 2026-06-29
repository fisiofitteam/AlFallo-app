"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X, Loader2, Sparkles, UtensilsCrossed, Trophy } from "lucide-react";

// Exportado en este mismo fichero más abajo como "AddPlanButton" para
// reutilizarlo en la galería (PlanCards) sin necesidad de pintar todo el
// selector.
import {
  createPlan,
  deletePlan,
  renamePlan,
  previewPlanGeneration,
  type DraftPayload,
} from "@/app/(panel)/planes/actions";
import { PlanReviewModal } from "@/components/PlanReviewModal";

export type PlanPickerItem = { id: string; name: string; kind: string };
export type ConsiderationOption = { id: string; title: string };
export type GoalOption = { value: string; label: string };

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
  goalOptions,
  considerations,
  competitionTemplates,
}: {
  clientId: string;
  plans: PlanPickerItem[];
  selectedPlanId: string | null;
  goalOptions: GoalOption[];
  considerations: ConsiderationOption[];
  competitionTemplates: CompetitionTemplateOption[];
}) {
  const router = useRouter();
  const [, startNav] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [genBusy, startGen] = useTransition();
  // Borrador en revisión tras pulsar Generar plan. Cuando esté seteado se
  // muestra el PlanReviewModal y el nutri decide aceptar/ajustar/rechazar.
  const [pendingReview, setPendingReview] = useState<{
    draftId: string;
    payload: DraftPayload;
  } | null>(null);

  const selected = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;

  function go(planId: string) {
    startNav(() => router.push(`/clientes/${clientId}?tab=plan&planId=${planId}`));
  }

  function runGenerate() {
    if (!selected) return;
    if (
      !confirm(
        "La IA va a proponerte un plan nuevo (pauta nutricional). Lo verás en un panel antes de aplicarlo. Puede tardar 10-20 s. ¿Seguir?",
      )
    )
      return;
    const fd = new FormData();
    fd.set("planId", selected.id);
    startGen(async () => {
      const r = await previewPlanGeneration(fd);
      if ("error" in r) {
        alert(r.error ?? "Error generando plan");
        return;
      }
      setPendingReview({ draftId: r.draftId, payload: r.payload });
    });
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
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text hover:border-primary hover:text-primary"
          >
            <Plus size={12} /> Añadir plan
          </button>
        </div>
      </div>

      {/* Fila 2: generación con IA — solo para pauta. Los planes de
          competición se construyen aplicando una plantilla al crearlos,
          NO con IA. */}
      {selected && selected.kind !== "competition" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-bg/40 px-5 py-3">
          <p className="text-xs text-muted">
            <span className="font-medium text-text">Harris-Benedict</span> recalcula los macros objetivo del
            cliente y la <span className="font-medium text-text">IA</span> escribe cada opción con alimentos
            y gramos.
          </p>
          <button
            type="button"
            onClick={runGenerate}
            disabled={genBusy}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--c-primary)" }}
          >
            {genBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generar plan
          </button>
        </div>
      ) : selected && selected.kind === "competition" ? (
        <div className="border-t border-border bg-amber-50 px-5 py-3 text-xs text-amber-800">
          🏆 Plan de competición — se gestiona desde su plantilla en{" "}
          <a
            href="/biblioteca/competicion"
            className="font-semibold underline"
            target="_blank"
            rel="noreferrer"
          >
            Biblioteca → Plantillas de competición
          </a>
          . Lo editas directamente en este builder.
        </div>
      ) : null}

      {adding ? (
        <AddPlanModal
          clientId={clientId}
          goalOptions={goalOptions}
          considerations={considerations}
          competitionTemplates={competitionTemplates}
          onClose={() => setAdding(false)}
          onDraftReady={(d) => {
            setAdding(false);
            setPendingReview(d);
          }}
        />
      ) : null}

      {pendingReview ? (
        <PlanReviewModal
          draftId={pendingReview.draftId}
          payload={pendingReview.payload}
          onClose={() => setPendingReview(null)}
          onAccepted={() => {
            setPendingReview(null);
            window.location.reload();
          }}
          onRejected={() => setPendingReview(null)}
        />
      ) : null}
    </section>
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

/** Botón standalone "+ Añadir plan" + modal. Lo usa la galería de planes
 *  (PlanCards) cuando todavía no se ha entrado a ninguno. */
export function AddPlanButton({
  clientId,
  goalOptions,
  considerations,
  competitionTemplates,
  variant = "primary",
}: {
  clientId: string;
  goalOptions: GoalOption[];
  considerations: ConsiderationOption[];
  competitionTemplates: CompetitionTemplateOption[];
  variant?: "primary" | "subtle";
}) {
  const [open, setOpen] = useState(false);
  const [pendingReview, setPendingReview] = useState<{
    draftId: string;
    payload: DraftPayload;
  } | null>(null);
  const cls =
    variant === "primary"
      ? "flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90"
      : "flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text hover:border-primary hover:text-primary";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cls}>
        <Plus size={variant === "primary" ? 16 : 12} /> Añadir plan
      </button>
      {open ? (
        <AddPlanModal
          clientId={clientId}
          goalOptions={goalOptions}
          considerations={considerations}
          competitionTemplates={competitionTemplates}
          onClose={() => setOpen(false)}
          onDraftReady={(d) => {
            setOpen(false);
            setPendingReview(d);
          }}
        />
      ) : null}
      {pendingReview ? (
        <PlanReviewModal
          draftId={pendingReview.draftId}
          payload={pendingReview.payload}
          onClose={() => setPendingReview(null)}
          onAccepted={() => {
            setPendingReview(null);
            window.location.reload();
          }}
          onRejected={() => setPendingReview(null)}
        />
      ) : null}
    </>
  );
}

export type CompetitionTemplateOption = { id: string; name: string; description: string | null };

function AddPlanModal({
  clientId,
  goalOptions,
  considerations,
  competitionTemplates,
  onClose,
  onDraftReady,
}: {
  clientId: string;
  goalOptions: GoalOption[];
  considerations: ConsiderationOption[];
  /** Plantillas de competición disponibles (CRUD vive en Biblioteca →
   *  Plantillas de competición). En este modal solo se eligen. */
  competitionTemplates: CompetitionTemplateOption[];
  onClose: () => void;
  /** Llamado cuando el plan se ha creado Y la IA ha generado un draft que
   *  toca revisar. Pasa los datos al padre para abrir el ReviewModal. */
  onDraftReady: (d: { draftId: string; payload: DraftPayload }) => void;
}) {
  // Tipo de plan al crear: pauta nutricional (default) o plan de competición.
  // Cambia los campos visibles del modal y se persiste en NutritionPlan.kind.
  const [kind, setKind] = useState<"regular" | "competition">("regular");
  const [name, setName] = useState("Plan nutricional");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [goalOverride, setGoalOverride] = useState("");
  const [considerationId, setConsiderationId] = useState("");
  const [templateId, setTemplateId] = useState("");
  // Override de macros SOLO para este plan. Si los cuatro tienen valor,
  // ganan sobre los macros oficiales del cliente. Parciales se ignoran.
  const [kcalOverride, setKcalOverride] = useState("");
  const [proteinOverride, setProteinOverride] = useState("");
  const [carbsOverride, setCarbsOverride] = useState("");
  const [fatOverride, setFatOverride] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [pending, start] = useTransition();

  // Reglas:
  // - Pauta nutricional: necesita nombre.
  // - Plan de competición: necesita nombre + plantilla elegida (porque la
  //   plantilla aporta la estructura del plan; ya no se genera con IA).
  const canSubmit =
    name.trim().length > 0 &&
    (kind === "regular" || templateId.length > 0);

  // Al cambiar a competición, sugerimos un nombre por defecto si el nutri
  // todavía no lo había cambiado (y viceversa para no dejarlo raro).
  function selectKind(next: "regular" | "competition") {
    setKind(next);
    if (next === "competition" && name === "Plan nutricional") setName("Plan de competición");
    if (next === "regular" && name === "Plan de competición") setName("Plan nutricional");
  }

  function submit() {
    if (!canSubmit) return;
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("name", name.trim());
    if (description.trim()) fd.set("description", description.trim());
    if (kind === "competition") {
      fd.set("kind", "competition");
      fd.set("competitionTemplateId", templateId);
      // Competición ya NO usa IA: ignoramos autoGenerate / instructions.
    } else {
      if (instructions.trim()) fd.set("instructions", instructions.trim());
      if (autoGenerate) fd.set("autoGenerate", "true");
      if (goalOverride) fd.set("goalOverride", goalOverride);
      if (considerationId) fd.set("specialConsiderationOverrideId", considerationId);
      // Macros override: solo si los 4 están rellenos (parciales no tienen
      // sentido; backend filtra igualmente con parseNumber + check).
      if (
        kcalOverride.trim() &&
        proteinOverride.trim() &&
        carbsOverride.trim() &&
        fatOverride.trim()
      ) {
        fd.set("kcalOverride", kcalOverride);
        fd.set("proteinOverride", proteinOverride);
        fd.set("carbsOverride", carbsOverride);
        fd.set("fatOverride", fatOverride);
      }
    }
    start(async () => {
      // createPlan ya no redirige: devuelve { planId, clientId, draftId, payload }.
      // - Pauta + autoGenerate + IA OK → abre review modal.
      // - Competición → plan ya rellenado por la plantilla; redirigimos al builder.
      // - Pauta sin autoGenerate → galería del cliente.
      const r = await createPlan(fd);
      if (!("ok" in r)) return;
      if (r.draftId && r.payload) {
        onDraftReady({ draftId: r.draftId, payload: r.payload });
        return;
      }
      window.location.href = `/clientes/${r.clientId}?tab=plan&planId=${r.planId}`;
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        // max-h + overflow-y-auto: con el form de competición el modal puede
        // crecer bastante; permitimos scroll interno en pantallas pequeñas.
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="font-semibold">Añadir plan</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-text"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {/* Tipo de plan: dos botones grandes en la cabecera del form. */}
          <div>
            <span className="block text-sm font-semibold">Tipo de plan</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectKind("regular")}
                disabled={pending}
                className={`flex items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                  kind === "regular"
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-bg hover:border-primary/60"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    kind === "regular" ? "bg-primary text-primary-fg" : "bg-primary-soft text-primary"
                  }`}
                >
                  <UtensilsCrossed size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Pauta nutricional</span>
                  <span className="block text-[11px] leading-snug text-muted">
                    Plan habitual con macros del cliente y 5 comidas × 3 opciones.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectKind("competition")}
                disabled={pending}
                className={`flex items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                  kind === "competition"
                    ? "border-amber-400 bg-amber-50"
                    : "border-border bg-bg hover:border-amber-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    kind === "competition"
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Trophy size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Plan de competición</span>
                  <span className="block text-[11px] leading-snug text-muted">
                    Plan puntual para una prueba: aplica el brief de Rendimiento y se ajusta a los WODs.
                  </span>
                </span>
              </button>
            </div>
          </div>

          <label className="block">
            <span className="block text-sm font-semibold">Nombre del plan</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "competition" ? "Plan de competición" : "Plan nutricional"}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-semibold">Descripción (la verá el cliente)</span>
            <span className="block text-xs text-muted">
              Frase corta para que el atleta entienda de qué va este plan. Ej. "Semana de mañana",
              "Días de descarga", "Pre-Hyrox". Opcional — la podrás editar luego en la galería.
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                kind === "competition"
                  ? "Ej. Carga 36-24h antes del Hyrox Madrid"
                  : "Ej. Semana de mañana — entrenas antes de comer"
              }
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          {/* Campos condicionales: pauta (con IA) vs competición (plantilla). */}
          {kind === "regular" ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-sm font-semibold">Objetivo del plan</span>
                  <span className="block text-xs text-muted">
                    Si lo dejas en automático, se usa el objetivo del cliente.
                  </span>
                  <select
                    value={goalOverride}
                    onChange={(e) => setGoalOverride(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Usar el del cliente</option>
                    {goalOptions.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-semibold">Consideración especial</span>
                  <span className="block text-xs text-muted">
                    Solo para este plan, anula las marcadas en la ficha.
                  </span>
                  <select
                    value={considerationId}
                    onChange={(e) => setConsiderationId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Usar las de la ficha</option>
                    {considerations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Override de macros SOLO para este plan. Si rellenas los 4
                  valores, ganan sobre los macros oficiales de la ficha del
                  cliente. Si lo dejas todo en blanco, se usan los de ficha
                  (que es lo normal). Útil para pedir un plan puntual con
                  macros distintos sin tocar el cliente global. */}
              <div className="rounded-lg border border-dashed border-border bg-bg/40 p-3">
                <p className="text-sm font-semibold">Macros solo para este plan</p>
                <p className="text-xs text-muted">
                  Opcional. Si rellenas los cuatro, ganan sobre la ficha del cliente. En blanco se
                  usan los de su ficha.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="block text-xs">
                    <span className="font-semibold text-muted">Kcal</span>
                    <input
                      value={kcalOverride}
                      onChange={(e) => setKcalOverride(e.target.value)}
                      inputMode="numeric"
                      placeholder="2100"
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-muted">Prot (g)</span>
                    <input
                      value={proteinOverride}
                      onChange={(e) => setProteinOverride(e.target.value)}
                      inputMode="numeric"
                      placeholder="160"
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-muted">Carbos (g)</span>
                    <input
                      value={carbsOverride}
                      onChange={(e) => setCarbsOverride(e.target.value)}
                      inputMode="numeric"
                      placeholder="210"
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-muted">Grasa (g)</span>
                    <input
                      value={fatOverride}
                      onChange={(e) => setFatOverride(e.target.value)}
                      inputMode="numeric"
                      placeholder="70"
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="block text-sm font-semibold">Instrucciones para la IA</span>
                <span className="block text-xs text-muted">
                  Lo que quieras que la IA tenga en cuenta al generar este plan: enfoque, alimentos
                  a forzar / evitar, presentación, etc. Opcional.
                </span>
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Ej. Necesita mucha proteína porque viene de bajada en analítica. Prefiere arroz blanco a integral. Cena temprano (sobre 20:30). Sin lácteos de vaca."
                  className="mt-1.5 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={(e) => setAutoGenerate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-[color:var(--c-primary)]"
                />
                <span>
                  <strong>Generar con IA al crear</strong>
                  <span className="block text-xs text-muted">
                    Si lo desactivas, el plan se crea vacío y lo generas tú con el botón
                    "Generar plan" cuando quieras. (Tardará 10-20 s si lo activas.)
                  </span>
                </span>
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="block text-sm font-semibold">
                  Plantilla a aplicar <span className="text-red-500">*</span>
                </span>
                <span className="block text-xs text-muted">
                  Se copia la estructura entera al plan del cliente. Después la ajustas en el
                  builder para este atleta concreto. Las plantillas se gestionan en{" "}
                  <strong>Biblioteca → Plantillas de competición</strong>.
                </span>
                {competitionTemplates.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    No hay plantillas todavía. Crea la primera en{" "}
                    <a
                      href="/biblioteca/competicion"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline"
                    >
                      Biblioteca → Plantillas de competición
                    </a>
                    .
                  </p>
                ) : (
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">— Elige una plantilla —</option>
                    {competitionTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.description ? ` — ${t.description.slice(0, 60)}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Los planes de competición ya no se generan con IA — son demasiado individuales.
                Aplicas una plantilla y la afinas a mano para este atleta.
              </p>
            </>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg hover:text-text disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--c-primary)" }}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {autoGenerate ? "Crear y generar plan" : "Crear plan"}
          </button>
        </footer>
      </div>
    </div>
  );
}
