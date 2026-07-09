import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CHECKIN_FORM,
  sanitizeCheckInFormConfig,
  type CheckInFormConfigShape,
} from "@/lib/checkinForm";

const SINGLETON_ID = "default";

export async function getCheckInFormConfig(): Promise<CheckInFormConfigShape> {
  const row = await prisma.checkInFormConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    const created = await prisma.checkInFormConfig.create({
      data: {
        id: SINGLETON_ID,
        sections: DEFAULT_CHECKIN_FORM.sections as unknown as Prisma.InputJsonValue,
      },
    });
    return sanitizeCheckInFormConfig({ sections: created.sections });
  }
  return sanitizeCheckInFormConfig({ sections: row.sections });
}

export async function saveCheckInFormConfig(next: CheckInFormConfigShape): Promise<void> {
  const safe = sanitizeCheckInFormConfig(next);
  await prisma.checkInFormConfig.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      sections: safe.sections as unknown as Prisma.InputJsonValue,
    },
    update: { sections: safe.sections as unknown as Prisma.InputJsonValue },
  });
}

export async function resetCheckInFormConfig(): Promise<void> {
  await saveCheckInFormConfig(DEFAULT_CHECKIN_FORM);
}
