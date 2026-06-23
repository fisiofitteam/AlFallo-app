import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { ClientCommunity } from "@/components/ClientCommunity";

export const metadata = { title: "Comunidad · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function ClientComunidadPage() {
  const me = await requireOnboardedClient();

  // Cursos se cargan ahora en /cliente/recursos (otra pestaña). Aquí solo
  // necesitamos el feed inicial y las reacciones del cliente.
  const [posts, myReactions] = await Promise.all([
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
    prisma.communityReaction.findMany({
      where: { clientId: me.id },
      select: { postId: true },
    }),
  ]);

  const likedPostIds = new Set(myReactions.map((r) => r.postId));

  // Marcamos la visita ahora para resetear el badge de novedades.
  // Lo hacemos en segundo plano sin bloquear el render.
  prisma.client
    .update({ where: { id: me.id }, data: { communityLastSeenAt: new Date() } })
    .catch(() => {});

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
      initialPosts={postsPayload}
    />
  );
}
