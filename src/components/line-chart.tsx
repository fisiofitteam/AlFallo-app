// Gráfica de líneas sencilla en SVG (sin dependencias). Server-friendly.
export type ChartPoint = { label: string; value: number };

export function LineChart({
  points,
  color = "#e6197e",
  unit = "",
  height = 96,
}: {
  points: ChartPoint[];
  color?: string;
  unit?: string;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <p className="py-4 text-center text-xs text-muted">
        Necesita al menos 2 datos para la gráfica.
      </p>
    );
  }

  const W = 320;
  const H = height;
  const padX = 4;
  const padTop = 8;
  const padBottom = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (W - padX * 2) / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: padTop + (1 - (p.value - min) / range) * (H - padTop - padBottom),
  }));

  // Path base (línea) + path cerrado hacia el eje inferior para el fill.
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(H - padBottom).toFixed(1)} ` +
    `L ${coords[0].x.toFixed(1)} ${(H - padBottom).toFixed(1)} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.value - first.value;
  const deltaFmt = `${delta >= 0 ? "+" : ""}${Math.round(delta * 10) / 10}`;
  const deltaTone =
    delta === 0 ? "text-muted" : delta > 0 ? "text-emerald-600" : "text-rose-600";
  // Semilla del gradient — unique-ish sin useId para poder usarlo en RSC.
  const gradientId = `lc-${Math.round(coords[0].x * 100) + points.length}-${Math.round(min * 10)}`;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span>
          <strong className="text-text">{last.value}</strong>
          {unit} <span className="text-muted">actual</span>
        </span>
        <span className={deltaTone}>
          {deltaFmt}
          {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid horizontal muy sutil: 3 líneas (max, mid, min). */}
        {[padTop, (padTop + (H - padBottom)) / 2, H - padBottom].map((y, i) => (
          <line
            key={i}
            x1={padX}
            x2={W - padX}
            y1={y}
            y2={y}
            stroke="currentColor"
            className="text-border"
            strokeWidth={0.5}
            strokeDasharray={i === 1 ? "2 3" : undefined}
          />
        ))}

        {/* Área bajo la línea */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Línea principal */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Punto inicial y final (los intermedios se ocultan para look limpio). */}
        <circle cx={coords[0].x} cy={coords[0].y} r={2} fill={color} />
        <circle
          cx={coords[coords.length - 1].x}
          cy={coords[coords.length - 1].y}
          r={2.5}
          fill={color}
          stroke="white"
          strokeWidth={1.2}
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{first.label}</span>
        <span>
          min {Math.round(min * 10) / 10} · máx {Math.round(max * 10) / 10}
        </span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}
