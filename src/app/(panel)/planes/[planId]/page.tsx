import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, isManagerRole } from "@/lib/clients";
import { PlanBuilder, type PlanBuilderDay, type PlanBuilderTargets } from "@/components/PlanBuilder";

export const metadata = { title: "Plan nutricional · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: { planId: string } }) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const plan = await prisma.nutritionPlan.findUnique({
    where: { id: params.planId },
    include: {
      client: { include: { macroTargets: true } },
      days: {
        orderBy: { order: "asc" },
        include: {
          meals: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  if (!plan) redirect("/clientes");
  // Solo manager o nutricionista asignado al cliente pueden editar.
  if (!isManagerRole(prof.role) && plan.client.nutritionistId !== prof.id) {
    redirect("/clientes");
  }

  const targets: PlanBuilderTargets = {
    kcal: plan.client.macroTargets?.kcalTraining ?? null,
    protein: plan.client.macroTargets?.proteinTraining ?? null,
    carbs: plan.client.macroTargets?.carbsTraining ?? null,
    fat: plan.client.macroTargets?.fatTraining ?? null,
  };

  const days: PlanBuilderDay[] = plan.days.map((d) => ({
    id: d.id,
    name: d.name,
    dayType: d.dayType,
    meals: d.meals.map((m) => ({
      id: m.id,
      name: m.name,
      // Cada item es una "opción". Para los items freestyle (foodId===null)
      // los *Per100 son ya los totales (quantityG=100 por convención).
      // Para items con foodId (alimento de biblioteca) calculamos el total
      // multiplicando por (quantityG / 100).
      options: m.items.map((it) => {
        const factor = it.foodId ? it.quantityG / 100 : 1;
        return {
          id: it.id,
          text: it.nameSnapshot,
          kcal: Math.round(it.kcalPer100 * factor),
          protein: Math.round(it.proteinPer100 * factor * 10) / 10,
          carbs: Math.round(it.carbsPer100 * factor * 10) / 10,
          fat: Math.round(it.fatPer100 * factor * 10) / 10,
          selected: it.selected,
        };
      }),
    })),
  }));

  return (
    <PlanBuilder
      planId={plan.id}
      clientId={plan.clientId}
      clientName={plan.client.fullName}
      planName={plan.name}
      initialDays={days}
      initialTargets={targets}
    />
  );
}
