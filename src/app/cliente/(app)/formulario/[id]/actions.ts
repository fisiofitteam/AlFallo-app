"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { parseQuestions } from "@/lib/satisfactionForms";
import { notifyHeadCoach, notifyProfessional } from "@/lib/notifications";

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

  // Detectar si es la PRIMERA vez que responde (para no repetir avisos si el
  // atleta re-envía). Upsert simplifica pero perdemos ese flag → miramos antes.
  const previous = await prisma.satisfactionResponse.findUnique({
    where: { clientId_formId: { clientId: client.id, formId } },
    select: { id: true },
  });

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

  // Notificación al equipo — solo la primera vez.
  if (!previous) {
    const meta = await prisma.client.findUnique({
      where: { id: client.id },
      select: { fullName: true, nutritionistId: true },
    });
    const title = `Formulario respondido — ${meta?.fullName ?? "Atleta"}`;
    const body = `Ha respondido "${form.name}". Puedes revisarlo en la ficha.`;
    const actionUrl = `/clientes/${client.id}?tab=formularios`;
    if (meta?.nutritionistId) {
      await notifyProfessional({
        professionalId: meta.nutritionistId,
        type: "satisfaction_submitted",
        title,
        body,
        actionUrl,
      });
    } else {
      // Sin nutri asignado: avisamos al head_coach para que lo mire / redirija.
      await notifyHeadCoach({ type: "satisfaction_submitted", title, body, actionUrl });
    }
  }

  revalidatePath("/cliente");
  redirect("/cliente?formulario=ok");
}
