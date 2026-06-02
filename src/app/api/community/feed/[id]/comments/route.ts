import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommunityActor } from "@/lib/community-actor";

const COMMENT_INCLUDE = {
  client: { select: { fullName: true, imageUrl: true } },
  professional: { select: { fullName: true, imageUrl: true, role: true } },
} as const;

function serialize(c: {
  id: string;
  body: string;
  createdAt: Date;
  clientId: string | null;
  professionalId: string | null;
  client: { fullName: string; imageUrl: string | null } | null;
  professional: { fullName: string; imageUrl: string | null; role: string } | null;
}) {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    authorName: c.professional?.fullName ?? c.client?.fullName ?? "Anónimo",
    authorImageUrl: c.professional?.imageUrl ?? c.client?.imageUrl ?? null,
    isTeam: !!c.professionalId,
    teamRole: c.professional?.role ?? null,
  };
}

// GET — comentarios de un post (cronológico ascendente).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getCommunityActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comments = await prisma.communityComment.findMany({
    where: { postId: params.id },
    orderBy: { createdAt: "asc" },
    include: COMMENT_INCLUDE,
  });
  return NextResponse.json(comments.map(serialize));
}

// POST — añade comentario. body: { body }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getCommunityActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const body = typeof b?.body === "string" ? b.body.trim() : "";
  if (!body) return NextResponse.json({ error: "El comentario está vacío." }, { status: 400 });

  const created = await prisma.communityComment.create({
    data: {
      postId: params.id,
      clientId: actor.kind === "client" ? actor.clientId : null,
      professionalId: actor.kind === "team" ? actor.professionalId : null,
      body,
    },
    include: COMMENT_INCLUDE,
  });
  return NextResponse.json(serialize(created));
}
