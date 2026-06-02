import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { CommunityManager } from "@/components/CommunityManager";

export const metadata = { title: "Comunidad · Al Fallo Nutrition" };
export const dynamic = "force-dynamic";

export default async function ComunidadPage() {
  const user = await getActiveProfessional();
  if (!user) redirect("/login");

  // Cualquier rol del equipo puede ver / moderar el muro. Solo managers
  // editan el Classroom (cursos y lecciones).
  const ALLOWED = ["ceo", "head_coach", "nutricionista", "setter", "closer"];
  if (!ALLOWED.includes(user.role)) redirect("/");
  const canModerate = true;
  const canManageClassroom = user.role === "ceo" || user.role === "head_coach";

  const [courses, posts] = await Promise.all([
    prisma.communityModule.findMany({
      orderBy: { order: "asc" },
      include: {
        sections: { orderBy: { order: "asc" }, include: { _count: { select: { lessons: true } } } },
      },
    }),
    prisma.communityFeedPost.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        authorProfessional: { select: { fullName: true, imageUrl: true, role: true } },
        authorClient: { select: { fullName: true, imageUrl: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl">
      <CommunityManager
        canManageClassroom={canManageClassroom}
        canModerate={canModerate}
        initialCourses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          coverUrl: c.coverUrl,
          published: c.published,
          lessonCount: c.sections.reduce((n, s) => n + s._count.lessons, 0),
          sectionCount: c.sections.length,
        }))}
        initialPosts={posts.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          imageUrl: p.imageUrl,
          videoUrl: p.videoUrl,
          pinned: p.pinned,
          published: p.published,
          category: p.category,
          authorName: p.authorProfessional?.fullName ?? p.authorClient?.fullName ?? null,
          authorImageUrl: p.authorProfessional?.imageUrl ?? p.authorClient?.imageUrl ?? null,
          isClient: !!p.authorClientId,
          createdAt: p.createdAt.toISOString(),
          comments: p._count.comments,
          reactions: p._count.reactions,
        }))}
      />
    </main>
  );
}
