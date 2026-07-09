import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { listMarks } from "@/lib/strengthMarks";
import { OwnStrengthMarks } from "@/components/cliente/OwnStrengthMarks";

export const metadata = { title: "Mis marcas · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function ClientMarksPage() {
  const me = await requireOnboardedClient();
  const [marks, records] = await Promise.all([
    listMarks(),
    prisma.strengthRecord.findMany({
      where: { clientId: me.id },
      orderBy: { date: "desc" },
      select: { id: true, markId: true, value: true, date: true, notes: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Mis marcas</h1>
      <p className="mt-1 text-sm text-muted">
        Registra tus 1RM, benchmarks y récords. La gráfica se actualiza sola conforme añades registros.
      </p>
      <div className="mt-5">
        <OwnStrengthMarks
          marks={marks.map((m) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            unit: m.unit,
            direction: m.direction,
          }))}
          records={records.map((r) => ({
            id: r.id,
            markId: r.markId,
            value: r.value,
            date: r.date.toISOString(),
            notes: r.notes,
          }))}
        />
      </div>
    </div>
  );
}
