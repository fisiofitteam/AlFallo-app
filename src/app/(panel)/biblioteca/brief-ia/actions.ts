"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { parseStr } from "@/lib/clients";
import {
  BRIEF_SCOPES,
  saveBrief,
  type BriefAttachment,
  type BriefScope,
} from "@/lib/aiBrief";

async function requireManager() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/biblioteca");
  return prof;
}

// ── Consideraciones especiales (CRUD) ────────────────────────────────────

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

function isValidScope(value: string | null | undefined): value is BriefScope {
  return !!value && (BRIEF_SCOPES as readonly string[]).includes(value);
}

// Las listas de adjuntos llegan serializadas como JSON en FormData (un solo
// campo por sección). Las parseamos y validamos para guardar solo URL+nombre.
function parseAttachments(value: FormDataEntryValue | null): BriefAttachment[] {
  const s = parseStr(value);
  if (!s) return [];
  try {
    const arr = JSON.parse(s) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((v) => {
        if (!v || typeof v !== "object") return null;
        const url = (v as { url?: unknown }).url;
        const name = (v as { name?: unknown }).name;
        if (typeof url !== "string" || typeof name !== "string") return null;
        return { url, name };
      })
      .filter((x): x is BriefAttachment => x !== null);
  } catch {
    return [];
  }
}

export async function saveBriefAction(formData: FormData) {
  await requireManager();
  const scope = parseStr(formData.get("scope"));
  if (!isValidScope(scope)) return;

  await saveBrief({
    scope,
    philosophy: parseStr(formData.get("philosophy")) ?? "",
    preferredFoods: parseStr(formData.get("preferredFoods")) ?? "",
    avoidFoods: parseStr(formData.get("avoidFoods")) ?? "",
    equivalences: parseStr(formData.get("equivalences")) ?? "",
    additionalRules: parseStr(formData.get("additionalRules")) ?? "",
    examplePlans: parseStr(formData.get("examplePlans")) ?? "",
    equivalencesAttachments: parseAttachments(formData.get("equivalencesAttachments")),
    examplePlansAttachments: parseAttachments(formData.get("examplePlansAttachments")),
  });
  revalidatePath("/biblioteca/brief-ia");
}
