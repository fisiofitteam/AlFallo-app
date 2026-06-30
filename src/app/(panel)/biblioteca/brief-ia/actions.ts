"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, parseStr } from "@/lib/clients";

/**
 * CRUD de Consideraciones Especiales. Antes vivía junto con el brief de
 * IA, pero el brief desapareció con la transición a plantillas. Las
 * consideraciones se quedan porque siguen sirviendo de etiquetas en la
 * ficha del cliente y en el listado.
 */

async function requireManager() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");
  return prof;
}

export type SpecialConsiderationInput = {
  id?: string;
  title: string;
  description: string;
  examplePlanUrl: string | null;
  examplePlanName: string | null;
};

export async function upsertSpecialConsideration(
  input: SpecialConsiderationInput,
): Promise<string> {
  await requireManager();
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  if (input.id) {
    await prisma.specialConsideration.update({
      where: { id: input.id },
      data: {
        title,
        description: input.description.trim(),
        examplePlanUrl: input.examplePlanUrl,
        examplePlanName: input.examplePlanName,
      },
    });
    revalidatePath("/biblioteca/brief-ia");
    return input.id;
  }
  const order = await prisma.specialConsideration.count();
  const created = await prisma.specialConsideration.create({
    data: {
      title,
      description: input.description.trim(),
      examplePlanUrl: input.examplePlanUrl,
      examplePlanName: input.examplePlanName,
      order,
    },
  });
  revalidatePath("/biblioteca/brief-ia");
  return created.id;
}

export async function deleteSpecialConsideration(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  await prisma.specialConsideration.delete({ where: { id } });
  revalidatePath("/biblioteca/brief-ia");
}

export async function reorderSpecialConsiderations(orderedIds: string[]) {
  await requireManager();
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.specialConsideration.update({ where: { id }, data: { order: idx } }),
    ),
  );
  revalidatePath("/biblioteca/brief-ia");
}
