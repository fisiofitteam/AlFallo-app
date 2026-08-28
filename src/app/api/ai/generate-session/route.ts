import { NextRequest, NextResponse } from "next/server";
import { getActiveProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { generateSession } from "@/lib/ai-generate-session";
import { isBriefKind } from "@/lib/ai-training-brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getActiveProfessional();
  if (!user || !CLIENT_ACCESS_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  if (!isBriefKind(b.kind)) {
    return NextResponse.json({ error: "kind requerido" }, { status: 400 });
  }
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "prompt requerido" }, { status: 400 });
  if (prompt.length > 4000) {
    return NextResponse.json({ error: "prompt demasiado largo (>4000)" }, { status: 400 });
  }

  const dayOfWeek =
    Number.isInteger(b.dayOfWeek) && Number(b.dayOfWeek) >= 1 && Number(b.dayOfWeek) <= 7
      ? Number(b.dayOfWeek)
      : null;
  const durationMin =
    Number.isInteger(b.durationMin) && Number(b.durationMin) >= 5 && Number(b.durationMin) <= 240
      ? Number(b.durationMin)
      : null;
  const extraContext = typeof b.extraContext === "string" ? b.extraContext.slice(0, 4000) : null;

  try {
    const result = await generateSession({
      kind: b.kind as string,
      prompt,
      dayOfWeek,
      durationMin,
      extraContext,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error generando la sesión";
    console.error("[generate-session]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
