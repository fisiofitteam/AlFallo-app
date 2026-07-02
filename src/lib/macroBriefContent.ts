import "server-only";
import type { MacroBriefAttachment } from "@/lib/macroBrief";

/**
 * Descarga el contenido de un adjunto del brief de macros y lo convierte
 * a la forma adecuada para inyectarlo en el prompt de Claude:
 *   · PDF    → bloque `document` con base64 (Claude lo lee nativo).
 *   · Excel  → texto CSV por cada hoja (usa la lib `xlsx`).
 *   · CSV / texto → texto plano tal cual.
 *
 * Devuelve null si no puede descargar o convertir (el estimador seguirá
 * funcionando sin ese adjunto).
 */

export type AttachmentContent =
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string };

function extLower(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

const TEXT_EXTS = ["csv", "txt", "md", "tsv"];
const SPREADSHEET_EXTS = ["xlsx", "xls", "xlsm", "ods"];

// Límites para no inflar el prompt sin control (~2K tokens por adjunto).
const MAX_TEXT_CHARS = 8000;
const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

export async function fetchAttachmentContent(
  att: MacroBriefAttachment,
): Promise<AttachmentContent | null> {
  const ext = extLower(att.name);
  try {
    const res = await fetch(att.url, { cache: "no-store" });
    if (!res.ok) return null;

    if (ext === "pdf") {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_PDF_BYTES) return null;
      return { kind: "pdf", base64: buf.toString("base64") };
    }

    if (SPREADSHEET_EXTS.includes(ext)) {
      const buf = Buffer.from(await res.arrayBuffer());
      // Import dinámico para que xlsx no entre en el bundle si no toca.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "buffer" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet).trim();
        if (!csv) continue;
        parts.push(`--- Hoja: ${sheetName} ---\n${csv}`);
      }
      const joined = parts.join("\n\n");
      return { kind: "text", text: truncate(joined, MAX_TEXT_CHARS) };
    }

    if (TEXT_EXTS.includes(ext)) {
      const text = await res.text();
      return { kind: "text", text: truncate(text, MAX_TEXT_CHARS) };
    }

    // Extensión no reconocida — intentamos leer como texto plano.
    const text = await res.text();
    if (text && text.length > 0) return { kind: "text", text: truncate(text, MAX_TEXT_CHARS) };
    return null;
  } catch {
    return null;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncado a ${max} chars]`;
}
