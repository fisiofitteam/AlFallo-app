"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import {
  normalizeAgendaCopy,
  normalizeAgendaGraciasCopy,
  type AgendaLandingCopy,
  type AgendaGraciasCopy,
} from "@/lib/landing-content";

// Acceso para todo el equipo de nutrición (ceo, head_coach, nutricionista).
// Conservamos el nombre del helper por compat.
async function requireCeoOrHeadCoach() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");
  return prof;
}

function s(v: FormDataEntryValue | null): string {
  return v == null ? "" : String(v);
}

// Convierte un textarea con líneas a array (descarta líneas en blanco).
function lines(v: FormDataEntryValue | null): string[] {
  return s(v)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function saveAgendaLandingCopy(formData: FormData) {
  await requireCeoOrHeadCoach();

  const stats = [0, 1, 2].map((i) => ({
    value: s(formData.get(`stats_${i}_value`)),
    label: s(formData.get(`stats_${i}_label`)),
  }));

  const blocks = [0, 1, 2].map((i) => ({
    id: `b_${i}`,
    title: s(formData.get(`block_${i}_title`)),
    text: s(formData.get(`block_${i}_text`)),
    imageUrl: s(formData.get(`block_${i}_imageUrl`)),
  }));

  const data: AgendaLandingCopy = normalizeAgendaCopy({
    heroTitle1: s(formData.get("heroTitle1")),
    heroTitle2: s(formData.get("heroTitle2")),
    heroSubtitle: s(formData.get("heroSubtitle")),
    authorityTitle: s(formData.get("authorityTitle")),
    authorityText: s(formData.get("authorityText")),
    groupImageUrl: s(formData.get("groupImageUrl")),
    stats,
    blocks,
  });

  await prisma.landingConfig.upsert({
    where: { id: "agenda" },
    create: { id: "agenda", content: JSON.stringify(data) },
    update: { content: JSON.stringify(data) },
  });

  revalidatePath("/agenda");
  revalidatePath("/biblioteca/landings");
}

export async function saveAgendaGraciasCopy(formData: FormData) {
  await requireCeoOrHeadCoach();

  const data: AgendaGraciasCopy = normalizeAgendaGraciasCopy({
    heroTitleWithName: s(formData.get("heroTitleWithName")),
    heroTitleNoName: s(formData.get("heroTitleNoName")),
    reservedWithDate: s(formData.get("reservedWithDate")),
    reservedNoDate: s(formData.get("reservedNoDate")),
    callTitle: s(formData.get("callTitle")),
    callText: s(formData.get("callText")),
    videoBadge: s(formData.get("videoBadge")),
    videoTitle: s(formData.get("videoTitle")),
    videoIntro: s(formData.get("videoIntro")),
    videoId: s(formData.get("videoId")),
    videoBullets: lines(formData.get("videoBullets")),
    prepTitle: s(formData.get("prepTitle")),
    prepText: s(formData.get("prepText")),
    stepsTitle: s(formData.get("stepsTitle")),
    steps: lines(formData.get("steps")),
    policyTitle: s(formData.get("policyTitle")),
    policyText: s(formData.get("policyText")),
    policyWarning: s(formData.get("policyWarning")),
    contactText: s(formData.get("contactText")),
    whatsappNumber: s(formData.get("whatsappNumber")),
    instagramHandle: s(formData.get("instagramHandle")),
  });

  await prisma.landingConfig.upsert({
    where: { id: "agenda_gracias" },
    create: { id: "agenda_gracias", content: JSON.stringify(data) },
    update: { content: JSON.stringify(data) },
  });

  revalidatePath("/agenda/gracias");
  revalidatePath("/biblioteca/landings");
}

// Restablece a los defaults (borra la row de BD).
export async function resetLandingCopy(formData: FormData) {
  await requireCeoOrHeadCoach();
  const id = String(formData.get("id"));
  if (id !== "agenda" && id !== "agenda_gracias") return;
  await prisma.landingConfig.deleteMany({ where: { id } });
  revalidatePath("/agenda");
  revalidatePath("/agenda/gracias");
  revalidatePath("/biblioteca/landings");
}
