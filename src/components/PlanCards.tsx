"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, Trophy, UtensilsCrossed, Check, X } from "lucide-react";
import type { PlanCardData } from "@/lib/planSummary";
import { deletePlan, updatePlanDescription } from "@/app/(panel)/planes/actions";

/**
 * Galería de planes. Sirve tanto al cliente (modo "cliente": solo lectura,
 * click → /cliente/plan?id=X) como al nutri (modo "panel": editar
 * descripción inline, borrar plan, click → /clientes/<cid>?tab=plan&planId=X).
 *
 * El nutri rellena la descripción aquí; el cliente la lee. La macro grande
 * arriba a la derecha es la del "día tipo" del plan.
 */
type Mode = "cliente" | "panel";

export function PlanCards({
  mode,
  clientId,
  plans,
}: {
  mode: Mode;
  clientId: string;
  plans: PlanCardData[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {plans.map((p) => (
        <PlanCard key={p.id} mode={mode} clientId={clientId} plan={p} />
      ))}
    </div>
  );
}

function PlanCard({
  mode,
  clientId,
  plan,
}: {
  mode: Mode;
  clientId: string;
  plan: PlanCardData;
}) {
  const href =
    mode === "cliente"
      ? `/cliente/plan?id=${plan.id}`
      : `/clientes/${clientId}?tab=plan&planId=${plan.id}`;

  const isCompetition = plan.kind === "competition";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary hover:shadow-sm">
      {/* Click cubre toda la card excepto los botones de acción (z-10 abajo). */}
      <Link href={href} className="absolute inset-0 z-0" aria-label={`Abrir ${plan.name}`} />

      <div className="relative z-0 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isCompetition ? "bg-amber-100 text-amber-700" : "bg-primary-soft text-primary"
                }`}
              >
                {isCompetition ? <Trophy size={16} /> : <UtensilsCrossed size={16} />}
              </span>
              <h3 className="truncate text-base font-bold">{plan.name}</h3>
            </div>
            {isCompetition && plan.competitionName ? (
              <p className="mt-1 text-xs font-medium text-amber-700">{plan.competitionName}</p>
            ) : null}
          </div>

          {/* Macros del día tipo (suma de items seleccionados). */}
          {!plan.isEmpty ? (
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold leading-none text-primary">{plan.kcal}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">kcal/día</p>
            </div>
          ) : (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Vacío
            </span>
          )}
        </div>

        {/* Descripción visible para el cliente. En el panel se puede editar. */}
        <DescriptionBlock mode={mode} planId={plan.id} initial={plan.description ?? ""} />

        {/* Pastilla de macros P/C/G — solo si el plan tiene contenido. */}
        {!plan.isEmpty ? (
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium">
            <Macro label="P" value={plan.protein} />
            <Macro label="C" value={plan.carbs} />
            <Macro label="G" value={plan.fat} />
            {plan.dayCount > 1 ? (
              <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                {plan.dayCount} días
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Acción borrar — solo panel. z-10 para sentarse encima del Link. */}
      {mode === "panel" ? <DeleteButton planId={plan.id} planName={plan.name} /> : null}
    </article>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
      <span className="font-bold text-text">{label}</span> {value} g
    </span>
  );
}

function DescriptionBlock({
  mode,
  planId,
  initial,
}: {
  mode: Mode;
  planId: string;
  initial: string;
}) {
  // Cliente → solo lectura (texto plano).
  if (mode === "cliente") {
    if (!initial.trim()) return null;
    return <p className="mt-2 line-clamp-3 text-sm text-muted">{initial}</p>;
  }
  // Panel → editor inline en sitio.
  return <DescriptionEditor planId={planId} initial={initial} />;
}

function DescriptionEditor({ planId, initial }: { planId: string; initial: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  // En lectura mostramos el texto o un placeholder gris invitando a editar.
  // Botón "Editar" con pencil, z-10 para no disparar el Link de la card.
  if (!editing) {
    return (
      <div className="relative z-10 mt-2 flex items-start gap-2">
        <p
          className={`flex-1 text-sm ${
            initial.trim() ? "text-muted" : "italic text-zinc-400"
          }`}
        >
          {initial.trim() || "Añade una descripción para que tu cliente sepa de qué va el plan…"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setEditing(true);
          }}
          title="Editar descripción"
          className="rounded-md border border-border p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:border-primary hover:text-primary"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  return (
    <form
      // z-10 sobre el Link de la card.
      className="relative z-10 mt-2"
      onClick={(e) => e.stopPropagation()}
      action={(fd) => {
        fd.set("planId", planId);
        fd.set("description", value);
        start(async () => {
          await updatePlanDescription(fd);
          setEditing(false);
          router.refresh();
        });
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Ej. Semana de mañana — entrenas antes de comer. Macros enfocadas a recovery por la tarde."
        className="w-full resize-y rounded-lg border border-primary/40 bg-bg px-2.5 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="mt-1.5 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setValue(initial);
            setEditing(false);
          }}
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-bg disabled:opacity-50"
        >
          <X size={12} className="inline" /> Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 size={12} className="inline animate-spin" /> : <Check size={12} className="inline" />}{" "}
          Guardar
        </button>
      </div>
    </form>
  );
}

function DeleteButton({ planId, planName }: { planId: string; planName: string }) {
  return (
    <form
      // z-10 para sentarse sobre el Link transparente.
      className="absolute right-2 top-2 z-10"
      action={async (fd) => {
        if (
          !confirm(
            `¿Borrar el plan "${planName}"? Se eliminan todos sus días, comidas y opciones.`,
          )
        )
          return;
        await deletePlan(fd);
      }}
    >
      <input type="hidden" name="planId" value={planId} />
      <button
        type="submit"
        title="Borrar plan"
        className="rounded-md border border-transparent p-1.5 text-muted opacity-0 transition group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={14} />
      </button>
    </form>
  );
}
