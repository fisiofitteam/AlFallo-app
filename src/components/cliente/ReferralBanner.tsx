"use client";

import { useState } from "react";
import { Gift, Copy, Check } from "lucide-react";

function buildMessage(firstName: string): string {
  const name = firstName ? firstName.trim() : "";
  const opening = name ? `¡Hola! Soy ${name}. ` : "¡Hola! ";
  return (
    `${opening}Estoy trabajando con Al Fallo Performance en mi nutrición ` +
    `y me está ayudando un montón. Si entras por mi recomendación te ` +
    `descuentan 100 € en tu primera factura. Dime y te paso info.`
  );
}

export function ReferralBanner({ firstName }: { firstName: string }) {
  const [copied, setCopied] = useState(false);
  const message = buildMessage(firstName);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  }

  return (
    <section className="relative mt-8 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-100/60 to-orange-100/40 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
          <Gift size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">
            Recomienda Al Fallo Performance y ahorra 100 € en tu próxima factura
          </p>
          <p className="mt-1 text-xs leading-snug text-amber-900/80">
            Si algún amig@ empieza a trabajar con nosotros por tu recomendación,
            <strong> le descontamos 100 € directamente</strong> de tu próxima
            renovación. Sencillo: cuando entre, nos dice que va de tu parte.
          </p>

          <div className="mt-4">
            <button
              type="button"
              onClick={copyMessage}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white/70 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-white"
            >
              {copied ? (
                <>
                  <Check size={14} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={14} /> Copiar mensaje para compartir
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
