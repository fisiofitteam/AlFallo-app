// Definición del CHECK-IN AVANZADO como datos. Editor en /biblioteca/checkin-avanzado.
// Cuando un atleta tiene Client.useAdvancedCheckIn=true, se le muestra este
// formulario en lugar del semanal básico. Las respuestas van a CheckIn.extraAnswers
// (JSON) para no forzar migraciones cada vez que cambie el formulario.
//
// A diferencia del onboarding, aquí NO hay campos "core" con columnas tipadas
// específicas ni campos críticos: todo lo que se guarda vive en extraAnswers.

import type { Option } from "@/lib/clients";

export type CheckInFieldType =
  | "text"
  | "textarea"
  | "number"
  | "scale5"
  | "scale10"
  | "select"
  | "checkbox";

export type CheckInField = {
  id: string;
  label: string;
  hint?: string | null;
  type: CheckInFieldType;
  unit?: string | null; // "kg", "cm", "h", …
  options?: Option[];
  required?: boolean;
  hidden?: boolean;
};

export type CheckInSection = {
  id: string;
  title: string;
  description?: string | null;
  fields: CheckInField[];
};

export type CheckInFormConfigShape = {
  sections: CheckInSection[];
};

/** Formulario por defecto: composición razonable inspirada en un check-in
 *  serio (perímetros completos, subjetivos, adherencia por área, sueño,
 *  estrés). El editor de biblioteca puede añadir, quitar o reordenar. */
export const DEFAULT_CHECKIN_FORM: CheckInFormConfigShape = {
  sections: [
    {
      id: "peso_perimetros",
      title: "Peso y perímetros",
      description: "Mide siempre en las mismas condiciones (en ayunas, sin ropa).",
      fields: [
        { id: "weightKg", label: "Peso", type: "number", unit: "kg" },
        { id: "waistCm", label: "Cintura", type: "number", unit: "cm" },
        { id: "hipCm", label: "Cadera", type: "number", unit: "cm" },
        { id: "chestCm", label: "Pecho", type: "number", unit: "cm" },
        { id: "armCm", label: "Brazo (contraído)", type: "number", unit: "cm" },
        { id: "thighCm", label: "Muslo", type: "number", unit: "cm" },
        { id: "neckCm", label: "Cuello", type: "number", unit: "cm" },
        { id: "bodyFatPct", label: "% grasa (si tienes medida)", type: "number", unit: "%" },
      ],
    },
    {
      id: "adherencia",
      title: "Adherencia",
      description: "¿Cómo te ha ido con el plan esta semana?",
      fields: [
        { id: "adherenceDiet", label: "Dieta (0-100)", type: "number", unit: "%" },
        { id: "adherenceTraining", label: "Entrenamientos (0-100)", type: "number", unit: "%" },
        { id: "adherenceSupplement", label: "Suplementación (0-100)", type: "number", unit: "%" },
        { id: "adherenceSleep", label: "Descanso (0-100)", type: "number", unit: "%" },
      ],
    },
    {
      id: "subjetivos",
      title: "Subjetivos",
      description: "Cómo te has sentido.",
      fields: [
        { id: "energy", label: "Energía general", type: "scale5" },
        { id: "hunger", label: "Hambre", type: "scale5" },
        { id: "stress", label: "Estrés", type: "scale10" },
        { id: "sleepHours", label: "Horas de sueño (media)", type: "number", unit: "h" },
        { id: "sleepQuality", label: "Calidad del sueño", type: "scale5" },
        { id: "moodNotes", label: "¿Cómo te has sentido esta semana?", type: "textarea" },
      ],
    },
    {
      id: "otros",
      title: "Otros",
      fields: [
        { id: "trainingsDone", label: "Entrenamientos hechos", type: "number" },
        { id: "stepsAvg", label: "Pasos diarios (media)", type: "number" },
        { id: "notes", label: "Comentarios para tu nutricionista", type: "textarea" },
      ],
    },
  ],
};

export function isCheckInFieldType(v: unknown): v is CheckInFieldType {
  return (
    v === "text" ||
    v === "textarea" ||
    v === "number" ||
    v === "scale5" ||
    v === "scale10" ||
    v === "select" ||
    v === "checkbox"
  );
}

/** Sanitiza una config para persistirla. Filtra secciones/campos malformados,
 *  fuerza límites de longitud y garantiza ids únicos. Nunca lanza — devuelve
 *  la config saneada. */
export function sanitizeCheckInFormConfig(
  input: unknown,
): CheckInFormConfigShape {
  const raw = input as { sections?: unknown } | null | undefined;
  const sectionsIn = Array.isArray(raw?.sections) ? raw.sections : [];
  const seenIds = new Set<string>();
  const sections: CheckInSection[] = [];
  for (const s of sectionsIn) {
    if (!s || typeof s !== "object") continue;
    const sec = s as Record<string, unknown>;
    const id = String(sec.id ?? "").trim().slice(0, 40) || `sec_${sections.length + 1}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const title = String(sec.title ?? "").trim().slice(0, 80) || "Sección";
    const description =
      typeof sec.description === "string" ? sec.description.trim().slice(0, 300) : null;
    const fieldsIn = Array.isArray(sec.fields) ? sec.fields : [];
    const fieldIds = new Set<string>();
    const fields: CheckInField[] = [];
    for (const f of fieldsIn) {
      if (!f || typeof f !== "object") continue;
      const fr = f as Record<string, unknown>;
      const fid = String(fr.id ?? "").trim().slice(0, 40);
      if (!fid || fieldIds.has(fid)) continue;
      fieldIds.add(fid);
      const type = isCheckInFieldType(fr.type) ? fr.type : "text";
      const label = String(fr.label ?? "").trim().slice(0, 120) || fid;
      const hint = typeof fr.hint === "string" ? fr.hint.trim().slice(0, 200) : null;
      const unit = typeof fr.unit === "string" ? fr.unit.trim().slice(0, 12) || null : null;
      const required = fr.required === true;
      const hidden = fr.hidden === true;
      const options = Array.isArray(fr.options)
        ? fr.options
            .map((o) => {
              if (!o || typeof o !== "object") return null;
              const or = o as Record<string, unknown>;
              const value = String(or.value ?? "").trim().slice(0, 40);
              const label = String(or.label ?? value).trim().slice(0, 80);
              if (!value) return null;
              return { value, label };
            })
            .filter((x): x is Option => x !== null)
        : undefined;
      fields.push({ id: fid, label, hint, type, unit, required, hidden, options });
    }
    sections.push({ id, title, description, fields });
  }
  return { sections };
}
