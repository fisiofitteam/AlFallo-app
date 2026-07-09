import "server-only";
import { prisma } from "@/lib/prisma";

// Tipos de métrica. Alineados con el editor del catálogo y con el renderer
// del formulario de check-in (CheckInWeekly + variantes futuras).
export const METRIC_TYPES = [
  { value: "number", label: "Número" },
  { value: "scale5", label: "Escala 1-5" },
  { value: "scale10", label: "Escala 1-10" },
  { value: "text", label: "Texto corto" },
  { value: "textarea", label: "Texto largo" },
  { value: "select", label: "Selector" },
  { value: "checkbox", label: "Sí/No" },
] as const;
export type MetricType = (typeof METRIC_TYPES)[number]["value"];
export function isMetricType(v: unknown): v is MetricType {
  return typeof v === "string" && METRIC_TYPES.some((t) => t.value === v);
}

export const METRIC_CATEGORIES = [
  { value: "peso_perimetros", label: "Peso y perímetros" },
  { value: "adherencia", label: "Adherencia" },
  { value: "subjetivos", label: "Subjetivos" },
  { value: "otros", label: "Otros" },
] as const;
export type MetricCategory = (typeof METRIC_CATEGORIES)[number]["value"];

export const METRIC_FREQUENCIES = [
  { value: "weekly", label: "Cada semana" },
  { value: "biweekly", label: "Cada 2 semanas" },
  { value: "monthly", label: "Cada mes" },
  { value: "any", label: "Cuando quieras" },
] as const;
export type MetricFrequency = (typeof METRIC_FREQUENCIES)[number]["value"];

// Columnas fijas de CheckIn que pueden mapearse desde una métrica del catálogo.
// Esto preserva Evolución (que lee weightKg, waistCm...) y todo el histórico.
export const CORE_FIELDS = [
  { value: "weightKg", label: "Peso (columna weightKg)" },
  { value: "waistCm", label: "Cintura (columna waistCm)" },
  { value: "hipCm", label: "Cadera (columna hipCm)" },
  { value: "armCm", label: "Brazo (columna armCm)" },
  { value: "bodyFatPct", label: "% grasa (columna bodyFatPct)" },
  { value: "adherencePct", label: "Adherencia (columna adherencePct)" },
  { value: "energy", label: "Energía (columna energy)" },
  { value: "notes", label: "Notas (columna notes)" },
] as const;
export type CoreField = (typeof CORE_FIELDS)[number]["value"];
export function isCoreField(v: unknown): v is CoreField {
  return typeof v === "string" && CORE_FIELDS.some((f) => f.value === v);
}
export function categoryLabel(v: string): string {
  return METRIC_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}
export function frequencyLabel(v: string): string {
  return METRIC_FREQUENCIES.find((f) => f.value === v)?.label ?? v;
}

/** Métricas seed. Cubren los 8 campos fijos actuales del check-in básico +
 *  campos típicos de un check-in avanzado (perímetros extra, sueño, estrés). */
type SeedMetric = {
  name: string;
  description?: string;
  type: MetricType;
  unit?: string | null;
  coreField?: CoreField | null;
  category: MetricCategory;
  inBasic: boolean;
  inAdvanced: boolean;
  frequency: MetricFrequency;
};

const SEED_METRICS: SeedMetric[] = [
  // Core (mapean a columnas). Aparecen en ambos.
  { name: "Peso", type: "number", unit: "kg", coreField: "weightKg", category: "peso_perimetros", inBasic: true, inAdvanced: true, frequency: "weekly" },
  { name: "Cintura", type: "number", unit: "cm", coreField: "waistCm", category: "peso_perimetros", inBasic: true, inAdvanced: true, frequency: "weekly" },
  { name: "Cadera", type: "number", unit: "cm", coreField: "hipCm", category: "peso_perimetros", inBasic: true, inAdvanced: true, frequency: "biweekly" },
  { name: "Brazo (contraído)", type: "number", unit: "cm", coreField: "armCm", category: "peso_perimetros", inBasic: true, inAdvanced: true, frequency: "biweekly" },
  { name: "% grasa", description: "Si tienes medida.", type: "number", unit: "%", coreField: "bodyFatPct", category: "peso_perimetros", inBasic: true, inAdvanced: true, frequency: "biweekly" },
  { name: "Adherencia general", description: "De 0 a 100 según lo bien que has seguido el plan.", type: "number", unit: "%", coreField: "adherencePct", category: "adherencia", inBasic: true, inAdvanced: true, frequency: "weekly" },
  { name: "Energía", type: "scale5", coreField: "energy", category: "subjetivos", inBasic: true, inAdvanced: true, frequency: "weekly" },
  { name: "Notas para tu nutri", type: "textarea", coreField: "notes", category: "otros", inBasic: true, inAdvanced: true, frequency: "weekly" },
  // Solo avanzado (custom, van a extraAnswers).
  { name: "Pecho", type: "number", unit: "cm", category: "peso_perimetros", inBasic: false, inAdvanced: true, frequency: "biweekly" },
  { name: "Muslo", type: "number", unit: "cm", category: "peso_perimetros", inBasic: false, inAdvanced: true, frequency: "biweekly" },
  { name: "Cuello", type: "number", unit: "cm", category: "peso_perimetros", inBasic: false, inAdvanced: true, frequency: "monthly" },
  { name: "Sueño (horas media)", type: "number", unit: "h", category: "subjetivos", inBasic: false, inAdvanced: true, frequency: "weekly" },
  { name: "Calidad del sueño", type: "scale5", category: "subjetivos", inBasic: false, inAdvanced: true, frequency: "weekly" },
  { name: "Estrés", type: "scale10", category: "subjetivos", inBasic: false, inAdvanced: true, frequency: "weekly" },
  { name: "Hambre", type: "scale5", category: "subjetivos", inBasic: false, inAdvanced: true, frequency: "weekly" },
  { name: "Entrenamientos hechos", type: "number", category: "adherencia", inBasic: false, inAdvanced: true, frequency: "weekly" },
  { name: "Pasos diarios (media)", type: "number", category: "adherencia", inBasic: false, inAdvanced: true, frequency: "weekly" },
];

/** Devuelve todas las métricas ordenadas. Semilla al primer arranque. */
export async function listMetricDefinitions(opts?: { includeInactive?: boolean }) {
  const count = await prisma.metricDefinition.count();
  if (count === 0) {
    await prisma.metricDefinition.createMany({
      data: SEED_METRICS.map((m, i) => ({
        name: m.name,
        description: m.description ?? null,
        type: m.type,
        unit: m.unit ?? null,
        coreField: m.coreField ?? null,
        category: m.category,
        inBasic: m.inBasic,
        inAdvanced: m.inAdvanced,
        frequency: m.frequency,
        order: i,
        active: true,
      })),
    });
  }
  return prisma.metricDefinition.findMany({
    where: opts?.includeInactive ? undefined : { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

/** Devuelve solo las métricas que aplican al modo de check-in del cliente
 *  (básico o avanzado). Se usa desde /cliente/checkin. */
export async function listMetricsForClient(useAdvanced: boolean) {
  const all = await listMetricDefinitions();
  return all.filter((m) => (useAdvanced ? m.inAdvanced : m.inBasic));
}
