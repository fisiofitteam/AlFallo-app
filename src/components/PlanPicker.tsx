"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X, Loader2 } from "lucide-react";
import { createPlan, deletePlan, renamePlan } from "@/app/(panel)/planes/actions";

export type PlanPickerItem = { id: string; name: string };

/**
 * Selector compacto del plan activo dentro de la pestaña del cliente.
 * Permite cambiar de plan (dropdown), renombrar inline (lápiz), borrar
 * (papelera) y crear uno nuevo (+ Añadir plan). La navegación entre planes
 * se hace por URL (?planId=...).
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

  function go(planId: string) {
    startNav(() => router.push(`/clientes/${clientId}?tab=plan&planId=${planId}`));
  }

  const selected = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;

  return (
    <div className="mb-5 rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
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
            <NewPlanInline
              clientId={clientId}
              onDone={(newId) => {
                setAdding(false);
                if (newId) go(newId);
              }}
            />
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
        className="rounded-md bg-primary p-1.5 text-white hover:opacity-90 disabled:opacity-50"
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
  onDone: (newId?: string) => void;
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
          // createPlan redirige a /planes/<id>; usamos navegación manual
          // tras invocar para volver a la ficha del cliente con el nuevo plan.
          // Como ambos casos son aceptables, dejamos que el redirect haga su
          // trabajo y la página se recarga; al volver, se elegirá el nuevo
          // plan por defecto (es el más reciente).
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
        className="rounded-md bg-primary p-1.5 text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button
        type="button"
        onClick={() => onDone()}
        title="Cancelar"
        className="rounded-md p-1.5 text-muted hover:bg-bg"
      >
        <X size={12} />
      </button>
    </form>
  );
}
