"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import {
  getCheckInFormConfig,
  resetCheckInFormConfig,
  saveCheckInFormConfig,
} from "@/lib/checkinFormConfig";
import type { CheckInFormConfigShape } from "@/lib/checkinForm";

async function requireManager() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");
  return prof;
}

export async function saveCheckInFormAction(payload: CheckInFormConfigShape) {
  await requireManager();
  await saveCheckInFormConfig(payload);
  revalidatePath("/biblioteca/checkin-avanzado");
  revalidatePath("/cliente/checkin");
}

export async function resetCheckInFormAction() {
  await requireManager();
  await resetCheckInFormConfig();
  revalidatePath("/biblioteca/checkin-avanzado");
  revalidatePath("/cliente/checkin");
}

export async function getCurrentCheckInForm(): Promise<CheckInFormConfigShape> {
  await requireManager();
  return getCheckInFormConfig();
}
