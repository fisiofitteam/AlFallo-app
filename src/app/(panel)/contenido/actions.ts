"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { parseStr } from "@/lib/clients";
import { CONTENT_ACCESS_ROLES } from "@/lib/content";

async function requireContentAccess() {
  const prof = await requireProfessional();
  if (!CONTENT_ACCESS_ROLES.includes(prof.role)) redirect("/");
  return prof;
}

export async function createPiece(formData: FormData) {
  const prof = await requireContentAccess();
  const title = parseStr(formData.get("title"));
  if (!title) return;

  const scheduledRaw = parseStr(formData.get("scheduledFor"));
  await prisma.contentPiece.create({
    data: {
      title,
      type: parseStr(formData.get("type")) ?? "reel",
      status: parseStr(formData.get("status")) ?? "idea",
      scheduledFor: scheduledRaw ? new Date(scheduledRaw) : null,
      createdById: prof.id,
    },
  });
  revalidatePath("/contenido");
}

export async function updatePiece(formData: FormData) {
  await requireContentAccess();
  const id = String(formData.get("id"));
  const scheduledRaw = parseStr(formData.get("scheduledFor"));
  await prisma.contentPiece.update({
    where: { id },
    data: {
      title: parseStr(formData.get("title")) ?? "Sin título",
      type: parseStr(formData.get("type")) ?? "reel",
      status: parseStr(formData.get("status")) ?? "idea",
      scheduledFor: scheduledRaw ? new Date(scheduledRaw) : null,
      hook: parseStr(formData.get("hook")),
      script: parseStr(formData.get("script")),
      notes: parseStr(formData.get("notes")),
    },
  });
  revalidatePath("/contenido");
  revalidatePath(`/contenido/${id}`);
}

// Cambio rápido de estado desde el tablero.
export async function setPieceStatus(formData: FormData) {
  await requireContentAccess();
  await prisma.contentPiece.update({
    where: { id: String(formData.get("id")) },
    data: { status: parseStr(formData.get("status")) ?? "idea" },
  });
  revalidatePath("/contenido");
}

export async function deletePiece(formData: FormData) {
  await requireContentAccess();
  const id = String(formData.get("id"));
  const fromDetail = formData.get("fromDetail") === "1";
  await prisma.contentPiece.delete({ where: { id } });
  revalidatePath("/contenido");
  if (fromDetail) redirect("/contenido");
}

export async function createIdea(formData: FormData) {
  await requireContentAccess();
  const title = parseStr(formData.get("title"));
  if (!title) return;
  await prisma.contentIdea.create({
    data: { title, notes: parseStr(formData.get("notes")) },
  });
  revalidatePath("/contenido");
}

export async function deleteIdea(formData: FormData) {
  await requireContentAccess();
  await prisma.contentIdea.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/contenido");
}
