"use client";

import { useState, useTransition } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import { deleteClient } from "@/app/(panel)/clientes/actions";

/**
 * Crucecita pequeña arriba a la derecha de la card del cliente. Al pulsarla
 * se abre un modal con la confirmación "escribe el nombre completo" para
 * evitar borrados accidentales (misma protección que la pantalla de ficha).
 * El server action vuelve a validar manager + nombre, así que esto es solo UX.
 */
export function DeleteClientIconButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  const matches = typed.trim() === clientName.trim();

  function handleDelete() {
    if (!matches || pending) return;
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("confirmName", typed);
    start(() => {
      void deleteClient(fd);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Eliminar ${clientName}`}
        title="Eliminar cliente"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
          setTyped("");
        }}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted opacity-50 transition hover:bg-red-50 hover:text-red-600 hover:opacity-100"
      >
        <X size={14} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={18} />
              </span>
              <h3 className="text-base font-bold">Eliminar cliente</h3>
            </div>
            <p className="mb-3 text-sm text-muted">
              Vas a eliminar a <span className="font-semibold text-text">{clientName}</span>{" "}
              y todos sus datos: planes, check-ins, métricas, acceso a la app,
              comentarios en la comunidad, periodos de programa, hábitos,
              formularios respondidos, planes de competición. <strong>No se puede deshacer.</strong>
            </p>
            <label className="mb-1 block text-xs font-semibold text-muted">
              Escribe el nombre completo para confirmar
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={clientName}
              autoComplete="off"
              autoFocus
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-red-400"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!matches || pending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Eliminando…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirmar eliminación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
