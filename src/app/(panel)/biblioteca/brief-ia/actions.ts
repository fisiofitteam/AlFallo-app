"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
