import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gasolineResult, isGasolinaAnswers } from "@/lib/gasolina/quiz";
import { signedAttempt, validSignedAttempt } from "@/lib/gasolina/security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const errors = (message: string, status: number) => NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
const isEmail = (email: string) => email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function magnet() {
  return prisma.leadMagnet.findFirst({ where: { keyword: "GASOLINA", active: true }, select: { id: true } });
}

// Límite de cortesía por instancia. Para campañas de mucho tráfico se recomienda
// activar también rate-limiting gestionado en el perímetro (Vercel WAF).
const attempts = new Map<string, { count: number; until: number }>();
function limited(req: NextRequest): boolean {
  const address = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const now = Date.now();
  const current = attempts.get(address);
  if (!current || current.until < now) { attempts.set(address, { count: 1, until: now + 3_600_000 }); return false; }
  if (current.count >= 25) return true;
  current.count += 1;
  if (attempts.size > 2000) attempts.clear();
  return false;
}

/** Crea solo un inicio anónimo, sin datos personales. */
export async function POST(req: NextRequest) {
  if (limited(req)) return errors("Has realizado demasiados intentos. Prueba más tarde.", 429);
  const resource = await magnet();
  if (!resource) return errors("El recurso no está disponible en este momento.", 503);
  const json = await req.json().catch(() => ({}));
  const source = clean(json.source, 64).replace(/[^\w.\-]/g, "") || "direct";
  const campaign = clean(json.campaign, 100).replace(/[^\w.\-]/g, "") || null;
  try {
    const entry = await prisma.leadMagnetResponse.create({
      data: { leadMagnetId: resource.id, source, campaign, status: "started" },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: entry.id, token: signedAttempt(entry.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gasolina start error", error);
    return errors("No se pudo comenzar el test. Inténtalo de nuevo.", 500);
  }
}

/** Completa una respuesta o registra un clic CTA sobre una respuesta propia. */
export async function PATCH(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const id = clean(json.id, 40);
  if (!validSignedAttempt(id, json.token)) return errors("No se pudo verificar la sesión.", 403);
  const resource = await magnet();
  if (!resource) return errors("El recurso no está disponible.", 503);

  if (json.action === "whatsapp") {
    await prisma.leadMagnetResponse.updateMany({
      where: { id, leadMagnetId: resource.id, status: "completed", whatsappClickedAt: null },
      data: { whatsappClickedAt: new Date() },
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (json.action !== "complete") return errors("Acción desconocida.", 400);

  const fullName = clean(json.fullName, 100);
  const email = clean(json.email, 160).toLowerCase();
  const phone = clean(json.phone, 35);
  const instagram = clean(json.instagram, 65);
  const answers = json.answers;
  if (fullName.length < 2 || !isEmail(email) || !isGasolinaAnswers(answers) || json.consent !== true) {
    return errors("Revisa tus respuestas y acepta el aviso de privacidad.", 400);
  }
  const result = gasolineResult(answers);
  const completedAt = new Date();
  const resultJson = JSON.stringify({
    ...answers, focus: result.focus, guide: "gasolina-v1", consentVersion: "gasolina-2026-11-02", consentAt: completedAt.toISOString(),
  });
  try {
    const updated = await prisma.leadMagnetResponse.updateMany({
      where: { id, leadMagnetId: resource.id, status: "started" },
      data: {
        fullName, email, phone: phone || null, instagram: instagram || null,
        resultJson, status: "completed", completedAt,
      },
    });
    if (!updated.count) return errors("Esta solicitud ya se ha completado o ha caducado.", 409);
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gasolina completion error", error);
    return errors("No pudimos guardar tu resultado. Inténtalo de nuevo.", 500);
  }
}
