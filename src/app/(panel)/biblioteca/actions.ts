"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, parseNumber, parseStr } from "@/lib/clients";

async function requireLibraryAccess() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");
  return prof;
}

export async function createFood(formData: FormData) {
  await requireLibraryAccess();

  const name = parseStr(formData.get("name"));
  if (!name) return;

  await prisma.foodLibrary.create({
    data: {
      name,
      brand: parseStr(formData.get("brand")),
      category: parseStr(formData.get("category")),
      imageUrl: parseStr(formData.get("imageUrl")),
      kcalPer100: parseNumber(formData.get("kcalPer100")) ?? 0,
      proteinPer100: parseNumber(formData.get("proteinPer100")) ?? 0,
      carbsPer100: parseNumber(formData.get("carbsPer100")) ?? 0,
      fatPer100: parseNumber(formData.get("fatPer100")) ?? 0,
    },
  });

  revalidatePath("/biblioteca/alimentos");
}

export async function deleteFood(formData: FormData) {
  await requireLibraryAccess();
  const id = String(formData.get("id"));
  await prisma.foodLibrary.delete({ where: { id } });
  revalidatePath("/biblioteca/alimentos");
}
