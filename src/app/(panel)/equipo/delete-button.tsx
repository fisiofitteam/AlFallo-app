"use client";

import { Trash2 } from "lucide-react";
import { deleteMember } from "./actions";

export function DeleteMemberButton({
  id,
  name,
  variant = "icon",
}: {
  id: string;
  name: string;
  variant?: "icon" | "full";
}) {
  return (
    <form
      action={deleteMember}
      onSubmit={(e) => {
        if (!window.confirm(`¿Eliminar a ${name} del equipo? Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      {variant === "icon" ? (
        <button
          aria-label={`Eliminar a ${name}`}
          title="Eliminar"
          className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      ) : (
        <button className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
          <Trash2 size={15} /> Eliminar del equipo
        </button>
      )}
    </form>
  );
}
