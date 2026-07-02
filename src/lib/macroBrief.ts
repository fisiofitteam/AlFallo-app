import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Brief de macros: notas + adjuntos (Excel/CSV/PDF/texto) que el nutri
 * sube en la biblioteca. Se inyecta en el prompt del estimador de macros
 * para que Claude use las tablas de equivalencias del equipo en cada
 * cálculo.
 *
 * SINGLETON: solo hay una fila. getMacroBrief la crea vacía si no existe;
 * saveMacroBrief la actualiza.
 */

export type MacroBriefAttachment = { url: string; name: string };

export type MacroBriefData = {
  id: string;
  notes: string | null;
  attachments: MacroBriefAttachment[];
  updatedAt: Date;
};

function parseAttachments(raw: unknown): MacroBriefAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const url = (v as { url?: unknown }).url;
      const name = (v as { name?: unknown }).name;
      if (typeof url !== "string" || typeof name !== "string") return null;
      return { url, name };
    })
    .filter((x): x is MacroBriefAttachment => x !== null);
}

/** Devuelve el brief singleton, creándolo vacío si no existe. */
export async function getMacroBrief(): Promise<MacroBriefData> {
  let row = await prisma.macroBrief.findFirst();
  if (!row) {
    row = await prisma.macroBrief.create({
      data: { notes: null, attachments: [] as unknown as Prisma.InputJsonValue },
    });
  }
  return {
    id: row.id,
    notes: row.notes,
    attachments: parseAttachments(row.attachments),
    updatedAt: row.updatedAt,
  };
}

/** Guarda notas + adjuntos. Si no existe la fila la crea. */
export async function saveMacroBrief(input: {
  notes: string | null;
  attachments: MacroBriefAttachment[];
  editorId: string | null;
}): Promise<void> {
  const existing = await prisma.macroBrief.findFirst({ select: { id: true } });
  const data = {
    notes: input.notes,
    attachments: input.attachments as unknown as Prisma.InputJsonValue,
    updatedById: input.editorId,
  };
  if (existing) {
    await prisma.macroBrief.update({ where: { id: existing.id }, data });
  } else {
    await prisma.macroBrief.create({ data });
  }
}
