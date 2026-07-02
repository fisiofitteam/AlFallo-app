"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { saveMacroBrief, type MacroBriefAttachment } from "@/lib/macroBrief";

async function requireAccess() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");
  return prof;
}

function parseAttachmentsFromForm(raw: FormDataEntryValue | null): MacroBriefAttachment[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((v) => {
        if (!v || typeof v !== "object") return null;
        const url = (v as { url?: unknown }).url;
        const name = (v as { name?: unknown }).name;
        if (typeof url !== "string" || typeof name !== "string") return null;
        return { url, name };
      })
      .filter((x): x is MacroBriefAttachment => x !== null);
  } catch {
    return [];
  }
}

export async function saveMacroBriefAction(formData: FormData): Promise<void> {
  const prof = await requireAccess();
  const notesRaw = formData.get("notes");
  const notes = typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : null;
  const attachments = parseAttachmentsFromForm(formData.get("attachmentsJson"));
  await saveMacroBrief({ notes, attachments, editorId: prof.id });
  revalidatePath("/biblioteca/brief-macros");
}
