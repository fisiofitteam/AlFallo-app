import { NextRequest, NextResponse } from "next/server";
import { getActiveProfessional } from "@/lib/session";
import { estimateMacros } from "@/lib/macroEstimator";

// POST { text } → { kcal, protein, carbs, fat, source: "ai" | "fallback" }
// Solo profesionales (cualquier rol del equipo). No exponemos al cliente.
export async function POST(req: NextRequest) {
  const user = await getActiveProfessional();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let text: string;
  try {
    const body = (await req.json()) as { text?: string };
    text = String(body.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Texto vacío" }, { status: 400 });

  const result = await estimateMacros(text);
  return NextResponse.json(result);
}
