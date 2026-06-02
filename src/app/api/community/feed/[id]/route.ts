import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommunityActor } from "@/lib/community-actor";
import { FEED_CATEGORIES } from "@/lib/community-feed";

const VALID_CATEGORIES = FEED_CATEGORIES.map((c) => c.value);

// Equipo modera todo. Cliente solo lo propio.
function canEdit(actor: { kind: string; professionalId: string | null; clientId: string | null },
  post: { authorProfessionalId: string | null; authorClientId: string | null },
): boolean {
  if (actor.kind === "team") return true; // equipo edita/borra cualquier post
  if (actor.kind === "client" && post.authorClientId === actor.clientId) return true;
  return false;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getCommunityActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const post = await prisma.communityFeedPost.findUnique({
    where: { id: params.id },
    select: { authorProfessionalId: true, authorClientId: true },
  });
  if (!post) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!canEdit(actor, post)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if ("title" in b) data.title = b.title?.trim() || null;
  if (typeof b?.body === "string") data.body = b.body.trim();
  if ("imageUrl" in b) data.imageUrl = b.imageUrl?.trim() || null;
  if ("videoUrl" in b) data.videoUrl = b.videoUrl?.trim() || null;
  // Solo el equipo puede pinear / despublicar.
  if (actor.kind === "team" && typeof b?.pinned === "boolean") data.pinned = b.pinned;
  if (actor.kind === "team" && typeof b?.published === "boolean") data.published = b.published;
  if (VALID_CATEGORIES.includes(b?.category)) data.category = b.category;

  const updated = await prisma.communityFeedPost.update({
    where: { id: params.id },
    data,
    include: {
      authorProfessional: { select: { fullName: true, imageUrl: true, role: true } },
      authorClient: { select: { fullName: true, imageUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getCommunityActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const post = await prisma.communityFeedPost.findUnique({
    where: { id: params.id },
    select: { authorProfessionalId: true, authorClientId: true },
  });
  if (!post) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!canEdit(actor, post)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.communityFeedPost.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
