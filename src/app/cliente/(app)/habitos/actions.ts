"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedClient } from "@/lib/client-session";
import { toggleHabitToday } from "@/lib/habits";

export async function toggleTodayHabit(habitId: string) {
  const me = await requireOnboardedClient();
  const result = await toggleHabitToday(me.id, habitId);
  revalidatePath("/cliente");
  revalidatePath("/cliente/habitos");
  return result;
}
