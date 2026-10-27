/**
 * POST /api/agenda/book
 *
 * Público (sin auth). Recibe el formulario completo de la landing y:
 *  1. Valida los datos
 *  2. Comprueba que el slot sigue libre (race condition)
 *  3. Crea evento en Calendar con Meet automático
 *  4. Crea Lead en BD con todos los campos
 *  5. Auto-asigna closer según `whoseSlot()`
 *  6. Devuelve { leadId } para que el frontend redirija a /agenda/gracias
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEventWithMeet, getMeetLink, listEvents } from "@/lib/googleCalendar";
import { whoseSlot } from "@/lib/scheduleResolver";
import { notifySetters } from "@/lib/notifications";
import { getAvailableSlots } from "@/lib/agendaSlots";

type BookBody = {
  fullName: string;
  email: string;
  phone: string;
  instagram: string;
  motivo: string;
  intentosPrevios: string;
  objetivoNutricional: string;
  startISO: string; // ISO del slot elegido
  endISO: string;
};

export async function POST(req: NextRequest) {
  let body: BookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  // Validación campo a campo
  const required: (keyof BookBody)[] = [
    "fullName",
    "email",
    "phone",
    "instagram",
    "motivo",
    "intentosPrevios",
    "objetivoNutricional",
    "startISO",
    "endISO",
  ];
  for (const k of required) {
    if (typeof body[k] !== "string" || !body[k].trim()) {
      return NextResponse.json({ ok: false, error: `Falta el campo: ${k}` }, { status: 400 });
    }
  }

  const startDate = new Date(body.startISO);
  const endDate = new Date(body.endISO);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ ok: false, error: "Fecha del slot inválida" }, { status: 400 });
  }
  if (startDate <= new Date()) {
    return NextResponse.json({ ok: false, error: "El slot ya ha pasado" }, { status: 400 });
  }

  // Validación autoritativa en servidor: no aceptamos horas construidas a
  // mano que no pertenezcan a la plantilla real de reservas. Incluye bloqueos.
  try {
    const available = await getAvailableSlots();
    if (!available.some((slot) => slot.startISO === startDate.toISOString() && slot.endISO === endDate.toISOString())) {
      return NextResponse.json(
        { ok: false, error: "Ese horario ya no está disponible. Elige otro hueco." },
        { status: 409 },
      );
    }
  } catch (error) {
    console.error("Agenda availability verification failed", error);
    return NextResponse.json(
      { ok: false, error: "No pudimos comprobar el calendario. Inténtalo de nuevo." },
      { status: 503 },
    );
  }

  const email = body.email.trim().toLowerCase();
  const fullName = body.fullName.trim();
  const phone = body.phone.trim();
  // Normalizar el handle de Instagram: minúsculas, sin espacios, con @ al inicio
  const igRaw = body.instagram.trim().replace(/^@+/, "").toLowerCase().replace(/\s+/g, "");
  const instagram = igRaw ? `@${igRaw}` : "";

  // ─── Última comprobación de disponibilidad (evita race condition) ───
  try {
    const events = await listEvents(body.startISO, body.endISO);
    const overlap = events.some(
      (e) =>
        e.status !== "cancelled" &&
        e.start?.dateTime &&
        e.end?.dateTime &&
        new Date(e.start.dateTime).getTime() < endDate.getTime() &&
        new Date(e.end.dateTime).getTime() > startDate.getTime(),
    );
    if (overlap) {
      return NextResponse.json(
        { ok: false, error: "Lo sentimos, ese hueco se acaba de ocupar. Elige otro." },
        { status: 409 },
      );
    }
  } catch (e: any) {
    console.error("Check overlap error:", e);
    return NextResponse.json(
      { ok: false, error: "No pudimos verificar la disponibilidad. Inténtalo de nuevo." },
      { status: 500 },
    );
  }

  // ─── Crear evento en Calendar ───
  let calendarEvent;
  try {
    const description = [
      `Valoración Al Fallo Nutrition con ${fullName}`,
      ``,
      `Teléfono: ${phone}`,
      `Email: ${email}`,
      ...(instagram ? [`Instagram: ${instagram}`] : []),
      ``,
      `─── Cuestionario previo ───`,
      ``,
      `¿Qué te trae aquí?`,
      body.motivo.trim(),
      ``,
      `Qué has probado antes:`,
      body.intentosPrevios.trim(),
      ``,
      `Objetivo nutricional / cómo te afecta hoy:`,
      body.objetivoNutricional.trim(),
    ].join("\n");

    calendarEvent = await createEventWithMeet({
      title: `Al Fallo · Consulta nutrición · ${fullName}`,
      description,
      startISO: body.startISO,
      endISO: body.endISO,
      attendeeEmail: email,
      attendeeName: fullName,
    });
  } catch (e: any) {
    console.error("Calendar create error:", e);
    return NextResponse.json(
      { ok: false, error: "No pudimos crear la cita. Por favor inténtalo de nuevo en unos minutos." },
      { status: 500 },
    );
  }

  const meetingUrl = getMeetLink(calendarEvent);

  // ─── Auto-asignar closer según patrón semanal ───
  const closerId = await whoseSlot(startDate);

  // ─── Crear Lead ───
  const lead = await prisma.lead.create({
    data: {
      fullName,
      contactType: "email",
      contactValue: email,
      email,
      phone,
      instagram: instagram || null,
      motivo: body.motivo.trim(),
      intentosPrevios: body.intentosPrevios.trim(),
      objetivoNutricional: body.objetivoNutricional.trim(),
      callScheduledAt: startDate,
      status: "scheduled",
      source: "landing",
      bookedAt: new Date(),
      meetingUrl,
      googleEventId: calendarEvent.id,
      closerId: closerId || undefined,
      aiSummary: `Reservado desde landing. Motivo: ${body.motivo.trim().slice(0, 200)}`,
    },
  });

  // ─── Notificación in-app a setters ───
  try {
    const dateLabel = startDate.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    await notifySetters({
      type: "lead_new",
      title: `Lead nuevo · ${fullName}`,
      body: `Llamada el ${dateLabel}. Contáctale por WhatsApp y dile quién le atenderá.`,
      leadId: lead.id,
      actionUrl: "/crm/leads-setter",
    });
  } catch (notifyError) {
    console.error("Notification error:", notifyError);
  }

  return NextResponse.json({ ok: true, leadId: lead.id });
}
