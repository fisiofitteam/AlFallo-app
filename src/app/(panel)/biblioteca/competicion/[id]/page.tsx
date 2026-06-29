import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { getCompetitionTemplate } from "@/lib/competitionTemplates";
import { CompetitionTemplateEditor } from "@/components/CompetitionTemplateEditor";

export const metadata = { title: "Editar plantilla · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function CompetitionTemplateEditPage({
  params,
}: {
  params: { id: string };
}) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");

  const tpl = await getCompetitionTemplate(params.id);
  if (!tpl) redirect("/biblioteca/competicion");

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/biblioteca/competicion"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> Plantillas
      </Link>
      <header className="mb-6 flex items-center gap-2">
        <Trophy className="text-amber-500" size={22} />
        <h1 className="text-xl font-bold md:text-2xl">Editar plantilla</h1>
      </header>
      <CompetitionTemplateEditor initial={tpl} />
    </div>
  );
}
