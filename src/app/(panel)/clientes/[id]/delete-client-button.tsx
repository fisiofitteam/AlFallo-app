"use client";

import { useState, useTransition } from "react";
import { deleteClient } from "../actions";

// Bloque de "eliminar cliente" con doble confirmación:
//  1. El botón "Eliminar cliente" abre un panel con un input.
//  2. El botón rojo solo se habilita cuando el usuario teclea EXACTAMENTE
//     el fullName del cliente.
//  3. Al enviar hay un confirm() nativo como última red de seguridad.
// La comprobación del nombre también se hace en el server action, así que
// esto es solo UX; no se puede saltar por manipulación del DOM.
export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const matches = typed.trim() === clientName.trim();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matches) return;
    if (
      !confirm(
        `Vas a eliminar a "${clientName}" y todos sus datos (planes, check-ins, métricas, acceso a la app...). Esta acción no se puede deshacer. ¿Continuar?`,
      )
    ) {
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      void deleteClient(formData);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Eliminar cliente
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="clientId" value={clientId} />
      <p className="text-xs text-muted">
        Escribe <span className="font-semibold text-text">{clientName}</span>{" "}
        para confirmar. Se borrarán planes, check-ins, métricas, contraseña y
        cualquier rastro del atleta en la comunidad. No se puede deshacer.
      </p>
      <input
        name="confirmName"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="Nombre completo del cliente"
        autoComplete="off"
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-red-400"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!matches || pending}
          className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Eliminando…" : "Confirmar eliminación"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          disabled={pending}
          className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
