"use client";

import { useState } from "react";
import { Sparkles, Paperclip } from "lucide-react";
import type { SpecialConsiderationDTO } from "@/lib/specialConsiderations";

/**
 * Selector multi-check de consideraciones especiales para la ficha del cliente.
 * Emite N inputs hidden con name="specialConsiderationIds" por cada ID
 * seleccionado, así el server action las recoge con formData.getAll(...).
 */
export function SpecialConsiderationsSelector({
  available,
  initialSelectedIds,
}: {
  available: SpecialConsiderationDTO[];
  initialSelectedIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (available.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface/40 p-4 text-xs text-muted">
        No hay consideraciones especiales creadas. Cuando un manager defina alguna en{" "}
        <strong>Biblioteca → Brief IA → Consideraciones especiales</strong>, aparecerán aquí para
        marcar.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-muted">
        Marca las que apliquen a este cliente. Al generar plan con IA, la descripción y la dieta de
        ejemplo de cada consideración marcada se inyectan automáticamente en el brief.
      </p>

      {/* Inputs hidden con cada ID seleccionado, para que el server action los reciba. */}
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="specialConsiderationIds" value={id} />
      ))}

      <ul className="space-y-1.5">
        {available.map((c) => {
          const isOn = selected.has(c.id);
          return (
            <li key={c.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  isOn
                    ? "border-primary bg-primary-soft/40"
                    : "border-border bg-surface hover:border-primary/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(c.id)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border accent-[color:var(--c-primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Sparkles size={12} className={isOn ? "text-primary" : "text-muted"} />
                    <span className="text-sm font-semibold">{c.title}</span>
                    {c.examplePlanName ? (
                      <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-muted">
                        <Paperclip size={9} />
                        {c.examplePlanName}
                      </span>
                    ) : null}
                  </span>
                  {c.description ? (
                    <span className="mt-0.5 block text-xs leading-snug text-muted">
                      {c.description.length > 200
                        ? c.description.slice(0, 200) + "…"
                        : c.description}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
