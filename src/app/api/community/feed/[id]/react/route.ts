import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommunityActor } from "@/lib/community-actor";

// Toggle del "me gusta" del actor en el post. Devuelve { liked, count }.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getCommunityActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const where =
    actor.kind === "client"
      ? { postId: params.id, clientId: actor.clientId }
      : { postId: params.id, professionalId: actor.professionalId };

  const existing = await prisma.communityReaction.findFirst({ where });
  if (existing) {
    await prisma.communityReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.communityReaction.create({
      data: {
        postId: params.id,
        clientId: actor.kind === "client" ? actor.clientId : null,
        professionalId: actor.kind === "team" ? actor.professionalId : null,
      },
    });
  }

  const count = await prisma.communityReaction.count({ where: { postId: params.id } });
  return NextResponse.json({ liked: !existing, count });
}
