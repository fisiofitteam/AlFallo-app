import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { CLIENT_SESSION_COOKIE } from "@/lib/client-auth";

export type ActiveClient = {
  id: string;
  fullName: string;
  email: string | null;
  onboardingComplete: boolean;
};

function isOnboardingComplete(c: { anamnesisCompletedAt: Date | null; contractSignedAt: Date | null }) {
  return Boolean(c.anamnesisCompletedAt && c.contractSignedAt);
}

// Resuelve cookie -> sesión válida -> Cliente. Devuelve null si no hay sesión.
export const getActiveClient = cache(async (): Promise<ActiveClient | null> => {
  const token = cookies().get(CLIENT_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.clientSession.findUnique({
    where: { token },
    include: { client: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const c = session.client;
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    onboardingComplete: isOnboardingComplete(c),
  };
});

// Exige sesión de cliente; si no, al login del atleta.
export async function requireClient(): Promise<ActiveClient> {
  const client = await getActiveClient();
  if (!client) redirect("/cliente/login");
  return client;
}

// Para la app gated: exige sesión Y onboarding completo.
export async function requireOnboardedClient(): Promise<ActiveClient> {
  const client = await requireClient();
  if (!client.onboardingComplete) redirect("/cliente/onboarding");
  return client;
}
