import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveClient } from "@/lib/client-session";

// Solo el cliente (atleta) puede marcar lecciones completadas. Toggle.
// Devuelve { completed: true|false } según quede tras la operación.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const client = await getActiveClient();
  if (!client) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.communityLessonProgress.findUnique({
    where: { lessonId_clientId: { lessonId: params.id, clientId: client.id } },
  });

  if (existing) {
    await prisma.communityLessonProgress.delete({ where: { id: existing.id } });
    return NextResponse.json({ completed: false });
  }
  await prisma.communityLessonProgress.create({
    data: { lessonId: params.id, clientId: client.id },
  });
  return NextResponse.json({ completed: true });
}
