import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommunityActor } from "@/lib/community-actor";
import { FEED_CATEGORIES } from "@/lib/community-feed";

const VALID_CATEGORIES = FEED_CATEGORIES.map((c) => c.value);

const FEED_INCLUDE = {
  authorProfessional: { select: { fullName: true, imageUrl: true, role: true } },
  authorClient: { select: { fullName: true, imageUrl: true } },
  _count: { select: { comments: true, reactions: true } },
} as const;

// GET — feed del muro. Cualquier actor (equipo o cliente) puede leer.
export async function GET() {
  const actor = await getCommunityActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const posts = await prisma.communityFeedPost.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: FEED_INCLUDE,
  });
  return NextResponse.json(posts);
}

// POST — crea un post. Puede publicar equipo o cliente.
// Body: { title?, body, category?, imageUrl?, videoUrl?, pinned? } (pinned solo equipo).
export async function POST(req: NextRequest) {
  const actor = await getCommunityActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const body = typeof b?.body === "string" ? b.body.trim() : "";
  if (!body) return NextResponse.json({ error: "El texto del post es obligatorio." }, { status: 400 });
  const category = VALID_CATEGORIES.includes(b?.category) ? b.category : "general";

  const created = await prisma.communityFeedPost.create({
    data: {
      authorProfessionalId: actor.kind === "team" ? actor.professionalId : null,
      authorClientId: actor.kind === "client" ? actor.clientId : null,
      category,
      title: b?.title?.trim() || null,
      body,
      imageUrl: b?.imageUrl?.trim() || null,
      videoUrl: b?.videoUrl?.trim() || null,
      pinned: actor.kind === "team" && b?.pinned === true,
    },
    include: FEED_INCLUDE,
  });
  return NextResponse.json(created);
}
