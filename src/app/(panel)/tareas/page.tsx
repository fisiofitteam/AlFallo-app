import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { weekStartFor } from "@/lib/weekly-tasks";
import { RoleSection, type EditorTask } from "@/components/WeeklyTasksEditor";
import { AuditPanel } from "@/components/WeeklyTasksAudit";

export const metadata = { title: "Tareas del equipo · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function WeeklyTasksConfigPage() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/");

  // Cargamos todas las tareas activas. Las inactivas no se editan desde aquí
  // (de momento no exponemos el archivado; usar borrar).
  const tasks = await prisma.weeklyTaskTemplate.findMany({
    where: { active: true },
    orderBy: [{ dayOfWeek: "asc" }, { order: "asc" }],
    select: {
      id: true,
      title: true,
      dayOfWeek: true,
      order: true,
      active: true,
      targetRole: true,
    },
  });

  const nutriTasks: EditorTask[] = tasks.filter((t) => t.targetRole === "nutricionista");
  const coachTasks: EditorTask[] = tasks.filter((t) => t.targetRole === "head_coach");

  // Auditoría: para la semana en curso, contamos cuántas (tarea × profesional)
  // están sin marcar. Solo CEO la ve.
  const isCeo = prof.role === "ceo";
  const weekStart = weekStartFor();

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7">
        <h1 className="text-2xl font-bold">Tareas del equipo</h1>
        <p className="mt-1 text-sm text-muted">
          Edita aquí las tareas semanales que aparecen en el panel de los nutricionistas
          y de la Head Coach. Cada lunes 00:00 (Madrid) vuelven a salir como pendientes.
        </p>
      </header>

      <RoleSection
        emoji="🥑"
        roleLabel="Nutricionistas"
        targetRole="nutricionista"
        tasks={nutriTasks}
      />

      <RoleSection
        emoji="⭐"
        roleLabel="Head Coach"
        targetRole="head_coach"
        tasks={coachTasks}
      />

      {isCeo ? <AuditPanel weekStartIso={weekStart.toISOString()} /> : null}
    </div>
  );
}
