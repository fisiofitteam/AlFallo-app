"use client";

import { UserCog } from "lucide-react";
import { stopImpersonation } from "@/app/(panel)/equipo/impersonate-actions";

type Props = {
  viewingAs: { fullName: string; roleLabel: string };
  realName: string;
};

// Barra fija en la parte superior mientras Dirección está viendo el panel
// como otro miembro. Botón de salida siempre visible; para cambiar de miembro
// se vuelve al listado de /equipo.
export function ImpersonationBanner({ viewingAs, realName }: Props) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-900 md:text-sm">
      <div className="flex items-center gap-2">
        <UserCog size={16} />
        <span>
          Estás viendo como <strong>{viewingAs.fullName}</strong> ({viewingAs.roleLabel}). Vista real:{" "}
          {realName}.
        </span>
      </div>
      <form action={stopImpersonation}>
        <button
          type="submit"
          className="rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700"
        >
          Volver a mi vista
        </button>
      </form>
    </div>
  );
}
