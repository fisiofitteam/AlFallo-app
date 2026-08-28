import "server-only";
import { prisma } from "@/lib/prisma";

// Materialización de una ProgramAssignment en ProgramSession[]. Cada día del
// Program con al menos una tarea se convierte en una sesión con fecha real.
// Idempotente: borra las sesiones futuras no completadas antes de recrearlas.

type TaskSnapshotEntry = {
  taskId: string;
  order: number;
  title: string;
  bodyText: string;
};

function startOfDay(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(input) : new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function generateSessions(assignmentId: string): Promise<number> {
  const assignment = await prisma.programAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      program: {
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
      },
    },
  });
  if (!assignment) throw new Error("Assignment no encontrada");

  const now = new Date();
  // Borrar sesiones futuras no completadas para permitir regeneración limpia.
  await prisma.programSession.deleteMany({
    where: {
      assignmentId,
      completedAt: null,
      scheduledDate: { gte: now },
    },
  });

  const definedWeeks = assignment.program.weeks;
  if (definedWeeks.length === 0) return 0;

  // Mapa weekNumber -> días definidos (con al menos una tarea)
  const daysByWeek = new Map<number, (typeof definedWeeks)[number]["days"]>();
  let lastDefinedWeek = 0;
  for (const w of definedWeeks) {
    daysByWeek.set(w.weekNumber, w.days);
    if (w.weekNumber > lastDefinedWeek) lastDefinedWeek = w.weekNumber;
  }

  const startDay = startOfDay(assignment.startDate);
  const total = Math.max(1, Math.min(52, assignment.weeksCount));
  let created = 0;

  for (let week = 1; week <= total; week++) {
    const sourceWeek = week <= lastDefinedWeek ? week : lastDefinedWeek;
    const days = daysByWeek.get(sourceWeek) ?? [];
    for (const day of days) {
      if (day.tasks.length === 0) continue;
      const snapshot: TaskSnapshotEntry[] = day.tasks.map((t) => ({
        taskId: t.id,
        order: t.order,
        title: t.title,
        bodyText: t.workout?.bodyText ?? "",
      }));
      const sessionDate = new Date(startDay);
      sessionDate.setDate(startDay.getDate() + (week - 1) * 7 + (day.dayOfWeek - 1));
      // No pisar sesiones completadas si ya existían (raro, pero seguro).
      const existing = await prisma.programSession.findFirst({
        where: {
          assignmentId,
          weekNumber: week,
          dayOfWeek: day.dayOfWeek,
          completedAt: { not: null },
        },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.programSession.create({
        data: {
          assignmentId,
          scheduledDate: sessionDate,
          weekNumber: week,
          dayOfWeek: day.dayOfWeek,
          tasksSnapshot: JSON.stringify(snapshot),
        },
      });
      created++;
    }
  }
  return created;
}
