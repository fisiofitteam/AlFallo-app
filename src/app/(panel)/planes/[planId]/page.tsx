import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, isManagerRole } from "@/lib/clients";
import { PlanBuilder } from "@/components/PlanBuilder";
import { loadPlanForBuilder } from "@/lib/loadPlanData";

export const metadata = { title: "Plan nutricional · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: { planId: string } }) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const loaded = await loadPlanForBuilder(params.planId);
  if (!loaded) redirect("/clientes");

  // Comprobamos acceso al cliente del plan.
  const ownership = await prisma.nutritionPlan.findUnique({
    where: { id: params.planId },
    select: { client: { select: { nutritionistId: true } } },
  });
  if (!isManagerRole(prof.role) && ownership?.client.nutritionistId !== prof.id) {
    redirect("/clientes");
  }

  return (
    <PlanBuilder
      key={loaded.plan.id}
      planId={loaded.plan.id}
      clientId={loaded.plan.clientId}
      clientName={loaded.plan.client.fullName}
      planName={loaded.plan.name}
      initialDays={loaded.days}
      initialNotes={loaded.plan.notes}
      initialSupplementation={loaded.plan.supplementation}
      initialTargets={loaded.targets}
    />
  );
}
