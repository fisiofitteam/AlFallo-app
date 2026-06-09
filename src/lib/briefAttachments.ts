import "server-only";

// Helpers para los adjuntos de los briefs IA (PDF, Excel, CSV).
// - PDF: se envía a Claude como content block `document` (base64) — Claude
//   los lee nativamente.
// - Excel (xlsx/xls): se parsea server-side con la lib `xlsx` a un texto
//   tipo CSV que inyectamos en el system prompt.
// - CSV / text: se descarga como texto plano y se inyecta tal cual.

import * as XLSX from "xlsx";

export type AttachmentKind = "pdf" | "spreadsheet" | "csv" | "text" | "unknown";

export type AttachedDoc = {
  /** "Equivalencias" | "Dietas de ejemplo" — para etiquetar en el prompt */
  label: string;
  /** Nombre del archivo original (lo metemos en el prompt como referencia) */
  name: string;
  url: string;
  kind: AttachmentKind;
};

function inferKind(name: string): AttachmentKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "spreadsheet";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".txt")) return "text";
  return "unknown";
}

export function attachmentKind(name: string | null | undefined): AttachmentKind {
  if (!name) return "unknown";
  return inferKind(name);
}

/**
 * Descarga el archivo y devuelve:
 *  - para Excel/CSV/text: { kind, text } con el contenido textual extraído
 *  - para PDF: { kind, base64 } con el binario en base64 listo para Claude
 *  - desconocido: null
 */
export async function fetchAttachmentContent(
  doc: AttachedDoc,
): Promise<
  | { kind: "spreadsheet" | "csv" | "text"; text: string }
  | { kind: "pdf"; base64: string }
  | null
> {
  const res = await fetch(doc.url);
  if (!res.ok) return null;

  if (doc.kind === "pdf") {
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { kind: "pdf", base64 };
  }

  if (doc.kind === "spreadsheet") {
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const lines: string[] = [];
    for (const sheetName of wb.SheetNames) {
      lines.push(`# Hoja: ${sheetName}`);
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { FS: ", " });
      lines.push(csv.trim());
      lines.push("");
    }
    return { kind: "spreadsheet", text: lines.join("\n").slice(0, 20000) };
  }

  if (doc.kind === "csv" || doc.kind === "text") {
    const text = await res.text();
    return { kind: doc.kind, text: text.slice(0, 20000) };
  }

  return null;
}

type BriefAttachmentsHolder = {
  equivalencesAttachments: { url: string; name: string }[];
  examplePlansAttachments: { url: string; name: string }[];
};

/** Construye la lista de adjuntos efectivos a partir de los briefs cargados.
 *  Por decisión producto, las equivalencias solo viven en el brief GLOBAL y
 *  las dietas de ejemplo solo en los briefs de OBJETIVO. Los adjuntos siguen
 *  esa misma separación. */
export function listBriefAttachments(
  global: BriefAttachmentsHolder,
  goalSpecific: BriefAttachmentsHolder | null,
): AttachedDoc[] {
  const out: AttachedDoc[] = [];
  function add(prefix: string, list: { url: string; name: string }[]) {
    for (const f of list) {
      if (!f?.url || !f?.name) continue;
      out.push({ label: prefix, name: f.name, url: f.url, kind: attachmentKind(f.name) });
    }
  }
  add("Equivalencias (global)", global.equivalencesAttachments ?? []);
  if (goalSpecific) {
    add("Dietas de ejemplo (objetivo)", goalSpecific.examplePlansAttachments ?? []);
  }
  return out;
}
