import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { getAllBriefs } from "@/lib/aiBrief";
import { AIBriefEditor } from "@/components/AIBriefEditor";

export const metadata = { title: "Brief IA · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function BriefIATab() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
        Solo CEO y Head Coach pueden editar los briefs del generador IA.
      </p>
    );
  }
  const briefs = await getAllBriefs();
  return <AIBriefEditor initial={briefs} />;
}
