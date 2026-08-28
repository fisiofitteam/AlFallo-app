import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { generateSessions } from "@/lib/programs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDay(s: Date | string): Date {
  const d = typeof s === "string" ? new Date(s) : new Date(s);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function requirePro() {
  const user = await getActiveProfessional();
  if (!user || !CLIENT_ACCESS_ROLES.includes(user.role)) return null;
  return user;
}

// POST: crea la asignación de un Program a un Client con fecha de inicio, y
// materializa las sesiones (una por día con tareas del programa).
export async function POST(req: NextRequest) {
  const user = await requirePro();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const programId = typeof body.programId === "string" ? body.programId : "";
  const startDateRaw = typeof body.startDate === "string" ? body.startDate : "";
  const weeksCountIn = Math.round(Number(body.weeksCount) || 0);

  if (!clientId || !programId || !startDateRaw) {
    return NextResponse.json(
      { error: "clientId, programId y startDate son obligatorios" },
      { status: 400 },
    );
  }
  const start = startOfDay(startDateRaw);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "startDate inválido" }, { status: 400 });
  }
  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return NextResponse.json({ error: "Program no encontrado" }, { status: 404 });

  const weeksCount = weeksCountIn > 0 ? Math.min(52, weeksCountIn) : program.weeksCount;

  const assignment = await prisma.programAssignment.create({
    data: {
      clientId,
      programId,
      startDate: start,
      weeksCount,
      isActive: true,
    },
  });
  const sessionsCreated = await generateSessions(assignment.id);
  return NextResponse.json({ ok: true, assignment, sessionsCreated });
}

// PATCH: cambia startDate (mueve las futuras no completadas) o isActive (false
// borra las futuras no completadas conservando el histórico).
export async function PATCH(req: NextRequest) {
  const user = await requirePro();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const patch: { startDate?: Date; isActive?: boolean; weeksCount?: number } = {};
  if (typeof body.startDate === "string") {
    const d = startOfDay(body.startDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "startDate inválido" }, { status: 400 });
    }
    patch.startDate = d;
  }
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  if (typeof body.weeksCount === "number" && body.weeksCount > 0) {
    patch.weeksCount = Math.min(52, Math.round(body.weeksCount));
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const assignment = await prisma.programAssignment.update({ where: { id }, data: patch });
  // Cualquier cambio de fechas/activa/duración regenera las sesiones futuras.
  const sessionsCreated =
    patch.isActive === false
      ? await prisma.programSession
          .deleteMany({
            where: {
              assignmentId: id,
              completedAt: null,
              scheduledDate: { gte: new Date() },
            },
          })
          .then(() => 0)
      : await generateSessions(assignment.id);
  return NextResponse.json({ ok: true, assignment, sessionsCreated });
}

export async function DELETE(req: NextRequest) {
  const user = await requirePro();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await prisma.programAssignment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
