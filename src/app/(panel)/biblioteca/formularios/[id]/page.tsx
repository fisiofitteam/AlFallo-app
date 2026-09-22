import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { parseQuestions } from "@/lib/satisfactionForms";
import {
  addQuestion,
  moveQuestion,
  removeQuestion,
  updateFormMeta,
  updateQuestion,
} from "../actions";

export const metadata = { title: "Editar formulario · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function EditFormPage({ params }: { params: { id: string } }) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");

  const form = await prisma.satisfactionForm.findUnique({ where: { id: params.id } });
  if (!form) notFound();

  const questions = parseQuestions(form.questions);

  return (
    <div className="space-y-5">
      <Link
        href="/biblioteca/formularios"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
      >
        <ArrowLeft size={12} /> Todos los formularios
      </Link>

      <form action={updateFormMeta} className="rounded-2xl border border-border bg-surface p-4">
        <input type="hidden" name="id" value={form.id} />
        <div className="grid gap-2 md:grid-cols-[1.6fr_0.6fr_auto]">
          <label className="block text-xs">
            <span className="font-semibold text-muted">Nombre</span>
            <input
              name="name"
              required
              defaultValue={form.name}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Semana (offset)</span>
            <input
              name="weekOffset"
              type="number"
              min={0}
              required
              defaultValue={form.weekOffset}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:opacity-90"
            >
              Guardar
            </button>
          </div>
        </div>
      </form>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Preguntas</h2>
          <div className="flex gap-1">
            <form action={addQuestion}>
              <input type="hidden" name="id" value={form.id} />
              <input type="hidden" name="type" value="scale" />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-bg px-2 py-1 text-xs font-semibold hover:bg-surface-2"
              >
                <Plus size={12} /> Escala
              </button>
            </form>
            <form action={addQuestion}>
              <input type="hidden" name="id" value={form.id} />
              <input type="hidden" name="type" value="text" />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-bg px-2 py-1 text-xs font-semibold hover:bg-surface-2"
              >
                <Plus size={12} /> Texto libre
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-2">
          {questions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-muted">
              Añade la primera pregunta con los botones de arriba.
            </p>
          ) : null}
          {questions.map((q, i) => (
            <article key={q.id} className="rounded-2xl border border-border bg-surface p-4">
              <form action={updateQuestion} className="space-y-2">
                <input type="hidden" name="id" value={form.id} />
                <input type="hidden" name="questionId" value={q.id} />
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 items-center rounded-md bg-bg px-2 text-[10px] font-bold uppercase text-muted">
                    {q.type === "scale" ? "Escala" : "Texto"}
                  </span>
                  <input
                    name="label"
                    required
                    defaultValue={q.label}
                    placeholder="Pregunta"
                    className="flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                  />
                </div>
                {q.type === "scale" ? (
                  <div className="grid gap-2 md:grid-cols-4">
                    <label className="block text-xs">
                      <span className="font-semibold text-muted">Mín.</span>
                      <input
                        name="scaleMin"
                        type="number"
                        defaultValue={q.scaleMin}
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-semibold text-muted">Máx.</span>
                      <input
                        name="scaleMax"
                        type="number"
                        defaultValue={q.scaleMax}
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-semibold text-muted">Etiqueta mín. (opc.)</span>
                      <input
                        name="scaleMinLabel"
                        defaultValue={q.scaleMinLabel ?? ""}
                        placeholder="Nada satisfecho"
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-semibold text-muted">Etiqueta máx. (opc.)</span>
                      <input
                        name="scaleMaxLabel"
                        defaultValue={q.scaleMaxLabel ?? ""}
                        placeholder="Totalmente satisfecho"
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="block text-xs">
                    <span className="font-semibold text-muted">Placeholder (opc.)</span>
                    <input
                      name="placeholder"
                      defaultValue={q.placeholder ?? ""}
                      placeholder="Cuéntanoslo con tus palabras…"
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      name="required"
                      value="1"
                      defaultChecked={!!q.required}
                      className="rounded border-border text-primary"
                    />{" "}
                    Obligatoria
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
                  >
                    Guardar pregunta
                  </button>
                </div>
              </form>

              <div className="mt-2 flex items-center justify-end gap-1">
                <form action={moveQuestion}>
                  <input type="hidden" name="id" value={form.id} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={i === 0}
                    title="Subir"
                    className="rounded-md p-1 text-muted hover:text-primary disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                </form>
                <form action={moveQuestion}>
                  <input type="hidden" name="id" value={form.id} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={i === questions.length - 1}
                    title="Bajar"
                    className="rounded-md p-1 text-muted hover:text-primary disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </form>
                <form action={removeQuestion}>
                  <input type="hidden" name="id" value={form.id} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <button
                    type="submit"
                    title="Borrar pregunta"
                    className="rounded-md p-1 text-muted hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
