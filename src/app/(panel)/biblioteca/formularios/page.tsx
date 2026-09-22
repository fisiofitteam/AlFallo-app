import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { parseQuestions } from "@/lib/satisfactionForms";
import { createForm, deleteForm, toggleFormActive } from "./actions";

export const metadata = { title: "Formularios de satisfacción · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function SatisfactionFormsPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");

  const forms = await prisma.satisfactionForm.findMany({
    orderBy: [{ weekOffset: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { responses: true } } },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Formularios de satisfacción</h1>
        <p className="mt-1 text-sm text-muted">
          Cada formulario se le enseña automáticamente al atleta cuando lleva{" "}
          <strong>X semanas</strong> desde el inicio de su programa (fecha de venta).
        </p>
      </header>

      <form action={createForm} className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold">Nuevo formulario</p>
        <div className="grid gap-2 md:grid-cols-[1.6fr_0.6fr_auto]">
          <label className="block text-xs">
            <span className="font-semibold text-muted">Nombre</span>
            <input
              name="name"
              required
              placeholder="Ej. Satisfacción a las 4 semanas"
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
              defaultValue={4}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:opacity-90"
            >
              <Plus size={13} className="mr-1 inline" /> Crear
            </button>
          </div>
        </div>
      </form>

      <div className="space-y-2">
        {forms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
            Todavía no has creado ningún formulario.
          </p>
        ) : null}
        {forms.map((f) => {
          const qs = parseQuestions(f.questions);
          return (
            <article
              key={f.id}
              className={`flex items-center gap-3 rounded-2xl border p-4 ${
                f.active ? "border-border bg-surface" : "border-dashed border-border bg-bg/40"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                S{f.weekOffset}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.name}</p>
                <p className="text-xs text-muted">
                  Semana {f.weekOffset} · {qs.length} {qs.length === 1 ? "pregunta" : "preguntas"} ·{" "}
                  {f._count.responses} {f._count.responses === 1 ? "respuesta" : "respuestas"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={`/biblioteca/formularios/${f.id}`}
                  className="inline-flex items-center gap-1 rounded-md bg-bg px-2 py-1 text-[11px] font-medium text-text hover:bg-surface-2"
                >
                  <Pencil size={12} /> Editar
                </Link>
                <form action={toggleFormActive}>
                  <input type="hidden" name="id" value={f.id} />
                  <button
                    type="submit"
                    className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                      f.active
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-bg text-muted hover:bg-surface"
                    }`}
                  >
                    {f.active ? "Activo" : "Inactivo"}
                  </button>
                </form>
                <form action={deleteForm}>
                  <input type="hidden" name="id" value={f.id} />
                  <button
                    type="submit"
                    title="Borrar formulario"
                    className="rounded-md p-1 text-muted hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
