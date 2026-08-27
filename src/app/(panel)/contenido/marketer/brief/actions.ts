"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveProfessional } from "@/lib/session";
import { canUseMarketerIA } from "@/lib/marketer-access";
import { updateAiBrief } from "@/lib/ai-brief";

export async function saveAiBrief(formData: FormData) {
  const user = await getActiveProfessional();
  if (!user || !canUseMarketerIA(user.email)) redirect("/");

  await updateAiBrief(
    {
      brand: String(formData.get("brand") ?? ""),
      voiceTone: String(formData.get("voiceTone") ?? ""),
      dos: String(formData.get("dos") ?? ""),
      donts: String(formData.get("donts") ?? ""),
      structureHints: String(formData.get("structureHints") ?? ""),
      goodExamples: String(formData.get("goodExamples") ?? ""),
      badExamples: String(formData.get("badExamples") ?? ""),
    },
    user.id === "dev" ? null : user.id,
  );

  revalidatePath("/contenido/marketer");
  revalidatePath("/contenido/marketer/brief");
  redirect("/contenido/marketer");
}
