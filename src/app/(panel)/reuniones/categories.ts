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
