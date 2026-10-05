"use client";

import { useState, useTransition } from "react";
import { BookOpen, X, Loader2 } from "lucide-react";
import { convertPlanToTemplate } from "@/app/(panel)/planes/actions";
import {
  TEMPLATE_SEXES,
  TEMPLATE_GOALS,
  TEMPLATE_SEX_LABELS,
  TEMPLATE_GOAL_LABELS,
  type TemplateSex,
  type TemplateGoal,
} from "@/lib/nutritionTemplateShape";

const inputCls =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

export function ConvertPlanToTemplateButton({
  planId,
  defaultName,
  defaultSex,
  defaultGoal,
}: {
  planId: string;
  defaultName: string;
  defaultSex: TemplateSex | null;
  defaultGoal: TemplateGoal | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
        title="Guardar este plan como plantilla reutilizable"
      >
        <BookOpen size={14} /> Convertir en plantilla
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">Convertir en plantilla</h3>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                className="rounded-md p-1 text-muted hover:text-text"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 text-xs text-muted">
              Guardamos este plan tal cual en{" "}
              <strong>Biblioteca → Plantillas nutricionales</strong>. Después
              lo podrás aplicar a cualquier otro cliente cambiándole el nombre.
            </p>

            <form
              action={(fd) => {
                setError(null);
                start(async () => {
                  try {
                    await convertPlanToTemplate(fd);
                  } catch (e) {
                    const err = e as Error & { digest?: string };
                    // Los redirects de Next lanzan NEXT_REDIRECT — no es un error.
                    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
                    setError(err.message || "No se pudo crear la plantilla.");
                  }
                });
              }}
              className="space-y-3"
            >
              <input type="hidden" name="planId" value={planId} />

              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">
                  Nombre de la plantilla
                </span>
                <input
                  name="name"
                  defaultValue={defaultName}
                  required
                  maxLength={200}
                  className={inputCls}
                  placeholder="Ej. María García"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-semibold text-muted">Sexo</span>
                  <select
                    name="sex"
                    defaultValue={defaultSex ?? ""}
                    required
                    className={inputCls}
                  >
                    <option value="" disabled>
                      — Elige —
                    </option>
                    {TEMPLATE_SEXES.map((s) => (
                      <option key={s} value={s}>
                        {TEMPLATE_SEX_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-semibold text-muted">Objetivo</span>
                  <select
                    name="goal"
                    defaultValue={defaultGoal ?? ""}
                    required
                    className={inputCls}
                  >
                    <option value="" disabled>
                      — Elige —
                    </option>
                    {TEMPLATE_GOALS.map((g) => (
                      <option key={g} value={g}>
                        {TEMPLATE_GOAL_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!defaultSex || !defaultGoal ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  La ficha del cliente no tiene{" "}
                  {!defaultSex && !defaultGoal
                    ? "sexo ni objetivo"
                    : !defaultSex
                    ? "sexo"
                    : "objetivo"}{" "}
                  definido; elígelo manualmente.
                </p>
              ) : null}

              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">
                  Descripción (opcional)
                </span>
                <textarea
                  name="description"
                  rows={2}
                  className={inputCls}
                  placeholder="Pista corta para encontrarla luego."
                />
              </label>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Guardando…
                    </>
                  ) : (
                    "Crear plantilla"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
