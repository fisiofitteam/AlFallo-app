import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { SetterLeadsView } from "@/components/SetterLeadsView";

export const metadata = { title: "Leads · CRM" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { closer?: string };
}) {
  const user = (await getActiveProfessional())!;

  // CEO y closer tienen sus propias páginas
  if (user.role === "ceo" || user.role === "closer") {
    redirect("/crm/llamadas-venta");
  }
  // Head coach ya no usa Leads (lo quitamos del sidebar)
  if (user.role === "head_coach") {
    redirect("/");
  }
  if (user.role !== "setter") redirect("/");

  const closers = await prisma.professional.findMany({
    where: { role: { in: ["ceo", "closer"] } },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });

  const activeFilter = searchParams.closer ?? "all";

  const where: any = { status: "scheduled", setterNotifiedAt: null };
  if (activeFilter !== "all") {
    where.closerId = activeFilter;
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      closer: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { callScheduledAt: "asc" },
  });

  // Counts por closer (solo pendientes de avisar)
  const allPending = await prisma.lead.findMany({
    where: { status: "scheduled", setterNotifiedAt: null },
    select: { closerId: true },
  });
  const counts: Record<string, number> = { all: allPending.length };
  for (const c of closers) {
    counts[c.id] = allPending.filter((l) => l.closerId === c.id).length;
  }

  return (
    <SetterLeadsView
      activeFilter={activeFilter}
      counts={counts}
      closers={closers.map((c) => ({ id: c.id, fullName: c.fullName, role: c.role }))}
      leads={leads.map((l) => ({
        id: l.id,
        fullName: l.fullName,
        contactType: l.contactType,
        contactValue: l.contactValue,
        email: l.email,
        phone: l.phone,
        motivo: l.motivo,
        intentosPrevios: l.intentosPrevios,
        objetivoNutricional: l.objetivoNutricional,
        aiSummary: l.aiSummary,
        meetingUrl: l.meetingUrl,
        source: l.source,
        aiScheduled: l.aiScheduled,
        callScheduledAt: l.callScheduledAt.toISOString(),
        closer: l.closer,
      }))}
    />
  );
}
