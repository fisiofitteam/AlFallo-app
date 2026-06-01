"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Lead = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
};

/**
 * Modal de cierre de venta (versión manual, sin Stripe todavía).
 *
 * El closer marca la venta como hecha (porque ya ha cobrado por su sistema
 * habitual) y la app:
 *  - crea el Cliente (con email para que pueda entrar a su app),
 *  - registra la Venta,
 *  - suma el ingreso al Cuadro de mandos,
 *  - marca el lead como "won".
 *
 * Cuando integremos Stripe, este modal generará en su lugar un link de pago
 * y la conversión la hará el webhook al confirmar el pago.
 */
export function PaymentLinkModal({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;
    setError("");
    if (!email.trim()) {
      setError("El email del cliente es obligatorio.");
      return;
    }
    const amountNum = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Indica un importe válido.");
      return;
    }
    const monthsNum = parseInt(months, 10) || 4;
    setBusy(true);
    try {
      const res = await fetch("/api/leads/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          email: email.trim(),
          phone: phone.trim(),
          amountPaid: amountNum,
          subscriptionPeriodMonths: monthsNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo registrar la venta.");
        setBusy(false);
        return;
      }
      onClose();
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Error de red.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 text-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Cerrar venta · {lead.fullName}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Cuando el cliente haya pagado (manualmente por tu sistema actual), confirma aquí. Se creará
          su ficha de cliente y se sumará como ingreso en el cuadro de mandos.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600">Email del cliente *</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              placeholder="cliente@ejemplo.com"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600">Teléfono</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-zinc-600">Importe cobrado (€)</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-zinc-600">Meses del plan</span>
              <input
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              />
            </label>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {busy ? "Creando…" : "Confirmar y crear cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}
