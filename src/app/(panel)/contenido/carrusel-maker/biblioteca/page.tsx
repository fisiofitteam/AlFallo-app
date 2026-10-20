import { canManageContent } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { LibraryView } from "@/components/CarouselMaker/LibraryView";

export const dynamic = "force-dynamic";

export default async function CarouselLibraryPage() {
  const user = await getActiveProfessional();
  if (!user) redirect("/");
  const canManage = canManageContent(user.role);
  if (!canManage) redirect("/");

  const entries = await (prisma as any).carouselLibraryEntry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main>
      <div className="mb-3">
        <Link href="/contenido/carrusel-maker" className="text-xs text-neutral-500 hover:text-neutral-900">
          ← Carrusel Maker
        </Link>
      </div>
      <LibraryView
        initialEntries={entries.map((e: any) => ({
          id: e.id,
          topic: e.topic,
          category: e.category,
          slidesJson: e.slidesJson,
          captionText: e.captionText,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
