// Gráfica de líneas sencilla en SVG (sin dependencias). Server-friendly.
export type ChartPoint = { label: string; value: number };

export function LineChart({
  points,
  color = "#e6197e",
  unit = "",
  height = 140,
}: {
  points: ChartPoint[];
  color?: string;
  unit?: string;
  height?: number;
}) {
  if (points.length < 2) {
    return <p className="py-6 text-center text-sm text-muted">Necesita al menos 2 datos para la gráfica.</p>;
  }

  const W = 320;
  const H = height;
  const pad = 10;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (W - pad * 2) / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: pad + i * stepX,
    y: pad + (1 - (p.value - min) / range) * (H - pad * 2),
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted">
        <span>
          {points[0].label}: {points[0].value}
          {unit}
        </span>
        <span>
          {points.at(-1)!.label}: {points.at(-1)!.value}
          {unit}
        </span>
      </div>
    </div>
  );
}
