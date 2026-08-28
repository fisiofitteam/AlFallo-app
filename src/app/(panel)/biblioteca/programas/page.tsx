import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GenerateProgramButton } from "@/components/GenerateProgramButton";

export const metadata = { title: "Programas · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function ProgramasTab() {
  const programs = await prisma.program.findMany({
    where: { isStandalone: false },
    include: {
      weeks: {
        select: {
          days: { select: { _count: { select: { tasks: true } } } },
        },
      },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const rows = programs.map((p) => {
    const totalTasks = p.weeks.reduce(
      (acc, w) => acc + w.days.reduce((a, d) => a + d._count.tasks, 0),
      0,
    );
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      level: p.level,
      weeksCount: p.weeksCount,
      description: p.description,
      totalTasks,
      assignmentsCount: p._count.assignments,
    };
  });

  return (
    <section className="mt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Plantillas de programa de entrenamiento (biblioteca reutilizable).
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/biblioteca/programa-brief-ia"
            className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            🧠 Brief IA
          </Link>
          <GenerateProgramButton />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
          <p className="font-medium">Aún no hay programas.</p>
          <p className="mt-1 text-sm text-muted">
            Genera el primero con el Programador IA o crea uno a mano.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/biblioteca/programas/${p.id}`}
              className="group rounded-2xl border border-border bg-surface p-4 transition hover:border-primary"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {p.type}
                </span>
                <span className="text-[10px] text-muted">Nivel {p.level}</span>
              </div>
              <h3 className="line-clamp-2 font-semibold">{p.name}</h3>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted">{p.description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                <span>{p.weeksCount} semanas</span>
                <span>·</span>
                <span>{p.totalTasks} tareas</span>
                <span>·</span>
                <span>{p.assignmentsCount} asignaciones</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
