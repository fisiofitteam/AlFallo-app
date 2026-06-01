import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { CallsListView } from "@/components/CallsListView";

export const metadata = { title: "Llamadas de venta · CRM" };

export default async function LlamadasVentaPage({
  searchParams,
}: {
  searchParams: { status?: string; closer?: string };
}) {
  const user = (await getActiveProfessional())!;
  if (user.role !== "ceo" && user.role !== "closer" && user.role !== "setter") redirect("/");

  const status = ["scheduled", "won", "lost", "cancelled", "no_show"].includes(searchParams.status ?? "")
    ? searchParams.status!
    : "scheduled";

  const closers = await prisma.professional.findMany({
    where: { role: { in: ["ceo", "closer"] } },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });

  let activeCloserId: string;
  if (user.role === "ceo") {
    activeCloserId = searchParams.closer || user.id;
  } else if (user.role === "setter") {
    activeCloserId = searchParams.closer || closers[0]?.id || "";
  } else {
    activeCloserId = user.id;
  }

  const baseWhere = { closerId: activeCloserId };

  // Contadores por status (filtrados por closer activo)
  const counts = await Promise.all([
    prisma.lead.count({ where: { ...baseWhere, status: "scheduled", inFollowUp: false } }),
    prisma.lead.count({ where: { ...baseWhere, status: "won" } }),
    prisma.lead.count({ where: { ...baseWhere, status: "lost" } }),
    prisma.lead.count({ where: { ...baseWhere, status: "cancelled" } }),
    prisma.lead.count({ where: { ...baseWhere, status: "no_show" } }),
  ]);

  const leads = await prisma.lead.findMany({
    where: { ...baseWhere, status, ...(status === "scheduled" ? { inFollowUp: false } : {}) },
    include: {
      setter: { select: { id: true, fullName: true, role: true } },
      closer: { select: { id: true, fullName: true, role: true } },
      convertedClient: { select: { id: true, fullName: true } },
    },
    orderBy: status === "scheduled" ? { callScheduledAt: "asc" } : { decidedAt: "desc" },
  });

  // Profesionales que pueden ser asignados como "nutri responsable" tras la venta
  const nutris = await prisma.professional.findMany({
    where: { role: { in: ["nutricionista", "head_coach"] }, isActive: true },
    orderBy: { fullName: "asc" },
  });

  return (
    <CallsListView
      activeStatus={status}
      activeCloserId={activeCloserId}
      currentUser={{ id: user.id, fullName: user.fullName, role: user.role }}
      closers={closers.map((c) => ({ id: c.id, fullName: c.fullName, role: c.role }))}
      leads={leads.map((l) => ({
        id: l.id,
        fullName: l.fullName,
        contactType: l.contactType,
        contactValue: l.contactValue,
        aiSummary: l.aiSummary,
        callScheduledAt: l.callScheduledAt.toISOString(),
        status: l.status,
        inFollowUp: l.inFollowUp,
        followUpNote: l.followUpNote,
        followUpDate: l.followUpDate?.toISOString() ?? null,
        lostReason: l.lostReason,
        setter: l.setter,
        closer: l.closer,
        convertedClient: l.convertedClient,
        decidedAt: l.decidedAt?.toISOString() ?? null,
        email: l.email,
        phone: l.phone,
        motivo: l.motivo,
        intentosPrevios: l.intentosPrevios,
        objetivoNutricional: l.objetivoNutricional,
        meetingUrl: l.meetingUrl,
        source: l.source,
        setterNotifiedAt: l.setterNotifiedAt?.toISOString() ?? null,
        closerContactedAt: l.closerContactedAt?.toISOString() ?? null,
        reminderSentAt: l.reminderSentAt?.toISOString() ?? null,
        aiScheduled: l.aiScheduled,
      }))}
      nutris={nutris.map((f) => ({ id: f.id, fullName: f.fullName, role: f.role }))}
      counts={{
        scheduled: counts[0],
        won: counts[1],
        lost: counts[2],
        cancelled: counts[3],
        no_show: counts[4],
      }}
    />
  );
}
