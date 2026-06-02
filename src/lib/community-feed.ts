// El feed de la comunidad va SIN categorías visibles (decisión Al Fallo).
// Conservamos el campo `category` en BD (default "general") por si en el
// futuro queremos clasificar — pero ahora la UI no lo expone.
//
// Si más adelante quieres añadir categorías, descomenta entradas en
// FEED_CATEGORIES y la UI las mostrará automáticamente.

export type FeedCategory = {
  value: string;
  label: string;
  emoji: string;
};

export const FEED_CATEGORIES: FeedCategory[] = [
  { value: "general", label: "General", emoji: "💬" },
];

export const DEFAULT_FEED_CATEGORY = "general";

export function feedCategoryMeta(value: string): FeedCategory {
  return FEED_CATEGORIES.find((c) => c.value === value) ?? FEED_CATEGORIES[0];
}
