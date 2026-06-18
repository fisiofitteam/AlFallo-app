import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { getAllBriefs } from "@/lib/aiBrief";
import { getAllSpecialConsiderations } from "@/lib/specialConsiderations";
import { prisma } from "@/lib/prisma";
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
  const [briefs, specials, rules, feedback] = await Promise.all([
    getAllBriefs(),
    getAllSpecialConsiderations(),
    prisma.planGenerationRule.findMany({
      orderBy: { order: "asc" },
    }),
    prisma.planGenerationFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  // Para enriquecer el feedback con el nombre del cliente y plan (si siguen
  // existiendo). Recogemos los IDs únicos y consultamos en bloque.
  const clientIds = Array.from(new Set(feedback.map((f) => f.clientId).filter(Boolean) as string[]));
  const planIds = Array.from(new Set(feedback.map((f) => f.planId).filter(Boolean) as string[]));
  const [clients, plans] = await Promise.all([
    clientIds.length
      ? prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, fullName: true },
        })
      : [],
    planIds.length
      ? prisma.nutritionPlan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);
  const clientNameById = new Map(clients.map((c) => [c.id, c.fullName]));
  const planNameById = new Map(plans.map((p) => [p.id, p.name]));

  return (
    <AIBriefEditor
      initial={briefs}
      initialSpecial={specials}
      initialRules={rules.map((r) => ({
        id: r.id,
        text: r.text,
        active: r.active,
        order: r.order,
        createdAt: r.createdAt.toISOString(),
      }))}
      initialFeedback={feedback.map((f) => ({
        id: f.id,
        verdict: f.verdict as "good" | "bad",
        reason: f.reason,
        clientName: f.clientId ? clientNameById.get(f.clientId) ?? null : null,
        planName: f.planId ? planNameById.get(f.planId) ?? null : null,
        createdAt: f.createdAt.toISOString(),
      }))}
    />
  );
}
