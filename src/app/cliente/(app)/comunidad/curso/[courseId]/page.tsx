import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { ClientCourse } from "@/components/ClientCourse";

export const metadata = { title: "Curso · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function ClientCoursePage({ params }: { params: { courseId: string } }) {
  const me = await requireOnboardedClient();

  const course = await prisma.communityModule.findUnique({
    where: { id: params.courseId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              videoUrl: true,
              order: true,
            },
          },
        },
      },
    },
  });
  if (!course || !course.published) notFound();

  const lessonIds = course.sections.flatMap((s) => s.lessons.map((l) => l.id));
  const myProgress = await prisma.communityLessonProgress.findMany({
    where: { clientId: me.id, lessonId: { in: lessonIds } },
    select: { lessonId: true },
  });
  const completed = new Set(myProgress.map((p) => p.lessonId));

  return (
    <ClientCourse
      course={{
        id: course.id,
        title: course.title,
        description: course.description,
        coverUrl: course.coverUrl,
      }}
      sections={course.sections.map((s) => ({
        id: s.id,
        title: s.title,
        lessons: s.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description,
          videoUrl: l.videoUrl,
          completed: completed.has(l.id),
        })),
      }))}
    />
  );
}
