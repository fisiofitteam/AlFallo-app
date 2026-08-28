"use client";

import { useState } from "react";
import { AiGenerateProgramModal } from "@/components/AiGenerateProgramModal";

export function GenerateProgramButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition hover:opacity-90"
      >
        ✨ Programador IA
      </button>
      {open && <AiGenerateProgramModal onClose={() => setOpen(false)} />}
    </>
  );
}
