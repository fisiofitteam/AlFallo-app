"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, parseStr } from "@/lib/clients";

async function requireAccess() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");
  return prof;
}

export async function createRecipe(formData: FormData) {
  const prof = await requireAccess();
  const title = parseStr(formData.get("title"));
  if (!title) return;
  await prisma.recipe.create({
    data: {
      title,
      description: parseStr(formData.get("description")),
      mealType: parseStr(formData.get("mealType")),
      ingredients: parseStr(formData.get("ingredients")) ?? "",
      instructions: parseStr(formData.get("instructions")) ?? "",
      imageUrl: parseStr(formData.get("imageUrl")),
      createdById: prof.id,
    },
  });
  revalidatePath("/biblioteca/recetas");
}

export async function updateRecipe(formData: FormData) {
  await requireAccess();
  const id = parseStr(formData.get("id"));
  const title = parseStr(formData.get("title"));
  if (!id || !title) return;
  await prisma.recipe.update({
    where: { id },
    data: {
      title,
      description: parseStr(formData.get("description")),
      mealType: parseStr(formData.get("mealType")),
      ingredients: parseStr(formData.get("ingredients")) ?? "",
      instructions: parseStr(formData.get("instructions")) ?? "",
      imageUrl: parseStr(formData.get("imageUrl")),
    },
  });
  revalidatePath("/biblioteca/recetas");
}

export async function deleteRecipe(formData: FormData) {
  await requireAccess();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  await prisma.recipe.delete({ where: { id } });
  revalidatePath("/biblioteca/recetas");
}
