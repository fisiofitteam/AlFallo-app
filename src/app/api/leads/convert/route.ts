/**
 * POST /api/leads/convert
 *
 * Convierte un Lead "ganado" en Cliente:
 *  1. Crea el Cliente con email/teléfono del lead (sin contraseña — el equipo
 *     se la pone después desde la ficha del cliente).
 *  2. Registra la Venta (Sale) con importe y duración del plan.
 *  3. Crea el ingreso correspondiente en Transaction (categoría "cliente")
 *     para que se refleje en el Cuadro de mandos.
 *  4. Marca el lead como "won" y vincula `convertedClientId`.
 *
 * Pago: por ahora manual (paymentMethod="manual"). Stripe llegará después.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getActiveProfessional();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { leadId, assignedProfessionalId, amountPaid, subscriptionPeriodMonths, email, phone } =
    await req.json();

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Closer solo puede convertir SUS leads
  if (user.role === "closer" && lead.closerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Email obligatorio para que el cliente pueda hacer login en /cliente
  if (!email || !String(email).trim()) {
    return NextResponse.json(
      { error: "El email del cliente es obligatorio para que pueda acceder a la app" },
      { status: 400 },
    );
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  // Validar email único
  const conflict = await prisma.client.findUnique({ where: { email: normalizedEmail } });
  if (conflict) {
    return NextResponse.json(
      { error: `Ya existe otro cliente con ese email: ${conflict.fullName}` },
      { status: 409 },
    );
  }

  const months = Number(subscriptionPeriodMonths) || 4;
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);

  const amountNum = amountPaid && Number(amountPaid) > 0 ? Number(amountPaid) : null;

  // 1) Crear cliente (sin contraseña; el equipo se la pone después)
  const client = await prisma.client.create({
    data: {
      fullName: lead.fullName,
      email: normalizedEmail,
      phone: phone?.trim() || lead.phone || null,
      status: "onboarding",
      nutritionistId: assignedProfessionalId || null,
    },
  });

  // 2) Crear venta
  await prisma.sale.create({
    data: {
      leadId: lead.id,
      clientId: client.id,
      closerId: lead.closerId ?? null,
      amount: amountNum ?? 0,
      planMonths: months,
      startDate,
      endDate,
      paymentMethod: "manual",
      notes: "Alta inicial (conversión de lead)",
    },
  });

  // 3) Marcar lead como won + linkear cliente
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "won",
      decidedAt: new Date(),
      convertedClientId: client.id,
      inFollowUp: false,
    },
  });

  // 4) Ingreso en Transaction (cuadro de mandos), solo si hay importe
  if (amountNum != null) {
    await prisma.transaction.create({
      data: {
        type: "ingreso",
        category: "cliente",
        amount: amountNum,
        description: `Alta · ${lead.fullName}`,
        date: new Date(),
        source: "crm",
      },
    });
  }

  return NextResponse.json({ ok: true, clientId: client.id });
}
