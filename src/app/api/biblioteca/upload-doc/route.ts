import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getActiveProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subida directa de archivos de referencia (PDF/Excel/CSV) para los briefs IA
// de la biblioteca. Solo managers. Si no hay BLOB_READ_WRITE_TOKEN devolvemos
// 503 con un mensaje claro. Loguamos a Vercel para poder diagnosticar.
export async function POST(req: Request) {
  console.log("[upload-doc] hit");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[upload-doc] missing BLOB_READ_WRITE_TOKEN");
    return NextResponse.json(
      { error: "Vercel Blob no está activado. Conéctalo en Vercel → Storage." },
      { status: 503 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch (e) {
    console.error("[upload-doc] bad json body", e);
    return NextResponse.json({ error: "Cuerpo de petición inválido." }, { status: 400 });
  }
  console.log("[upload-doc] body.type =", (body as { type?: string }).type);

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        console.log("[upload-doc] onBeforeGenerateToken pathname=", pathname);
        const prof = await getActiveProfessional();
        if (!prof) {
          console.warn("[upload-doc] no professional in session");
          throw new Error("No hay sesión activa. Vuelve a iniciar sesión.");
        }
        if (!CLIENT_ACCESS_ROLES.includes(prof.role)) {
          console.warn("[upload-doc] role without library access", prof.role);
          throw new Error("Solo el equipo de nutrición puede subir archivos.");
        }
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
            "application/vnd.ms-excel", // xls
            "application/octet-stream", // fallback cuando el browser no detecta MIME
            "text/csv",
            "text/plain", // por si suben CSV con mime mal detectado
            "application/csv",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ professionalId: prof.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("[upload-doc] uploadCompleted url=", blob.url, "by=", tokenPayload);
      },
    });
    return NextResponse.json(json);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo subir el archivo";
    console.error("[upload-doc] error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
