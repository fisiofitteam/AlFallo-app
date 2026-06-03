// Categorías de las reuniones del equipo (pestañas del feed).
// Las saco a un fichero aparte porque actions.ts es "use server" y allí solo
// se pueden exportar funciones async.

export const CATEGORIES = ["ceos", "nutris", "otras"] as const;
export type MeetingCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<MeetingCategory, string> = {
  ceos: "Reuniones CEOs",
  nutris: "Reuniones Nutricionistas",
  otras: "Otras",
};

// Roles que pueden ver/escribir cada categoría. "ceos" es privada para
// CEO + head_coach. Las otras dos las ve todo el equipo.
const CATEGORY_VIEWERS: Record<MeetingCategory, string[]> = {
  ceos: ["ceo", "head_coach"],
  nutris: ["ceo", "head_coach", "nutricionista", "setter", "closer"],
  otras: ["ceo", "head_coach", "nutricionista", "setter", "closer"],
};

export function canViewCategory(role: string, category: MeetingCategory): boolean {
  return CATEGORY_VIEWERS[category].includes(role);
}

// Categorías que un rol puede ver, en orden de tab.
export function categoriesForRole(role: string): MeetingCategory[] {
  return CATEGORIES.filter((c) => canViewCategory(role, c));
}

// Tab por defecto si el rol no especifica `?tab=`. Managers entran a CEOs;
// nutris a Nutricionistas; resto a Otras.
export function defaultCategoryFor(role: string): MeetingCategory {
  return categoriesForRole(role)[0] ?? "otras";
}
