"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

export type ShoppingItem = { name: string; key: string };
export type ShoppingGroup = { categoryKey: string; categoryLabel: string; items: ShoppingItem[] };

const STORAGE_KEY = "alfallo:compra:checked";

/**
 * Lista de la compra con casillas para marcar lo que ya tiene el cliente.
 *
 * - Estado checkeado vive en localStorage (un Set de keys de ingrediente).
 *   Persiste al recargar, no se sube al servidor: cada dispositivo lleva su
 *   propio progreso.
 * - Items marcados se tachan + bajan de opacidad pero no se mueven (para
 *   que el cliente pueda desmarcar fácilmente si se equivoca).
 * - Botón "Limpiar marcas" arriba a la derecha cuando hay alguno marcado.
 */
export function ShoppingChecklist({ groups }: { groups: ShoppingGroup[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Cargar de localStorage al montar.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          setChecked(new Set(arr.filter((x) => typeof x === "string")));
        }
      }
    } catch {
      // ignoramos: storage roto o privacidad estricta.
    }
    setHydrated(true);
  }, []);

  // Persistir al cambiar (después de hidratar para no pisar el valor inicial).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(checked)));
    } catch {
      // ignoramos
    }
  }, [checked, hydrated]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearAll() {
    setChecked(new Set());
  }

  const totalChecked = checked.size;

  return (
    <>
      {totalChecked > 0 ? (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2 text-sm">
          <span className="text-emerald-800">
            <strong>{totalChecked}</strong>{" "}
            {totalChecked === 1 ? "alimento marcado" : "alimentos marcados"}
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <RotateCcw size={12} /> Limpiar marcas
          </button>
        </div>
      ) : null}

      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.categoryKey} className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">
              {g.categoryLabel}
            </h2>
            <ul className="divide-y divide-border">
              {g.items.map((it) => {
                const isChecked = checked.has(it.key);
                return (
                  <li key={it.key}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(it.key)}
                        className="h-5 w-5 cursor-pointer rounded border-border accent-[color:var(--c-primary)]"
                      />
                      <span
                        className={`flex-1 font-medium capitalize transition ${
                          isChecked ? "text-muted line-through opacity-60" : "text-text"
                        }`}
                      >
                        {it.name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
