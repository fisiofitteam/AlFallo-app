// Constantes del módulo de Contenido (planificación de Instagram).
import type { Option } from "@/lib/clients";

// Roles que gestionan contenido (coincide con la navegación).
export const CONTENT_ACCESS_ROLES = ["ceo", "head_coach"];

export const CONTENT_TYPE_OPTIONS: Option[] = [
  { value: "reel", label: "Reel" },
  { value: "carrusel", label: "Carrusel" },
  { value: "story", label: "Story" },
  { value: "post", label: "Post" },
];

// Pipeline de estados de una pieza, en orden.
export const CONTENT_STATUSES = [
  { value: "idea", label: "Idea", tone: "zinc" },
  { value: "guion", label: "Guion", tone: "blue" },
  { value: "para_grabar", label: "Para grabar", tone: "amber" },
  { value: "grabado", label: "Grabado", tone: "violet" },
  { value: "publicado", label: "Publicado", tone: "green" },
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number]["value"];

export const CONTENT_STATUS_OPTIONS: Option[] = CONTENT_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

export function contentStatusLabel(status: string): string {
  return CONTENT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function contentStatusBadgeClass(status: string): string {
  const tone = CONTENT_STATUSES.find((s) => s.value === status)?.tone ?? "zinc";
  const map: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-600",
    blue: "bg-[#e0edfd] text-[#1d4ed8]",
    amber: "bg-[#fdecd9] text-[#b45309]",
    violet: "bg-[#ede9fe] text-[#6d28d9]",
    green: "bg-[#e7f6ec] text-[#15803d]",
  };
  return map[tone] ?? map.zinc;
}
