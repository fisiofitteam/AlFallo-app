import Link from "next/link";
import { NotebookPen, UtensilsCrossed, CheckCircle2, Circle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";

export const metadata = { title: "Inicio · Al Fallo" };

function todayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export default async function ClientHomePage() {
  const me = await requireOnboardedClient();

  const [plan, todayLog] = await Promise.all([
    prisma.nutritionPlan.findFirst({
      where: { clientId: me.id },
      orderBy: { createdAt: "desc" },
      select: { name: true },
    }),
    prisma.dailyLog.findUnique({
      where: { clientId_date: { clientId: me.id, date: todayUtc() } },
      select: { id: true },
    }),
  ]);

  const logged = Boolean(todayLog);

  return (
    <div>
      <h1 className="text-2xl font-bold">Hola, {me.fullName.split(" ")[0]} 👋</h1>
      <p className="mt-1 text-muted">Este es tu resumen de hoy.</p>

      {/* Estado del registro de hoy */}
      <Link
        href="/cliente/registro"
        className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
      >
        {logged ? (
          <CheckCircle2 className="text-[#1fa971]" size={26} />
        ) : (
          <Circle className="text-muted" size={26} />
        )}
        <div>
          <p className="font-semibold">{logged ? "Registro de hoy hecho" : "Aún no has registrado hoy"}</p>
          <p className="text-sm text-muted">
            {logged ? "Puedes editarlo cuando quieras." : "Apunta tu peso y sensaciones."}
          </p>
        </div>
      </Link>

      {/* Accesos */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/cliente/plan" className="rounded-2xl border border-border bg-surface p-4">
          <UtensilsCrossed className="text-primary" size={24} />
          <p className="mt-2 font-semibold">Mi plan</p>
          <p className="text-xs text-muted">{plan ? plan.name : "Aún sin plan"}</p>
        </Link>
        <Link href="/cliente/registro" className="rounded-2xl border border-border bg-surface p-4">
          <NotebookPen className="text-primary" size={24} />
          <p className="mt-2 font-semibold">Registro diario</p>
          <p className="text-xs text-muted">Peso, energía, sueño…</p>
        </Link>
      </div>
    </div>
  );
}
