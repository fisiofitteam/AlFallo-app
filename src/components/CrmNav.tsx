"use client";

import Link from "next/link";

const TABS = [
  { key: "leads", label: "👥 Leads", href: "/crm" },
  { key: "calls", label: "📞 Agenda", href: "/crm/llamadas" },
  { key: "sales", label: "💰 Ventas", href: "/crm/ventas" },
] as const;

export function CrmNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
