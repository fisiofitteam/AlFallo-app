// Definición del formulario de onboarding del atleta como datos.
//
// Cada campo tiene un id estable. Los ids SIN prefijo "extra:" son CORE y
// mapean a columnas tipadas de NutritionProfile (peso, altura, etc.).
// Los ids con prefijo "extra:" son CUSTOM y se guardan en extraAnswers JSON.
//
// Los campos CRÍTICOS (sexo, fecha nac., peso, altura, frecuencia, objetivo)
// alimentan a Harris-Benedict y no se pueden ocultar ni hacer opcionales.

import { GOAL_OPTIONS, LEVEL_OPTIONS, DIETARY_STYLE_OPTIONS, type Option } from "@/lib/clients";

export type OnboardingFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "date"
  | "tags"
  | "checkbox";

export type OnboardingField = {
  id: string;
  label: string;
  hint?: string | null;
  type: OnboardingFieldType;
  options?: Option[];
  required?: boolean;
  hidden?: boolean;
};

export type OnboardingSection = {
  id: string;
  title: string;
  fields: OnboardingField[];
};

export type OnboardingFormConfigShape = {
  sections: OnboardingSection[];
};

// Campos críticos para Harris-Benedict. Nunca se ocultan ni dejan de ser
// obligatorios desde el editor.
export const CRITICAL_FIELD_IDS = [
  "sex",
  "birthDate",
  "weightKg",
  "heightCm",
  "weeklyFrequency",
  "goal",
] as const;

// Opciones predefinidas para los campos CORE de tipo select.
// Si en el editor se cambia el id del campo se respetan las opciones core.
export const CORE_SELECT_OPTIONS: Record<string, Option[]> = {
  sex: [
    { value: "male", label: "Masculino" },
    { value: "female", label: "Femenino" },
    { value: "other", label: "Otro / Prefiero no decirlo" },
  ],
  goal: GOAL_OPTIONS,
  level: LEVEL_OPTIONS,
  dietaryStyle: DIETARY_STYLE_OPTIONS,
};

// Default factory: lo que verá un cliente recién creado si nadie ha tocado
// el editor de biblioteca. Incluye los campos críticos para HB que faltaban
// (sexo y fecha de nacimiento).
export const DEFAULT_ONBOARDING_CONFIG: OnboardingFormConfigShape = {
  sections: [
    {
      id: "personal",
      title: "Tus datos",
      fields: [
        { id: "sex", label: "Sexo biológico", type: "select", required: true },
        { id: "birthDate", label: "Fecha de nacimiento", type: "date", required: true },
        { id: "weightKg", label: "Peso actual (kg)", type: "number", required: true },
        { id: "heightCm", label: "Altura (cm)", type: "number", required: true },
      ],
    },
    {
      id: "objetivo",
      title: "Tu objetivo",
      fields: [
        { id: "goal", label: "¿Qué quieres conseguir?", type: "select", required: true },
        { id: "targetWeightKg", label: "Peso objetivo (kg)", type: "number" },
        { id: "timeframe", label: "Plazo deseado", type: "text", hint: "Opcional" },
      ],
    },
    {
      id: "entrenamiento",
      title: "Entrenamiento",
      fields: [
        { id: "weeklyFrequency", label: "Días de entreno / semana", type: "number", required: true },
        { id: "level", label: "Nivel", type: "select" },
        { id: "boxName", label: "Box / gimnasio", type: "text" },
      ],
    },
    {
      id: "alimentacion",
      title: "Alimentación",
      fields: [
        { id: "dietaryStyle", label: "Estilo dietético", type: "select" },
        { id: "allergies", label: "Alergias", type: "tags", hint: "Separadas por comas" },
        { id: "intolerances", label: "Intolerancias", type: "tags", hint: "Separadas por comas" },
        { id: "dislikes", label: "Alimentos que no te gustan", type: "tags", hint: "Separados por comas" },
        { id: "supplements", label: "Suplementos que tomas", type: "tags", hint: "Separados por comas" },
        { id: "medication", label: "Medicación", type: "text" },
        { id: "medicalConditions", label: "Condiciones médicas a tener en cuenta", type: "textarea" },
      ],
    },
  ],
};

export function isCriticalField(id: string): boolean {
  return (CRITICAL_FIELD_IDS as readonly string[]).includes(id);
}

export function isCustomField(id: string): boolean {
  return id.startsWith("extra:");
}

// Asegura que la config nunca pierda campos críticos, aunque alguien edite la
// JSON a mano. Si falta alguno, lo añade al final de la primera sección.
export function withCriticalGuard(
  config: OnboardingFormConfigShape,
): OnboardingFormConfigShape {
  const present = new Set<string>();
  for (const s of config.sections) for (const f of s.fields) present.add(f.id);
  const missing = CRITICAL_FIELD_IDS.filter((id) => !present.has(id));
  if (missing.length === 0) {
    // También aseguramos que los críticos no estén ocultos / opcionales.
    return {
      sections: config.sections.map((s) => ({
        ...s,
        fields: s.fields.map((f) =>
          isCriticalField(f.id) ? { ...f, hidden: false, required: true } : f,
        ),
      })),
    };
  }
  const next = structuredClone(config);
  const fallback = DEFAULT_ONBOARDING_CONFIG.sections[0];
  const target = next.sections[0] ?? { ...fallback, fields: [] };
  if (!next.sections.length) next.sections.push(target);
  for (const id of missing) {
    const fromDefault = DEFAULT_ONBOARDING_CONFIG.sections
      .flatMap((s) => s.fields)
      .find((f) => f.id === id);
    if (fromDefault) target.fields.push({ ...fromDefault, hidden: false, required: true });
  }
  return next;
}
