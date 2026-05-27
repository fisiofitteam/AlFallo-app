import { LineChart, type ChartPoint } from "@/components/line-chart";

function ChartCard({
  title,
  points,
  color,
  unit,
}: {
  title: string;
  points: ChartPoint[];
  color: string;
  unit: string;
}) {
  if (points.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <LineChart points={points} color={color} unit={unit} />
    </section>
  );
}

export function EvolucionTab({
  weight,
  waist,
  bodyFat,
}: {
  weight: ChartPoint[];
  waist: ChartPoint[];
  bodyFat: ChartPoint[];
}) {
  const hasAny = weight.length + waist.length + bodyFat.length > 0;
  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="font-medium">Sin datos de evolución todavía</p>
        <p className="mt-1 text-sm text-muted">
          Se llenan con los registros diarios (peso) y los check-ins (perímetros, % grasa).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChartCard title="Peso" points={weight} color="#e6197e" unit=" kg" />
      <ChartCard title="Cintura" points={waist} color="#e07b1a" unit=" cm" />
      <ChartCard title="% Grasa" points={bodyFat} color="#1fa971" unit="%" />
    </div>
  );
}
