import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { CourseCover } from "@/components/CourseCover";

export const metadata = { title: "Recursos · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function RecursosPage() {
  const me = await requireOnboardedClient();

  // Mismos cursos que antes vivían en la pestaña "Cursos" de Comunidad.
  // Aquí solo cargamos cursos + progreso del cliente (sin posts del muro).
  const [courses, myProgress] = await Promise.all([
    prisma.communityModule.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            lessons: { orderBy: { order: "asc" }, select: { id: true } },
          },
        },
      },
    }),
    prisma.communityLessonProgress.findMany({
      where: { clientId: me.id },
      select: { lessonId: true },
    }),
  ]);

  const completed = new Set(myProgress.map((p) => p.lessonId));
  const cards = courses.map((c) => {
    const lessonIds = c.sections.flatMap((s) => s.lessons.map((l) => l.id));
    const total = lessonIds.length;
    const done = lessonIds.filter((id) => completed.has(id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      coverUrl: c.coverUrl,
      total,
      done,
      pct,
    };
  });

  return (
    <div className="pt-1">
      <Link
        href="/cliente"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={16} /> Inicio
      </Link>

      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <GraduationCap className="text-primary" size={26} />
          Recursos
        </h1>
        <p className="mt-1 text-sm text-muted">
          Cursos y materiales formativos del equipo para ayudarte en tu proceso.
        </p>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          <GraduationCap size={28} className="mx-auto mb-2 text-primary" />
          Tu nutricionista está preparando los recursos. Vuelve pronto.
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((c) => (
            <Link
              key={c.id}
              href={`/cliente/comunidad/curso/${c.id}`}
              className="flex gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-primary"
            >
              <div className="w-24 flex-shrink-0">
                <CourseCover
                  coverUrl={c.coverUrl}
                  title={c.title}
                  className="aspect-video w-full rounded-lg border border-border"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm font-bold text-text">{c.title}</p>
                {c.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.description}</p>
                ) : null}
                <div className="mt-auto pt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-primary transition-all" style={{ width: `${c.pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {c.done}/{c.total} · {c.pct}%
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
