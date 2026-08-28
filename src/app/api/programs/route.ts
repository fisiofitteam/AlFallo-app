import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requirePro() {
  const user = await getActiveProfessional();
  if (!user || !CLIENT_ACCESS_ROLES.includes(user.role)) return null;
  return user;
}

// POST: crea un Program VACÍO con N semanas × 7 días pre-creados, o duplica
// uno existente si viene `sourceId`.
export async function POST(req: NextRequest) {
  const user = await requirePro();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const {
    sourceId,
    name,
    type,
    level,
    weeksCount,
    description,
  } = body as {
    sourceId?: string;
    name?: string;
    type?: string;
    level?: number;
    weeksCount?: number;
    description?: string;
  };

  // Duplicar (opcional)
  if (sourceId) {
    const source = await prisma.program.findUnique({
      where: { id: sourceId },
      include: {
        weeks: {
          orderBy: { weekNumber: "asc" },
          include: {
            days: {
              orderBy: { dayOfWeek: "asc" },
              include: {
                tasks: {
                  orderBy: { order: "asc" },
                  include: { workout: true },
                },
              },
            },
          },
        },
      },
    });
    if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });
    const newProgram = await prisma.program.create({
      data: {
        name: name?.trim() || `${source.name} (copia)`,
        type: type ?? source.type,
        level: level ?? source.level,
        weeksCount: source.weeksCount,
        description: description ?? source.description,
      },
    });
    for (const w of source.weeks) {
      const newWeek = await prisma.programWeek.create({
        data: { programId: newProgram.id, weekNumber: w.weekNumber, notes: w.notes },
      });
      for (const d of w.days) {
        const newDay = await prisma.programDay.create({
          data: { weekId: newWeek.id, dayOfWeek: d.dayOfWeek },
        });
        for (const t of d.tasks) {
          const newTask = await prisma.programTask.create({
            data: { dayId: newDay.id, type: t.type, order: t.order, title: t.title },
          });
          if (t.workout) {
            await prisma.taskWorkout.create({
              data: { taskId: newTask.id, bodyText: t.workout.bodyText },
            });
          }
        }
      }
    }
    return NextResponse.json(newProgram);
  }

  // Crear nuevo vacío
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) return NextResponse.json({ error: "name requerido" }, { status: 400 });
  const cleanType = typeof type === "string" ? type.trim() : "";
  if (!cleanType) return NextResponse.json({ error: "type (foco) requerido" }, { status: 400 });
  const nWeeks = Math.max(1, Math.min(52, Math.round(Number(weeksCount) || 4)));

  const program = await prisma.program.create({
    data: {
      name: cleanName,
      type: cleanType,
      level: Math.max(1, Math.min(10, Math.round(Number(level) || 1))),
      weeksCount: nWeeks,
      description: description?.trim() || null,
    },
  });

  for (let w = 1; w <= nWeeks; w++) {
    const week = await prisma.programWeek.create({
      data: { programId: program.id, weekNumber: w },
    });
    for (let d = 1; d <= 7; d++) {
      await prisma.programDay.create({ data: { weekId: week.id, dayOfWeek: d } });
    }
  }
  return NextResponse.json(program);
}

export async function PATCH(req: NextRequest) {
  const user = await requirePro();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim() || undefined;
  if (typeof body.type === "string") data.type = body.type.trim() || undefined;
  if (typeof body.level === "number") data.level = Math.max(1, Math.min(10, body.level));
  if (typeof body.description === "string") data.description = body.description || null;

  const program = await prisma.program.update({ where: { id }, data });
  return NextResponse.json(program);
}

export async function DELETE(req: NextRequest) {
  const user = await requirePro();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // ProgramAssignment no cascadea desde Program: borrar primero las asignaciones.
  await prisma.$transaction([
    prisma.programAssignment.deleteMany({ where: { programId: id } }),
    prisma.program.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
