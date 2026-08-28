import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/programs/from-session
// Body: { programId, weekNumber, dayOfWeek, session:{title,description?,blocks[]}, replace? }
// Convierte una sesión IA en N ProgramTask(WORKOUT) dentro del día indicado.
export async function POST(req: NextRequest) {
  const user = await getActiveProfessional();
  if (!user || !CLIENT_ACCESS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const programId = typeof body.programId === "string" ? body.programId : "";
  const wn = Number(body.weekNumber);
  const dow = Number(body.dayOfWeek);
  const session = body.session as
    | { title?: unknown; description?: unknown; blocks?: unknown }
    | undefined;
  const replace = Boolean(body.replace);

  if (!programId || !session || !Array.isArray(session.blocks)) {
    return NextResponse.json(
      { error: "Faltan datos (programId, weekNumber, dayOfWeek, session.blocks)" },
      { status: 400 },
    );
  }
  if (session.blocks.length === 0) {
    return NextResponse.json({ error: "La sesión no tiene bloques" }, { status: 400 });
  }
  if (!Number.isInteger(wn) || wn < 1) {
    return NextResponse.json({ error: "weekNumber inválido" }, { status: 400 });
  }
  if (!Number.isInteger(dow) || dow < 1 || dow > 7) {
    return NextResponse.json({ error: "dayOfWeek fuera de rango (1-7)" }, { status: 400 });
  }

  // Asegurar la semana (si es nueva: crea 7 días vacíos + sube weeksCount).
  let week = await prisma.programWeek.findUnique({
    where: { programId_weekNumber: { programId, weekNumber: wn } },
  });
  if (!week) {
    week = await prisma.programWeek.create({
      data: { programId, weekNumber: wn },
    });
    for (let d = 1; d <= 7; d++) {
      await prisma.programDay.create({ data: { weekId: week.id, dayOfWeek: d } });
    }
    const maxWeek = await prisma.programWeek.aggregate({
      where: { programId },
      _max: { weekNumber: true },
    });
    await prisma.program.update({
      where: { id: programId },
      data: { weeksCount: maxWeek._max.weekNumber ?? wn },
    });
  }

  let day = await prisma.programDay.findUnique({
    where: { weekId_dayOfWeek: { weekId: week.id, dayOfWeek: dow } },
  });
  if (!day) {
    day = await prisma.programDay.create({ data: { weekId: week.id, dayOfWeek: dow } });
  }

  if (replace) {
    await prisma.programTask.deleteMany({ where: { dayId: day.id } });
  }

  const existing = await prisma.programTask.count({ where: { dayId: day.id } });
  const sessionTitle = typeof session.title === "string" ? session.title.trim() : "";
  const description = typeof session.description === "string" ? session.description.trim() : "";

  const created: string[] = [];
  let i = 0;
  for (const raw of session.blocks) {
    const b = (raw ?? {}) as { heading?: unknown; body?: unknown };
    const heading = String(b.heading ?? "").trim() || `Bloque ${i + 1}`;
    let bodyText = String(b.body ?? "");
    if (i === 0) {
      const header: string[] = [];
      if (sessionTitle) header.push(`_${sessionTitle}_`);
      if (description) header.push(`> ${description}`);
      if (header.length > 0) bodyText = `${header.join("\n\n")}\n\n${bodyText}`;
    }
    const task = await prisma.programTask.create({
      data: { dayId: day.id, type: "WORKOUT", order: existing + i, title: heading },
    });
    await prisma.taskWorkout.create({ data: { taskId: task.id, bodyText } });
    created.push(task.id);
    i++;
  }

  return NextResponse.json({ ok: true, weekId: week.id, dayId: day.id, taskIds: created });
}
