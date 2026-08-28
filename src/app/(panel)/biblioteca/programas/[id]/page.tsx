import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Programa · Biblioteca" };
export const dynamic = "force-dynamic";

const DAY_LABELS = ["", "Día 1", "Día 2", "Día 3", "Día 4", "Día 5", "Día 6", "Día 7"];

export default async function ProgramDetail({ params }: { params: { id: string } }) {
  const program = await prisma.program.findUnique({
    where: { id: params.id },
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
      _count: { select: { assignments: true } },
    },
  });
  if (!program) notFound();

  return (
    <div className="mt-4">
      <Link
        href="/biblioteca/programas"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={15} /> Volver a programas
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold">{program.name}</h1>
          <span className="rounded bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {program.type}
          </span>
          <span className="text-xs text-muted">Nivel {program.level}</span>
          <span className="text-xs text-muted">
            · {program.weeksCount} semanas · {program._count.assignments} asignaciones
          </span>
        </div>
        {program.description && (
          <p className="mt-1 text-sm text-muted">{program.description}</p>
        )}
      </header>

      <div className="space-y-6">
        {program.weeks.map((week) => {
          const daysWithTasks = week.days.filter((d) => d.tasks.length > 0);
          return (
            <section key={week.id} className="rounded-2xl border border-border bg-surface p-4">
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-semibold">Semana {week.weekNumber}</h2>
                {daysWithTasks.length === 0 && (
                  <span className="text-xs italic text-muted">Sin sesiones</span>
                )}
              </header>
              {daysWithTasks.length === 0 ? null : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {daysWithTasks.map((day) => (
                    <article
                      key={day.id}
                      className="rounded-xl border border-border bg-bg p-3"
                    >
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {DAY_LABELS[day.dayOfWeek]}
                      </p>
                      <div className="space-y-2">
                        {day.tasks.map((t) => (
                          <div key={t.id}>
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                              {t.title}
                            </p>
                            {t.workout?.bodyText && (
                              <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-snug text-text/90">
                                {t.workout.bodyText}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
