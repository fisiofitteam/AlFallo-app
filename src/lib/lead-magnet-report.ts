/**
 * Filtros comunes de dashboard y CSV de Lead magnets.
 * Solo se ejecuta en servidor desde áreas autorizadas; no hay endpoint público
 * de envío hasta definir el primer recurso y su consentimiento.
 */
import type { Prisma } from "@prisma/client";

type Query = Record<string, string | string[] | undefined>;
export type LeadMagnetFilters = {
  from: string;
  to: string;
  status: "" | "started" | "completed";
  campaign: string;
  q: string;
  whatsapp: "" | "yes" | "no";
};

function takeFirst(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeLeadMagnetFilters(query: Query): LeadMagnetFilters {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 29);
  const fromDefault = start.toISOString().slice(0, 10);

  const from = takeFirst(query.from);
  const to = takeFirst(query.to);
  const status = takeFirst(query.status);
  const whatsapp = takeFirst(query.whatsapp);
  const safeFrom = validDate(from) ? from : fromDefault;
  const safeTo = validDate(to) ? to : todayISO;

  return {
    from: safeFrom <= safeTo ? safeFrom : fromDefault,
    to: safeFrom <= safeTo ? safeTo : todayISO,
    status: status === "started" || status === "completed" ? status : "",
    campaign: takeFirst(query.campaign).trim().slice(0, 100),
    q: takeFirst(query.q).trim().slice(0, 100),
    whatsapp: whatsapp === "yes" || whatsapp === "no" ? whatsapp : "",
  };
}

export function leadMagnetResponseWhere(leadMagnetId: string, filters: LeadMagnetFilters): Prisma.LeadMagnetResponseWhereInput {
  const endExclusive = new Date(`${filters.to}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return {
    leadMagnetId,
    createdAt: {
      gte: new Date(`${filters.from}T00:00:00.000Z`),
      lt: endExclusive,
    },
    ...(filters.status && { status: filters.status }),
    ...(filters.campaign && { campaign: { contains: filters.campaign, mode: "insensitive" as const } }),
    ...(filters.whatsapp === "yes" && { whatsappClickedAt: { not: null } }),
    ...(filters.whatsapp === "no" && { whatsappClickedAt: null }),
    ...(filters.q && {
      OR: ["fullName", "email", "phone", "instagram"].map((field) => ({
        [field]: { contains: filters.q, mode: "insensitive" as const },
      })),
    }),
  };
}

export function reportParams(filters: LeadMagnetFilters): string {
  return new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== ""),
  ).toString();
}

// CSV/Excel seguro: los datos introducidos por terceros nunca se interpretan
// como fórmulas de hoja de cálculo al abrir el fichero.
export function csvField(value: unknown): string {
  const raw = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
