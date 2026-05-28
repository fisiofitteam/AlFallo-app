import type { Option } from "@/lib/clients";

export const CRM_ACCESS_ROLES = ["ceo", "head_coach", "setter", "closer"];

// Estados del lead (embudo).
export const LEAD_STATUSES = [
  { value: "nuevo", label: "Nuevo", tone: "blue" },
  { value: "cualificado", label: "Cualificado", tone: "violet" },
  { value: "agendado", label: "Agendado", tone: "amber" },
  { value: "seguimiento", label: "Seguimiento", tone: "amber" },
  { value: "cliente", label: "Cliente", tone: "green" },
  { value: "perdido", label: "Perdido", tone: "red" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export const LEAD_STATUS_OPTIONS: Option[] = LEAD_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

export function leadStatusLabel(s: string): string {
  return LEAD_STATUSES.find((x) => x.value === s)?.label ?? s;
}

export function leadStatusBadgeClass(s: string): string {
  const tone = LEAD_STATUSES.find((x) => x.value === s)?.tone ?? "zinc";
  const map: Record<string, string> = {
    blue: "bg-[#e0edfd] text-[#1d4ed8]",
    violet: "bg-[#ede9fe] text-[#6d28d9]",
    amber: "bg-[#fdecd9] text-[#b45309]",
    green: "bg-[#e7f6ec] text-[#15803d]",
    red: "bg-red-100 text-red-700",
    zinc: "bg-zinc-100 text-zinc-600",
  };
  return map[tone] ?? map.zinc;
}

export const LEAD_SOURCE_OPTIONS: Option[] = [
  { value: "landing", label: "Landing pública" },
  { value: "ads", label: "ADS (Meta)" },
  { value: "manual", label: "Alta manual" },
  { value: "referral", label: "Recomendación" },
  { value: "otros", label: "Otros" },
];

export function sourceLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return LEAD_SOURCE_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

// Resultados posibles de una llamada agendada.
export const CALL_RESULTS = [
  { value: "pendiente", label: "Pendiente", tone: "zinc" },
  { value: "vendida", label: "Vendida", tone: "green" },
  { value: "follow_up", label: "Follow-up", tone: "amber" },
  { value: "perdida", label: "Perdida", tone: "red" },
  { value: "cancelada", label: "Cancelada", tone: "zinc" },
  { value: "no_acude", label: "No acude", tone: "red" },
] as const;

export const CALL_RESULT_OPTIONS: Option[] = CALL_RESULTS.filter((r) => r.value !== "pendiente").map(
  (r) => ({ value: r.value, label: r.label }),
);

export function callResultLabel(r: string): string {
  return CALL_RESULTS.find((x) => x.value === r)?.label ?? r;
}

export function callResultBadgeClass(r: string): string {
  const tone = CALL_RESULTS.find((x) => x.value === r)?.tone ?? "zinc";
  const map: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-600",
    green: "bg-[#e7f6ec] text-[#15803d]",
    amber: "bg-[#fdecd9] text-[#b45309]",
    red: "bg-red-100 text-red-700",
  };
  return map[tone] ?? map.zinc;
}

// Sugerencias de fecha rápida de follow-up.
export const FOLLOW_UP_PRESETS = [
  { value: "24h", label: "+24h" },
  { value: "48h", label: "+48h" },
  { value: "7d", label: "+7d" },
  { value: "30d", label: "+30d" },
  { value: "90d", label: "+90d" },
];

export function addOffset(date: Date, preset: string): Date {
  const d = new Date(date);
  const n = parseInt(preset);
  if (preset.endsWith("h")) d.setHours(d.getHours() + n);
  else if (preset.endsWith("d")) d.setDate(d.getDate() + n);
  return d;
}
