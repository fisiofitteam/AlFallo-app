"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X, Loader2, Sparkles } from "lucide-react";
import {
  createPlan,
  deletePlan,
  renamePlan,
  generatePlanFromAI,
  generatePlanFromHB,
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
  const [genBusyHB, startGenHB] = useTransition();
  const [genBusyAI, startGenAI] = useTransition();

  const selected = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;

  function go(planId: string) {
    startNav(() => router.push(`/clientes/${clientId}?tab=plan&planId=${planId}`));
  }

  function generateHB() {
    if (!selected) return;
    if (
      !confirm(
        "Esto borra los días/comidas actuales del plan y crea una estructura nueva con Harris-Benedict. ¿Seguro?",
      )
    )
      return;
    const fd = new FormData();
    fd.set("planId", selected.id);
    startGenHB(async () => {
      await generatePlanFromHB(fd);
      window.location.reload();
    });
  }

  function generateAI() {
    if (!selected) return;
    if (
      !confirm(
        "Esto borra el plan actual y pide a la IA que escriba 5 comidas × 3 opciones con alimentos y gramos. Puede tardar 10-20 s. ¿Seguro?",
      )
    )
      return;
    const fd = new FormData();
    fd.set("planId", selected.id);
    startGenAI(async () => {
      await generatePlanFromAI(fd);
      window.location.reload();
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

      {/* Fila 2: generación HB / IA */}
      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-bg/40 px-5 py-3">
          <p className="text-xs text-muted">
            <span className="font-medium text-text">HB</span> recalcula objetivos y crea un esqueleto vacío ·{" "}
            <span className="font-medium text-text">IA</span> hace lo mismo y además rellena cada opción con alimentos y gramos.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateHB}
              disabled={genBusyHB || genBusyAI}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3.5 py-2 text-sm font-semibold text-text shadow-sm transition hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {genBusyHB ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generar con HB
            </button>
            <button
              type="button"
              onClick={generateAI}
              disabled={genBusyHB || genBusyAI}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--c-primary)" }}
              title="HB para objetivos + Claude para escribir cada opción con alimentos y gramos"
            >
              {genBusyAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generar con IA
            </button>
          </div>
        </div>
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
