import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCommunityActor } from "@/lib/community-actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subida directa cliente → Vercel Blob (evita el límite de tamaño de las
// funciones serverless, ideal para vídeos cortos).
// Si BLOB_READ_WRITE_TOKEN no está configurado, devuelve 503 con mensaje claro.
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "El almacenamiento no está activado todavía. Activa Vercel Blob en Vercel → Storage." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const actor = await getCommunityActor();
        if (!actor) throw new Error("No autorizado");
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/heic",
            "video/mp4",
            "video/quicktime",
            "video/webm",
          ],
          maximumSizeInBytes: 80 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op: la URL se devuelve al cliente directamente.
      },
    });
    return NextResponse.json(json);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo subir el archivo";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
