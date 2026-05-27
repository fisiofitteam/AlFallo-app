import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CONTENT_ACCESS_ROLES, CONTENT_STATUS_OPTIONS, CONTENT_TYPE_OPTIONS } from "@/lib/content";
import { Field, Select, TextArea, TextInput } from "@/components/form-ui";
import { deletePiece, updatePiece } from "../actions";

export const metadata = { title: "Pieza · Contenido" };

function dateValue(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function ContentPiecePage({ params }: { params: { id: string } }) {
  const prof = await requireProfessional();
  if (!CONTENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const piece = await prisma.contentPiece.findUnique({ where: { id: params.id } });
  if (!piece) redirect("/contenido");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/contenido" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Contenido
      </Link>

      <form action={updatePiece} className="space-y-5 rounded-2xl border border-border bg-surface p-6">
        <input type="hidden" name="id" value={piece.id} />

        <Field label="Título" htmlFor="title">
          <TextInput id="title" name="title" defaultValue={piece.title} required />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Tipo" htmlFor="type">
            <Select id="type" name="type" options={CONTENT_TYPE_OPTIONS} defaultValue={piece.type} />
          </Field>
          <Field label="Estado" htmlFor="status">
            <Select id="status" name="status" options={CONTENT_STATUS_OPTIONS} defaultValue={piece.status} />
          </Field>
          <Field label="Fecha prevista" htmlFor="scheduledFor">
            <TextInput id="scheduledFor" name="scheduledFor" type="date" defaultValue={dateValue(piece.scheduledFor)} />
          </Field>
        </div>

        <Field label="Gancho (hook)" htmlFor="hook" hint="La primera frase que para el scroll">
          <TextInput id="hook" name="hook" defaultValue={piece.hook ?? ""} />
        </Field>
        <Field label="Guion" htmlFor="script">
          <TextArea id="script" name="script" defaultValue={piece.script ?? ""} className="min-h-[160px]" />
        </Field>
        <Field label="Notas" htmlFor="notes">
          <TextArea id="notes" name="notes" defaultValue={piece.notes ?? ""} />
        </Field>

        <div className="flex justify-end">
          <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
            Guardar
          </button>
        </div>
      </form>

      <form action={deletePiece} className="mt-4 flex justify-end">
        <input type="hidden" name="id" value={piece.id} />
        <input type="hidden" name="fromDetail" value="1" />
        <button className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-red-50 hover:text-red-600">
          <Trash2 size={15} /> Borrar pieza
        </button>
      </form>
    </div>
  );
}
