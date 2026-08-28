import { prisma } from "@/lib/prisma";
import {
  BRIEF_KINDS,
  BRIEF_KIND_LABEL,
  getAiTrainingBrief,
  type AiTrainingBriefData,
} from "@/lib/ai-training-brief";
import { AiTrainingBriefEditor } from "@/components/AiTrainingBriefEditor";

export const metadata = { title: "Brief programador IA · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function BriefPage({
  searchParams,
}: {
  searchParams: { kind?: string };
}) {
  const kind = BRIEF_KINDS.includes(searchParams.kind ?? "")
    ? (searchParams.kind as string)
    : BRIEF_KINDS[0];

  const briefs: { kind: string; label: string; brief: AiTrainingBriefData; examples: number }[] =
    [];
  for (const k of BRIEF_KINDS) {
    const [brief, examples] = await Promise.all([
      getAiTrainingBrief(k),
      prisma.aiSessionExample.count({ where: { kind: k } }),
    ]);
    briefs.push({ kind: k, label: BRIEF_KIND_LABEL[k] ?? k, brief, examples });
  }

  return (
    <section className="mt-4">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Brief del Programador IA</h2>
        <p className="mt-1 text-xs text-muted">
          Voz estable que la IA inyecta como system prompt en cada sesión. Un brief por modalidad.
        </p>
      </header>
      <AiTrainingBriefEditor briefs={briefs} activeKind={kind} />
    </section>
  );
}
