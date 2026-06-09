// Tipos y constantes del Brief IA. Lo separamos de aiBrief.ts (que es
// "server-only") para que los componentes cliente puedan importar las
// constantes sin tirar del cliente Prisma.

export const BRIEF_SCOPES = [
  "global",
  "perdida_grasa",
  "recomposicion",
  "ganancia_masa",
  "rendimiento",
] as const;

export type BriefScope = (typeof BRIEF_SCOPES)[number];

export const BRIEF_SCOPE_LABELS: Record<BriefScope, string> = {
  global: "Global (siempre se aplica)",
  perdida_grasa: "Pérdida de grasa",
  recomposicion: "Recomposición",
  ganancia_masa: "Ganancia de masa",
  // El scope 'rendimiento' YA NO es un objetivo del cliente: se reutiliza
  // como brief para los planes de competición puntuales (carga de hidratos,
  // race-day, etc.). El nutri lo aplica al generar plan tipo competición.
  rendimiento: "Plan de competición",
};

export type BriefAttachment = { url: string; name: string };

export type BriefShape = {
  scope: BriefScope;
  philosophy: string;
  preferredFoods: string;
  avoidFoods: string;
  equivalences: string;
  additionalRules: string;
  examplePlans: string;
  /** Lista de adjuntos PDF/Excel/CSV con la tabla de equivalencias. */
  equivalencesAttachments: BriefAttachment[];
  /** Lista de adjuntos PDF/Excel/CSV con dietas de ejemplo. */
  examplePlansAttachments: BriefAttachment[];
};
