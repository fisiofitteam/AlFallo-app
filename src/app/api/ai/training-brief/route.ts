import { NextRequest, NextResponse } from "next/server";
import { getActiveProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import {
  clearAiTrainingBrief,
  getAiTrainingBrief,
  isBriefKind,
  updateAiTrainingBrief,
  type AiTrainingBriefData,
} from "@/lib/ai-training-brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requirePro() {
  const user = await getActiveProfessional();
  if (!user || !CLIENT_ACCESS_ROLES.includes(user.role)) return null;
  return user;
}

function kindFrom(req: NextRequest): string | null {
  const kind = req.nextUrl.searchParams.get("kind");
  return isBriefKind(kind) ? (kind as string) : null;
}

const FIELDS: (keyof AiTrainingBriefData)[] = [
  "systemPrompt",
  "philosophy",
  "voiceTone",
  "structureHints",
  "formats",
  "intensityRules",
  "vocabulary",
  "dos",
  "donts",
  "goodExamples",
  "badExamples",
];

export async function GET(req: NextRequest) {
  const user = await requirePro();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const kind = kindFrom(req);
  if (!kind) return NextResponse.json({ error: "kind requerido" }, { status: 400 });
  const brief = await getAiTrainingBrief(kind);
  return NextResponse.json({ ok: true, brief });
}

export async function PATCH(req: NextRequest) {
  const user = await requirePro();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const kind = kindFrom(req);
  if (!kind) return NextResponse.json({ error: "kind requerido" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "clear-all-fields") {
    await clearAiTrainingBrief(kind, user.id === "dev" ? null : user.id);
    const brief = await getAiTrainingBrief(kind);
    return NextResponse.json({ ok: true, brief });
  }

  const patch: Partial<AiTrainingBriefData> = {};
  for (const f of FIELDS) {
    if (typeof body[f] === "string") patch[f] = String(body[f]);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }
  const brief = await updateAiTrainingBrief(
    kind,
    patch,
    user.id === "dev" ? null : user.id,
  );
  return NextResponse.json({ ok: true, brief });
}
