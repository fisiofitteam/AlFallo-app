"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import {
  emptyStructure,
  isTemplateSex,
  isTemplateGoal,
  type TemplateStructure,
  type TemplateDay,
  type TemplateMeal,
  type TemplateOption,
} from "@/lib/nutritionTemplates";

// Acceso para todo el equipo (mismo criterio que el resto de la biblioteca).
async function requireAccess() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");
  return prof;
}

function parseStr(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Crea una plantilla con la estructura estándar (5 comidas vacías) y
 *  redirige al editor. Necesita sex + goal + name en el form. */
export async function createNutritionTemplate(formData: FormData): Promise<void> {
  const prof = await requireAccess();
  const sex = parseStr(formData.get("sex"));
  const goal = parseStr(formData.get("goal"));
  const name = parseStr(formData.get("name")) ?? "Plantilla sin nombre";

  // Inputs marcados como required en el HTML; si llegan vacíos algo raro
  // pasa. Tiramos error en vez de devolver objeto — la action es directa
  // del form y Next exige void.
  if (!isTemplateSex(sex) || !isTemplateGoal(goal)) {
    throw new Error("Sexo y objetivo son obligatorios.");
  }

  const row = await prisma.nutritionTemplate.create({
    data: {
      sex,
      goal,
      name,
      structure: emptyStructure() as unknown as Prisma.InputJsonValue,
      createdById: prof.id,
    },
  });
  revalidatePath("/biblioteca/plantillas");
  redirect(`/biblioteca/plantillas/${row.id}`);
}

export async function deleteNutritionTemplate(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id"));
  await prisma.nutritionTemplate.delete({ where: { id } });
  revalidatePath("/biblioteca/plantillas");
}

/** Duplica una plantilla existente. Copia todos los campos y añade "(copia)"
 *  al nombre. Redirige al editor para que se pueda renombrar y ajustar. */
export async function duplicateNutritionTemplate(formData: FormData): Promise<void> {
  const prof = await requireAccess();
  const id = String(formData.get("id"));
  const src = await prisma.nutritionTemplate.findUnique({ where: { id } });
  if (!src) throw new Error("Plantilla no encontrada.");

  const copy = await prisma.nutritionTemplate.create({
    data: {
      sex: src.sex,
      goal: src.goal,
      name: `${src.name} (copia)`.slice(0, 200),
      description: src.description,
      notes: src.notes,
      supplementation: src.supplementation,
      structure: src.structure as Prisma.InputJsonValue,
      createdById: prof.id,
    },
  });
  revalidatePath("/biblioteca/plantillas");
  redirect(`/biblioteca/plantillas/${copy.id}`);
}

/** Guarda la plantilla entera. El cliente serializa la estructura en un
 *  hidden `structureJson` y la mandamos en un solo submit. */
export async function saveNutritionTemplate(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id"));
  const sex = parseStr(formData.get("sex"));
  const goal = parseStr(formData.get("goal"));
  const name = parseStr(formData.get("name")) ?? "Plantilla sin nombre";
  const description = parseStr(formData.get("description"));
  const notes = parseStr(formData.get("notes"));
  const supplementation = parseStr(formData.get("supplementation"));

  if (!isTemplateSex(sex) || !isTemplateGoal(goal)) {
    return { error: "Sexo y objetivo no válidos." };
  }

  const raw = formData.get("structureJson");
  let structure: TemplateStructure = emptyStructure();
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      structure = sanitizeStructure(parsed as TemplateStructure);
    } catch {
      // JSON corrupto → mantenemos la estructura previa para no perder
      // todo el trabajo del nutri.
      const prev = await prisma.nutritionTemplate.findUnique({
        where: { id },
        select: { structure: true },
      });
      if (prev?.structure) structure = prev.structure as unknown as TemplateStructure;
    }
  }

  await prisma.nutritionTemplate.update({
    where: { id },
    data: {
      sex,
      goal,
      name,
      description,
      notes,
      supplementation,
      structure: structure as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/biblioteca/plantillas");
  revalidatePath(`/biblioteca/plantillas/${id}`);
}

function sanitizeStructure(s: TemplateStructure): TemplateStructure {
  const days: TemplateDay[] = (s?.days ?? []).map((d) => ({
    name: String(d?.name ?? "Día tipo").slice(0, 80),
    dayType: typeof d?.dayType === "string" && d.dayType ? d.dayType.slice(0, 30) : "entreno",
    meals: Array.isArray(d?.meals)
      ? d.meals.map<TemplateMeal>((m) => ({
          name: String(m?.name ?? "comida").slice(0, 30),
          options: Array.isArray(m?.options)
            ? m.options.map<TemplateOption>((o) => ({
                text: String(o?.text ?? "").slice(0, 400),
                kcal: clampNum(o?.kcal),
                protein: clampNum(o?.protein),
                carbs: clampNum(o?.carbs),
                fat: clampNum(o?.fat),
                subType:
                  typeof o?.subType === "string" && o.subType
                    ? o.subType.slice(0, 20)
                    : null,
              }))
            : [],
        }))
      : [],
  }));
  return { days };
}

function clampNum(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 10) / 10;
}

/** Estima macros desde texto libre. Lo llama el editor de plantilla cuando
 *  el nutri escribe el contenido de una opción y queremos los kcal/P/C/G
 *  rellenados solos. No persiste nada — el guardado es manual con el botón
 *  "Guardar plantilla" del editor. */
export async function estimateMacrosForTemplateOption(
  text: string,
): Promise<{ kcal: number; protein: number; carbs: number; fat: number }> {
  await requireAccess();
  const trimmed = text.trim();
  if (trimmed.length < 3) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const { estimateMacros } = await import("@/lib/macroEstimator");
  const m = await estimateMacros(trimmed.slice(0, 1000));
  return { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
}
