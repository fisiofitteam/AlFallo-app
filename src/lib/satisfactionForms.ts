import { prisma } from "@/lib/prisma";

export type SatisfactionQuestion =
  | {
      id: string;
      type: "scale";
      label: string;
      required?: boolean;
      scaleMin: number;
      scaleMax: number;
      scaleMinLabel?: string;
      scaleMaxLabel?: string;
      /** Si es true, la respuesta cuenta para la media global "Satisfacción". */
      isSatisfactionScore?: boolean;
    }
  | {
      id: string;
      type: "text";
      label: string;
      required?: boolean;
      placeholder?: string;
    };

export function parseQuestions(raw: unknown): SatisfactionQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: SatisfactionQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const o = q as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const label = typeof o.label === "string" ? o.label : "";
    const type = o.type;
    if (!id || !label) continue;
    if (type === "scale") {
      out.push({
        id,
        type: "scale",
        label,
        required: !!o.required,
        scaleMin: Number.isFinite(o.scaleMin) ? Number(o.scaleMin) : 1,
        scaleMax: Number.isFinite(o.scaleMax) ? Number(o.scaleMax) : 10,
        scaleMinLabel: typeof o.scaleMinLabel === "string" ? o.scaleMinLabel : undefined,
        scaleMaxLabel: typeof o.scaleMaxLabel === "string" ? o.scaleMaxLabel : undefined,
        isSatisfactionScore: !!o.isSatisfactionScore,
      });
    } else if (type === "text") {
      out.push({
        id,
        type: "text",
        label,
        required: !!o.required,
        placeholder: typeof o.placeholder === "string" ? o.placeholder : undefined,
      });
    }
  }
  return out;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Semana del programa del cliente (0 = primera semana). null si aún no tiene
 *  fecha de inicio. Preferimos la fecha del primer SubscriptionPeriod (fuente
 *  de verdad del negocio); si no hay ninguno, caemos al Sale más antiguo por
 *  compatibilidad con datos anteriores al modelo SubscriptionPeriod. */
export async function getClientProgramWeek(clientId: string, now = new Date()): Promise<number | null> {
  const period = await prisma.subscriptionPeriod.findFirst({
    where: { clientId },
    orderBy: { startDate: "asc" },
    select: { startDate: true },
  });
  const anchor = period?.startDate ?? (await legacySaleAnchor(clientId));
  if (!anchor) return null;
  const diffMs = now.getTime() - anchor.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / MS_PER_WEEK);
}

async function legacySaleAnchor(clientId: string): Promise<Date | null> {
  const sale = await prisma.sale.findFirst({
    where: { clientId },
    orderBy: { startDate: "asc" },
    select: { startDate: true },
  });
  return sale?.startDate ?? null;
}

/**
 * Devuelve el próximo formulario de satisfacción pendiente para el cliente:
 * activo, cuyo `weekOffset` ya se ha alcanzado y no lo ha respondido todavía.
 * Si hay varios que cumplen, devuelve el de mayor `weekOffset` (el más
 * reciente en la línea temporal del programa).
 */
export async function getDueSatisfactionForm(clientId: string) {
  const week = await getClientProgramWeek(clientId);
  if (week === null) return null;
  const answered = await prisma.satisfactionResponse.findMany({
    where: { clientId },
    select: { formId: true },
  });
  const answeredIds = new Set(answered.map((r) => r.formId));
  const forms = await prisma.satisfactionForm.findMany({
    where: { active: true, weekOffset: { lte: week } },
    orderBy: { weekOffset: "desc" },
  });
  return forms.find((f) => !answeredIds.has(f.id)) ?? null;
}
