import Link from "next/link";
import { redirect } from "next/navigation";
import { Lightbulb, Plus, Trash2, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { optionLabel } from "@/lib/clients";
import {
  CONTENT_ACCESS_ROLES,
  CONTENT_STATUSES,
  CONTENT_STATUS_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  contentStatusBadgeClass,
} from "@/lib/content";
import { Field, Select, TextInput } from "@/components/form-ui";
import { createIdea, createPiece, deleteIdea, setPieceStatus } from "./actions";

export const metadata = { title: "Contenido · Al Fallo Nutrition" };

export default async function ContentPage() {
  const prof = await requireProfessional();
  if (!CONTENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const [pieces, ideas] = await Promise.all([
    prisma.contentPiece.findMany({ orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }] }),
    prisma.contentIdea.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Contenido</h1>
        <p className="mt-1 text-muted">Planificación de contenido para Instagram.</p>
      </header>

      {/* Nueva pieza */}
      <form action={createPiece} className="mb-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-semibold">Nueva pieza</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Título" htmlFor="title">
            <TextInput id="title" name="title" required placeholder="Ej. 5 errores con la proteína" />
          </Field>
          <Field label="Tipo" htmlFor="type">
            <Select id="type" name="type" options={CONTENT_TYPE_OPTIONS} placeholder="Reel" />
          </Field>
          <Field label="Estado" htmlFor="status">
            <Select id="status" name="status" options={CONTENT_STATUS_OPTIONS} placeholder="Idea" />
          </Field>
          <Field label="Fecha prevista" htmlFor="scheduledFor">
            <TextInput id="scheduledFor" name="scheduledFor" type="date" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
            <Plus size={16} /> Añadir pieza
          </button>
        </div>
      </form>

      {/* Tablero por estado */}
      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {CONTENT_STATUSES.map((col) => {
          const items = pieces.filter((p) => p.status === col.value);
          return (
            <div key={col.value} className="rounded-2xl bg-surface-2 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-xs text-muted">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-surface p-3">
                    <Link href={`/contenido/${p.id}`} className="block font-medium hover:text-primary">
                      {p.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5">
                        {optionLabel(CONTENT_TYPE_OPTIONS, p.type)}
                      </span>
                      {p.scheduledFor && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {p.scheduledFor.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    {/* Cambio rápido de estado */}
                    <form action={setPieceStatus} className="mt-2">
                      <input type="hidden" name="id" value={p.id} />
                      <select
                        name="status"
                        defaultValue={p.status}
                        className={`w-full rounded-lg border-0 px-2 py-1 text-xs font-medium ${contentStatusBadgeClass(p.status)}`}
                      >
                        {CONTENT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </form>
                  </div>
                ))}
                {items.length === 0 && <p className="px-1 py-2 text-xs text-muted">—</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="-mt-8 mb-10 text-xs text-muted">
        Pulsa una pieza para escribir su gancho y guion. Cambia el estado con el desplegable de cada tarjeta.
      </p>

      {/* Banco de ideas */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Lightbulb size={20} className="text-primary" /> Banco de ideas
        </h2>
        <form action={createIdea} className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <TextInput name="title" placeholder="Apunta una idea rápida…" required />
          </div>
          <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2">
            Guardar idea
          </button>
        </form>
        {ideas.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ideas.map((idea) => (
              <li
                key={idea.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5 text-sm"
              >
                <span>{idea.title}</span>
                <form action={deleteIdea}>
                  <input type="hidden" name="id" value={idea.id} />
                  <button className="text-muted hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
