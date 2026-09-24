import "server-only";
import { prisma } from "@/lib/prisma";

/** Suma N meses a una fecha respetando el día del mes (con ajuste natural). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, daysInTarget));
  return d;
}

export type SubscriptionPeriodInput = {
  clientId: string;
  periodMonths: number;
  startDate: Date;
  amountPaid?: number | null;
  paymentMethod?: string | null;
  notes?: string | null;
  isRenewal: boolean;
};

/** Crea un SubscriptionPeriod y garantiza el invariante "1 activo por cliente":
 *
 *  - Si hay un periodo activo cuyo endDate ya venció → se cierra ("finished")
 *    y el nuevo periodo empieza en `startDate` con status="active".
 *  - Si hay un periodo activo cuyo endDate está en el futuro → el nuevo se
 *    crea con status="scheduled" y startDate = endDate del activo (renovación
 *    anticipada), a menos que se pase un startDate explícito posterior.
 *  - Si no hay activo → se crea directamente el nuevo como active.
 *
 *  En cualquier caso se actualiza el cache del Client (programStart/End,
 *  programDurationMonths, subscriptionStatus, subscriptionTotalMonths).
 */
export async function applySubscriptionPeriod(input: SubscriptionPeriodInput) {
  const now = new Date();
  const existingActive = await prisma.subscriptionPeriod.findFirst({
    where: { clientId: input.clientId, status: "active" },
    orderBy: { startDate: "desc" },
  });

  let newStatus: "active" | "scheduled" = "active";
  let newStart = input.startDate;

  if (existingActive) {
    if (existingActive.endDate <= now) {
      // Cerrar el activo colgado
      await prisma.subscriptionPeriod.update({
        where: { id: existingActive.id },
        data: { status: "finished" },
      });
    } else {
      // Renovación anticipada: el nuevo arranca cuando acabe el activo
      newStatus = "scheduled";
      if (input.startDate < existingActive.endDate) {
        newStart = existingActive.endDate;
      }
    }
  }

  const newEnd = addMonths(newStart, input.periodMonths);

  const created = await prisma.subscriptionPeriod.create({
    data: {
      clientId: input.clientId,
      periodMonths: input.periodMonths,
      startDate: newStart,
      endDate: newEnd,
      status: newStatus,
      amountPaid: input.amountPaid ?? null,
      paymentMethod: input.paymentMethod ?? null,
      notes: input.notes ?? null,
      isRenewal: input.isRenewal,
    },
  });

  // Ingreso automático en el libro contable si hay importe. Coherente con la
  // regla de FisioFit: cada evento de cobro deja una línea en Transaction.
  // No creamos aquí Transaction "negativas" al editar / borrar — si el CEO
  // corrige un importe, ajusta la Transaction desde /finanzas.
  if (input.amountPaid && input.amountPaid > 0) {
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      select: { fullName: true },
    });
    const label = input.isRenewal ? "Renovación" : "Alta";
    await prisma.transaction.create({
      data: {
        date: created.decidedAt,
        type: "ingreso",
        category: input.isRenewal ? "renovacion" : "cliente",
        description:
          `${label} · ${client?.fullName ?? "Cliente"} · ${input.periodMonths} ` +
          `${input.periodMonths === 1 ? "mes" : "meses"}` +
          (input.paymentMethod ? ` · ${input.paymentMethod}` : ""),
        amount: input.amountPaid,
        source: input.paymentMethod ?? "manual",
      },
    });
  }

  await refreshClientCache(input.clientId);
  return created;
}

/** Recalcula los campos derivados del Client a partir de sus SubscriptionPeriod. */
export async function refreshClientCache(clientId: string) {
  const periods = await prisma.subscriptionPeriod.findMany({
    where: { clientId },
    orderBy: { startDate: "asc" },
  });
  const active = periods.find((p) => p.status === "active");
  const totalMonths = periods
    .filter((p) => p.status === "active" || p.status === "finished")
    .reduce((n, p) => n + (p.periodMonths ?? 0), 0);

  await prisma.client.update({
    where: { id: clientId },
    data: {
      programStartDate: active?.startDate ?? null,
      programEndDate: active?.endDate ?? null,
      programDurationMonths: active?.periodMonths ?? null,
      subscriptionStatus: active ? "active" : periods.length > 0 ? "finished" : "pending",
      subscriptionTotalMonths: totalMonths || null,
    },
  });
}

/** Devuelve el periodo activo (si lo hay) y el histórico ordenado descendente. */
export async function listPeriodsForClient(clientId: string) {
  const periods = await prisma.subscriptionPeriod.findMany({
    where: { clientId },
    orderBy: [{ startDate: "desc" }],
  });
  const active = periods.find((p) => p.status === "active") ?? null;
  return { active, history: periods.filter((p) => p.id !== active?.id) };
}

/** Días entre dos fechas (positivo si to > from). */
function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

/** Progreso simple del periodo activo. */
export function periodProgress(period: {
  startDate: Date;
  endDate: Date;
}) {
  const now = new Date();
  const total = Math.max(1, daysBetween(period.startDate, period.endDate));
  const consumed = Math.max(0, Math.min(total, daysBetween(period.startDate, now)));
  const remainingDays = Math.max(0, daysBetween(now, period.endDate));
  return {
    total,
    consumed,
    remainingDays,
    percent: Math.round((consumed / total) * 100),
    isExpired: now > period.endDate,
    isFuture: now < period.startDate,
  };
}
