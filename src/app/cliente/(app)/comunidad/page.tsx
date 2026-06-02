import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { ClientCommunity } from "@/components/ClientCommunity";

export const metadata = { title: "Comunidad · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function ClientComunidadPage() {
  const me = await requireOnboardedClient();

  // Cargamos cursos + lecciones (para calcular % de progreso) y el feed inicial.
  // Las APIs siguen sirviendo refresh tras crear/editar; aquí solo hacemos el SSR inicial.
  const [courses, posts, myProgress, myReactions] = await Promise.all([
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
    prisma.communityFeedPost.findMany({
      where: { published: true },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        authorProfessional: { select: { fullName: true, imageUrl: true, role: true } },
        authorClient: { select: { fullName: true, imageUrl: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    }),
    prisma.communityLessonProgress.findMany({
      where: { clientId: me.id },
      select: { lessonId: true },
    }),
    prisma.communityReaction.findMany({
      where: { clientId: me.id },
      select: { postId: true },
    }),
  ]);

  const completedLessonIds = new Set(myProgress.map((p) => p.lessonId));
  const likedPostIds = new Set(myReactions.map((r) => r.postId));

  // Marcamos la visita ahora para resetear el badge de novedades.
  // Lo hacemos en segundo plano sin bloquear el render.
  prisma.client
    .update({ where: { id: me.id }, data: { communityLastSeenAt: new Date() } })
    .catch(() => {});

  const coursesPayload = courses.map((c) => {
    const lessonIds = c.sections.flatMap((s) => s.lessons.map((l) => l.id));
    const total = lessonIds.length;
    const done = lessonIds.filter((id) => completedLessonIds.has(id)).length;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      coverUrl: c.coverUrl,
      totalLessons: total,
      completedLessons: done,
    };
  });

  const postsPayload = posts.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    imageUrl: p.imageUrl,
    videoUrl: p.videoUrl,
    pinned: p.pinned,
    createdAt: p.createdAt.toISOString(),
    authorName: p.authorProfessional?.fullName ?? p.authorClient?.fullName ?? "Anónimo",
    authorImageUrl: p.authorProfessional?.imageUrl ?? p.authorClient?.imageUrl ?? null,
    isTeam: !!p.authorProfessionalId,
    teamRole: p.authorProfessional?.role ?? null,
    isMine: p.authorClientId === me.id,
    comments: p._count.comments,
    reactions: p._count.reactions,
    liked: likedPostIds.has(p.id),
  }));

  return (
    <ClientCommunity
      me={{ id: me.id, fullName: me.fullName }}
      courses={coursesPayload}
      initialPosts={postsPayload}
    />
  );
}
