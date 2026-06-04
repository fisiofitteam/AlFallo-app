"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { parseStr } from "@/lib/clients";
import { BRIEF_SCOPES, saveBrief, type BriefScope } from "@/lib/aiBrief";

async function requireManager() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/biblioteca");
  return prof;
}

function isValidScope(value: string | null | undefined): value is BriefScope {
  return !!value && (BRIEF_SCOPES as readonly string[]).includes(value);
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
    equivalencesFileUrl: parseStr(formData.get("equivalencesFileUrl")),
    equivalencesFileName: parseStr(formData.get("equivalencesFileName")),
    examplePlansFileUrl: parseStr(formData.get("examplePlansFileUrl")),
    examplePlansFileName: parseStr(formData.get("examplePlansFileName")),
  });
  revalidatePath("/biblioteca/brief-ia");
}
