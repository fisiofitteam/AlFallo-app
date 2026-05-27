"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-text"
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </form>
  );
}
