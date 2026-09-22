"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { parseQuestions } from "@/lib/satisfactionForms";

export async function submitSatisfaction(formId: string, formData: FormData) {
  const client = await requireOnboardedClient();
  const form = await prisma.satisfactionForm.findUnique({ where: { id: formId } });
  if (!form || !form.active) redirect("/cliente");

  const questions = parseQuestions(form.questions);
  const answers: Record<string, number | string> = {};
  for (const q of questions) {
    const raw = formData.get(`q_${q.id}`);
    if (q.type === "scale") {
      const n = typeof raw === "string" ? Number(raw) : NaN;
      if (Number.isFinite(n)) answers[q.id] = n;
      else if (q.required) return;
    } else {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (s) answers[q.id] = s;
      else if (q.required) return;
    }
  }

  await prisma.satisfactionResponse.upsert({
    where: { clientId_formId: { clientId: client.id, formId } },
    create: {
      clientId: client.id,
      formId,
      answers: answers as unknown as Prisma.InputJsonValue,
    },
    update: {
      answers: answers as unknown as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });

  revalidatePath("/cliente");
  redirect("/cliente?formulario=ok");
}
