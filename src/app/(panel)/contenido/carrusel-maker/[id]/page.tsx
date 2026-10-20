import { canManageContent } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { parseSlides } from "@/lib/carousel-maker/types";
import { DraftEditor } from "@/components/CarouselMaker/DraftEditor";

export const dynamic = "force-dynamic";

export default async function CarouselDraftPage({ params }: { params: { id: string } }) {
  const user = await getActiveProfessional();
  if (!user) redirect("/");
  const canManage = canManageContent(user.role);
  if (!canManage) redirect("/");

  const draft = await (prisma as any).carousel.findUnique({ where: { id: params.id } });
  if (!draft) notFound();

  return (
    <main>
      <div className="mb-4">
        <Link href="/contenido/carrusel-maker" className="text-xs text-neutral-500 hover:text-neutral-900">
          ← Carrusel Maker
        </Link>
      </div>
      <DraftEditor
        initial={{
          id: draft.id,
          title: draft.title,
          brief: draft.brief,
          category: draft.category,
          slides: parseSlides(draft.slidesJson),
          captionText: draft.captionText ?? null,
          status: draft.status,
          createdAt: draft.createdAt.toISOString(),
          updatedAt: draft.updatedAt.toISOString(),
        }}
      />
    </main>
  );
}
