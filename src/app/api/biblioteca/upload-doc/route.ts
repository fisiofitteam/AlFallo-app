import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getActiveProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subida directa de archivos de referencia (PDF/Excel/CSV) para los briefs IA
// de la biblioteca. Solo managers. Si no hay BLOB_READ_WRITE_TOKEN devolvemos
// 503 con un mensaje claro.
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob no está activado. Conéctalo en Vercel → Storage." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const prof = await getActiveProfessional();
        if (!prof || !isManager(prof.role)) {
          throw new Error("Solo CEO y Head Coach pueden subir archivos de brief.");
        }
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
            "application/vnd.ms-excel", // xls
            "text/csv",
            "text/plain", // por si suben CSV con mime mal detectado
            "application/csv",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op: la URL ya se devuelve al cliente.
      },
    });
    return NextResponse.json(json);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo subir el archivo";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
