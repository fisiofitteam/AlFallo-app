import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { CallsList } from "@/components/CallsList";

export const metadata = { title: "Llamadas de seguimiento · Al Fallo Nutrition" };

export default async function CallsSeguimientoPage() {
  const user = await getActiveProfessional();
  if (!user) redirect("/login");
  if (!["ceo", "head_coach", "nutricionista"].includes(user.role)) redirect("/");

  const calls = await prisma.scheduledCall.findMany({
    include: { client: true },
    orderBy: [{ completedAt: "asc" }, { scheduledAt: "asc" }],
  });
  const clients = await prisma.client.findMany({
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold md:text-3xl">Llamadas de seguimiento</h1>
        <p className="mt-1 text-muted">
          Llamadas programadas con clientes ya activos (optimización del plan, renovaciones).
        </p>
      </header>
      <CallsList
        calls={calls.map((c) => ({
          id: c.id,
          patientId: c.clientId,
          patientName: c.client.fullName,
          scheduledAt: c.scheduledAt.toISOString(),
          type: c.type,
          notes: c.notes ?? "",
          completedAt: c.completedAt?.toISOString() ?? null,
          outcome: c.outcome ?? "",
        }))}
        patients={clients.map((p) => ({ id: p.id, fullName: p.fullName }))}
      />
    </main>
  );
}
