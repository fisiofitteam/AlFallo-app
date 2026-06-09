// Constantes y helpers del dominio "Cliente" (atleta).

export type Option = { value: string; label: string };

export const CLIENT_STATUSES = [
  { value: "pendiente_revision", label: "Pendiente de revisión", tone: "amber" },
  { value: "onboarding", label: "Onboarding", tone: "blue" },
  { value: "activo", label: "Activo", tone: "green" },
  { value: "pausado", label: "Pausado", tone: "zinc" },
  { value: "baja", label: "Baja", tone: "red" },
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number]["value"];

export function statusLabel(status: string): string {
  return CLIENT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

// Clases Tailwind para la "pastilla" de estado.
export function statusBadgeClass(status: string): string {
  const tone = CLIENT_STATUSES.find((s) => s.value === status)?.tone ?? "zinc";
  const map: Record<string, string> = {
    amber: "bg-[#fdecd9] text-[#b45309]",
    blue: "bg-[#e0edfd] text-[#1d4ed8]",
    green: "bg-[#e7f6ec] text-[#15803d]",
    zinc: "bg-zinc-100 text-zinc-600",
    red: "bg-red-100 text-red-700",
  };
  return map[tone] ?? map.zinc;
}

export const SEX_OPTIONS: Option[] = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
  { value: "other", label: "Otro" },
];

export const LEVEL_OPTIONS: Option[] = [
  { value: "amateur", label: "Amateur" },
  { value: "scaled", label: "Scaled" },
  { value: "rx", label: "RX" },
  { value: "competicion", label: "Competición" },
];

// "Rendimiento" YA NO es un objetivo seleccionable por el cliente: va
// implícito en todos. El scope 'rendimiento' del brief IA se reutiliza
// para los PLANES DE COMPETICIÓN puntuales (ver NutritionPlan.kind).
export const GOAL_OPTIONS: Option[] = [
  { value: "perdida_grasa", label: "Pérdida de grasa" },
  { value: "recomposicion", label: "Recomposición" },
  { value: "ganancia_masa", label: "Ganancia de masa" },
  { value: "definicion", label: "Definición pre-competición" },
];

export const DIETARY_STYLE_OPTIONS: Option[] = [
  { value: "omnivoro", label: "Omnívoro" },
  { value: "vegetariano", label: "Vegetariano" },
  { value: "vegano", label: "Vegano" },
  { value: "flexitariano", label: "Flexitariano" },
  { value: "otro", label: "Otro" },
];

export function optionLabel(options: Option[], value?: string | null): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

// Roles del equipo que pueden trabajar con clientes.
export const CLIENT_ACCESS_ROLES = ["ceo", "head_coach", "nutricionista"];

// Filtro Prisma según el rol: managers ven todos; nutricionista solo los suyos.
export function clientScopeWhere(prof: { id: string; role: string }) {
  if (prof.role === "ceo" || prof.role === "head_coach") return {};
  if (prof.role === "nutricionista") return { nutritionistId: prof.id };
  // Otros roles no acceden a clientes.
  return { id: "__none__" };
}

export function isManagerRole(role: string): boolean {
  return role === "ceo" || role === "head_coach";
}

// Utilidades de parseo de formularios.
export function parseList(value: FormDataEntryValue | null): string[] {
  if (!value) return [];
  return String(value)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseIntOrNull(value: FormDataEntryValue | null): number | null {
  const n = parseNumber(value);
  return n == null ? null : Math.round(n);
}

export function parseStr(value: FormDataEntryValue | null): string | null {
  const s = value == null ? "" : String(value).trim();
  return s === "" ? null : s;
}
