import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  canViewCategory,
  categoriesForRole,
  defaultCategoryFor,
  type MeetingCategory,
} from "./categories";
import { MeetingsFeed, type MeetingItem } from "@/components/MeetingsFeed";

export const metadata = { title: "Reuniones · Al Fallo Nutrition" };
export const dynamic = "force-dynamic";

function parseTab(value: string | string[] | undefined): MeetingCategory | null {
  const v = typeof value === "string" ? value : Array.isArray(value) ? value[0] : "";
  return (CATEGORIES as readonly string[]).includes(v) ? (v as MeetingCategory) : null;
}

export default async function ReunionesPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const prof = await requireProfessional();
  const requestedTab = parseTab(searchParams?.tab);

  // Si no especifica tab o pide una que no puede ver, lo mandamos a su default.
  // El redirect mantiene URLs limpias y evita renderizar contenido vetado.
  if (!requestedTab || !canViewCategory(prof.role, requestedTab)) {
    redirect(`/reuniones?tab=${defaultCategoryFor(prof.role)}`);
  }
  const activeTab: MeetingCategory = requestedTab;
  const visibleTabs = categoriesForRole(prof.role);
  const canManage = isManager(prof.role);

  const meetings = await prisma.meeting.findMany({
    where: { category: activeTab },
    orderBy: [{ pinned: "desc" }, { date: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { fullName: true } },
    },
  });

  const payload: MeetingItem[] = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    objective: m.objective,
    category: m.category as MeetingCategory,
    date: m.date?.toISOString() ?? null,
    body: m.body,
    pinned: m.pinned,
    authorName: m.createdBy?.fullName ?? null,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Reuniones</h1>
        <p className="mt-1 text-sm text-muted">
          Actas y notas del equipo. Pulsa sobre una tarjeta para desplegar el contenido completo.
        </p>
      </header>

      {/* Tabs (solo las que el rol puede ver) */}
      <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {visibleTabs.map((c) => {
          const active = c === activeTab;
          return (
            <Link
              key={c}
              href={`/reuniones?tab=${c}`}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                active
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-bg hover:text-text"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </Link>
          );
        })}
      </nav>

      <MeetingsFeed meetings={payload} category={activeTab} canManage={canManage} />
    </div>
  );
}
