"use client";

import { Printer } from "lucide-react";

export function DossierPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 print:hidden"
      title="Imprimir o exportar a PDF"
    >
      <Printer size={14} /> Imprimir
    </button>
  );
}
