"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import {
  type TemplateStructure,
  type TemplateDay,
  type TemplateMeal,
  type TemplateOption,
  isTemplateStructure,
} from "@/lib/competitionTemplates";

// Solo CEO y Head Coach gestionan plantillas (mismo criterio que el brief
// de la IA: son piezas estratégicas, no operativas).
async function requireManager() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/");
  return prof;
}

function parseStr(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Crea una plantilla vacía y redirige al editor para empezar a rellenarla. */
export async function createCompetitionTemplate() {
  const prof = await requireManager();
  const row = await prisma.competitionPlanTemplate.create({
    data: {
      name: "Plantilla sin nombre",
      structure: { days: [] } as unknown as Prisma.InputJsonValue,
      createdById: prof.id,
    },
  });
  redirect(`/biblioteca/competicion/${row.id}`);
}

/** Borra una plantilla. El nutri tendrá que confirmar en cliente. */
export async function deleteCompetitionTemplate(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  await prisma.competitionPlanTemplate.delete({ where: { id } });
  revalidatePath("/biblioteca/competicion");
}

/** Guarda la plantilla entera (un solo submit desde el editor). El form
 *  manda la estructura serializada en un input hidden `structureJson` para
 *  no pelearnos con FormData anidados. */
export async function saveCompetitionTemplate(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const name = parseStr(formData.get("name")) ?? "Plantilla sin nombre";
  const description = parseStr(formData.get("description"));
  const notes = parseStr(formData.get("notes"));
  const supplementation = parseStr(formData.get("supplementation"));

  const raw = formData.get("structureJson");
  let structure: TemplateStructure = { days: [] };
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (isTemplateStructure(parsed)) {
        structure = sanitizeStructure(parsed);
      }
    } catch {
      // Si llega corrupto, conservamos la estructura previa antes que perderla.
      const prev = await prisma.competitionPlanTemplate.findUnique({
        where: { id },
        select: { structure: true },
      });
      if (prev && isTemplateStructure(prev.structure)) {
        structure = prev.structure;
      }
    }
  }

  await prisma.competitionPlanTemplate.update({
    where: { id },
    data: {
      name,
      description,
      notes,
      supplementation,
      structure: structure as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/biblioteca/competicion");
  revalidatePath(`/biblioteca/competicion/${id}`);
}

/** Sanea la estructura recibida: tipos correctos, sin campos extra, números
 *  finitos, strings recortados. Evita inyectar basura del cliente en BD. */
function sanitizeStructure(s: TemplateStructure): TemplateStructure {
  const days: TemplateDay[] = (s.days ?? []).map((d) => ({
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
                selected: typeof o?.selected === "boolean" ? o.selected : undefined,
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
