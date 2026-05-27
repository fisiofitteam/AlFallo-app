"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="rounded-lg p-2 text-primary transition hover:bg-primary-soft"
      >
        <LogOut size={18} />
      </button>
    </form>
  );
}
