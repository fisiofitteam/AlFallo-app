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

export async function createVideo(formData: FormData) {
  const prof = await requireAccess();
  const title = parseStr(formData.get("title"));
  const url = parseStr(formData.get("url"));
  if (!title || !url) return;
  await prisma.videoResource.create({
    data: {
      title,
      url,
      description: parseStr(formData.get("description")),
      category: parseStr(formData.get("category")),
      createdById: prof.id,
    },
  });
  revalidatePath("/biblioteca/videos");
}

export async function updateVideo(formData: FormData) {
  await requireAccess();
  const id = parseStr(formData.get("id"));
  const title = parseStr(formData.get("title"));
  const url = parseStr(formData.get("url"));
  if (!id || !title || !url) return;
  await prisma.videoResource.update({
    where: { id },
    data: {
      title,
      url,
      description: parseStr(formData.get("description")),
      category: parseStr(formData.get("category")),
    },
  });
  revalidatePath("/biblioteca/videos");
}

export async function deleteVideo(formData: FormData) {
  await requireAccess();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  await prisma.videoResource.delete({ where: { id } });
  revalidatePath("/biblioteca/videos");
}
