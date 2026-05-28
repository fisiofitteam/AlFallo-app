"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { parseIntOrNull, parseNumber, parseStr } from "@/lib/clients";
import { CRM_ACCESS_ROLES } from "@/lib/crm";

async function requireCrm() {
  const prof = await requireProfessional();
  if (!CRM_ACCESS_ROLES.includes(prof.role)) redirect("/");
  return prof;
}

function parseDateTime(value: FormDataEntryValue | null): Date | null {
  const s = parseStr(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Leads ─────────────────────────────────────────────────────

export async function createLead(formData: FormData) {
  const me = await requireCrm();
  const fullName = parseStr(formData.get("fullName"));
  if (!fullName) return;

  const lead = await prisma.lead.create({
    data: {
      fullName,
      email: parseStr(formData.get("email"))?.toLowerCase() ?? null,
      phone: parseStr(formData.get("phone")),
      source: parseStr(formData.get("source")) ?? "manual",
      assignedToId: parseStr(formData.get("assignedToId")) ?? me.id,
      notes: parseStr(formData.get("notes")),
    },
  });
  revalidatePath("/crm");
  redirect(`/crm/lead/${lead.id}`);
}

export async function updateLead(formData: FormData) {
  await requireCrm();
  const id = String(formData.get("id"));
  await prisma.lead.update({
    where: { id },
    data: {
      fullName: parseStr(formData.get("fullName")) ?? undefined,
      email: parseStr(formData.get("email"))?.toLowerCase() ?? null,
      phone: parseStr(formData.get("phone")),
      source: parseStr(formData.get("source")),
      notes: parseStr(formData.get("notes")),
    },
  });
  revalidatePath(`/crm/lead/${id}`);
  revalidatePath("/crm");
}

export async function assignLead(formData: FormData) {
  await requireCrm();
  const id = String(formData.get("id"));
  await prisma.lead.update({
    where: { id },
    data: { assignedToId: parseStr(formData.get("assignedToId")) },
  });
  revalidatePath(`/crm/lead/${id}`);
  revalidatePath("/crm");
}

export async function markLeadQualified(formData: FormData) {
  await requireCrm();
  const id = String(formData.get("id"));
  await prisma.lead.update({
    where: { id },
    data: { status: "cualificado", qualifiedAt: new Date() },
  });
  revalidatePath(`/crm/lead/${id}`);
  revalidatePath("/crm");
}

export async function markLeadLost(formData: FormData) {
  await requireCrm();
  const id = String(formData.get("id"));
  await prisma.lead.update({
    where: { id },
    data: { status: "perdido", lostReason: parseStr(formData.get("lostReason")) },
  });
  revalidatePath(`/crm/lead/${id}`);
  revalidatePath("/crm");
}

export async function deleteLead(formData: FormData) {
  await requireCrm();
  const id = String(formData.get("id"));
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/crm");
  redirect("/crm");
}

// ─── Llamadas ──────────────────────────────────────────────────

export async function scheduleCall(formData: FormData) {
  const me = await requireCrm();
  const leadId = String(formData.get("leadId"));
  const scheduledFor = parseDateTime(formData.get("scheduledFor"));
  if (!scheduledFor) return;

  await prisma.scheduledCall.create({
    data: {
      leadId,
      scheduledFor,
      closerId: parseStr(formData.get("closerId")) ?? me.id,
      durationMin: parseIntOrNull(formData.get("durationMin")) ?? 30,
    },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { status: "agendado" } });
  revalidatePath(`/crm/lead/${leadId}`);
  revalidatePath("/crm/llamadas");
  revalidatePath("/crm");
}

export async function updateCallResult(formData: FormData) {
  await requireCrm();
  const id = String(formData.get("id"));
  const result = parseStr(formData.get("result"));
  if (!result) return;

  const call = await prisma.scheduledCall.update({
    where: { id },
    data: {
      result,
      resultNotes: parseStr(formData.get("resultNotes")),
      objections: parseStr(formData.get("objections")),
      lostReason: parseStr(formData.get("lostReason")),
      followUpAt: parseDateTime(formData.get("followUpAt")),
      completedAt: result === "pendiente" ? null : new Date(),
    },
  });

  // Refleja el resultado en el estado del lead (salvo "vendida", que pasa por closeSale)
  if (result === "follow_up") {
    await prisma.lead.update({
      where: { id: call.leadId },
      data: { status: "seguimiento" },
    });
  } else if (result === "perdida" || result === "no_acude") {
    await prisma.lead.update({
      where: { id: call.leadId },
      data: { status: "perdido", lostReason: parseStr(formData.get("lostReason")) ?? undefined },
    });
  } else if (result === "cancelada") {
    await prisma.lead.update({ where: { id: call.leadId }, data: { status: "cualificado" } });
  }

  revalidatePath(`/crm/lead/${call.leadId}`);
  revalidatePath("/crm/llamadas");
  revalidatePath("/crm");
}

export async function deleteCall(formData: FormData) {
  await requireCrm();
  const id = String(formData.get("id"));
  const call = await prisma.scheduledCall.findUnique({ where: { id }, select: { leadId: true } });
  if (!call) return;
  await prisma.scheduledCall.delete({ where: { id } });
  revalidatePath(`/crm/lead/${call.leadId}`);
  revalidatePath("/crm/llamadas");
}

// ─── Cierre de venta ──────────────────────────────────────────
// Crea un Cliente (si no existe ya con ese email), crea la Venta,
// crea un movimiento de ingreso y deja el Lead como "cliente".

export async function closeSale(formData: FormData) {
  const me = await requireCrm();
  const leadId = String(formData.get("leadId"));
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  const amount = parseNumber(formData.get("amount"));
  if (amount == null || amount <= 0) return;

  // Encuentra o crea el cliente.
  let clientId: string;
  const existingClient = lead.email
    ? await prisma.client.findUnique({ where: { email: lead.email } })
    : null;
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const c = await prisma.client.create({
      data: {
        fullName: lead.fullName,
        email: lead.email ?? undefined,
        phone: lead.phone,
        status: "onboarding",
      },
    });
    clientId = c.id;
  }

  const planMonths = parseIntOrNull(formData.get("planMonths"));
  const startDate = parseDateTime(formData.get("startDate")) ?? new Date();
  const endDate = planMonths
    ? new Date(new Date(startDate).setMonth(startDate.getMonth() + planMonths))
    : null;

  await prisma.sale.create({
    data: {
      leadId,
      clientId,
      closerId: parseStr(formData.get("closerId")) ?? me.id,
      amount,
      planMonths,
      startDate,
      endDate,
      paymentMethod: "manual",
      notes: parseStr(formData.get("notes")),
    },
  });

  // Movimiento de ingreso para el cuadro de mandos.
  await prisma.transaction.create({
    data: {
      type: "ingreso",
      category: "cliente",
      description: `Venta · ${lead.fullName}`,
      amount,
      date: startDate,
      source: "crm",
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "cliente", clientId },
  });

  revalidatePath(`/crm/lead/${leadId}`);
  revalidatePath("/crm");
  revalidatePath("/crm/ventas");
  revalidatePath("/clientes");
  revalidatePath("/finanzas");
  redirect(`/clientes/${clientId}`);
}
