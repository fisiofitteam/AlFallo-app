import { prisma } from "@/lib/prisma";
import { VideosManager, type VideoItem } from "@/components/VideosManager";

export const metadata = { title: "Vídeos · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function VideosTab() {
  const videos = await prisma.videoResource.findMany({
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { fullName: true } } },
  });

  const payload: VideoItem[] = videos.map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    url: v.url,
    category: v.category,
    authorName: v.createdBy?.fullName ?? null,
  }));

  return <VideosManager videos={payload} />;
}
