import { Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { WEEKDAYS } from "@/lib/weekly-tasks";

// Panel colapsable (un <details> nativo, sin JS) que muestra para la semana
// en curso qué tareas siguen sin marcar por quién. Solo lo vemos los CEOs.
export async function AuditPanel({ weekStartIso }: { weekStartIso: string }) {
  const weekStart = new Date(weekStartIso);

  const [tasks, team, completions] = await Promise.all([
    prisma.weeklyTaskTemplate.findMany({
      where: { active: true },
      orderBy: [{ targetRole: "asc" }, { dayOfWeek: "asc" }, { order: "asc" }],
      select: {
        id: true,
        title: true,
        dayOfWeek: true,
        targetRole: true,
        assigneeId: true,
      },
    }),
    prisma.professional.findMany({
      where: { isActive: true, role: { in: ["nutricionista", "head_coach"] } },
      select: { id: true, fullName: true, role: true },
    }),
    prisma.weeklyTaskCompletion.findMany({
      where: { weekStart },
      select: { templateId: true, professionalId: true },
    }),
  ]);

  const doneSet = new Set(completions.map((c) => `${c.templateId}:${c.professionalId}`));

  // Para cada tarea, los profesionales que la "deben" hacer son los del rol
  // target — restringido al asignado si la tarea tiene assigneeId concreto.
  type Pending = { taskId: string; title: string; dayOfWeek: number; personId: string; personName: string };
  const pending: Pending[] = [];
  for (const t of tasks) {
    const candidates = team.filter((p) => p.role === t.targetRole);
    const targets = t.assigneeId
      ? candidates.filter((p) => p.id === t.assigneeId)
      : candidates;
    for (const p of targets) {
      if (!doneSet.has(`${t.id}:${p.id}`)) {
        pending.push({
          taskId: t.id,
          title: t.title,
          dayOfWeek: t.dayOfWeek,
          personId: p.id,
          personName: p.fullName,
        });
      }
    }
  }

  return (
    <details className="rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <Eye size={15} className="text-muted" />
          Auditoría de tareas (solo CEO)
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
            {pending.length} sin marcar
          </span>
        </span>
        <span className="text-xs text-muted">Mostrar</span>
      </summary>
      <div className="border-t border-border px-5 py-4">
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Todo el equipo al día esta semana. 🎉</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {pending.map((p, i) => (
              <li key={`${p.taskId}-${p.personId}-${i}`} className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{p.title}</span>
                  <span className="ml-2 text-xs text-muted">
                    {WEEKDAYS.find((d) => d.value === p.dayOfWeek)?.long}
                  </span>
                </span>
                <span className="text-xs text-muted">Falta: {p.personName}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
