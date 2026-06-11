// Donut SVG ligero para mostrar % con el número en el centro. Se usa en la
// lista de clientes para las métricas Suscripción / Cumplimiento.

type Tone = "good" | "warn" | "bad" | "muted";

const TONE_STROKE: Record<Tone, string> = {
  good: "#1fa971",   // verde — el de la card "Activos" del panel.
  warn: "#e07b1a",   // ámbar — el de la card "Pendientes".
  bad: "#dc2626",    // rojo — atención.
  muted: "#d4d4d8",  // gris claro — sin datos.
};

const TONE_TEXT: Record<Tone, string> = {
  good: "text-[#15803d]",
  warn: "text-[#b45309]",
  bad: "text-red-600",
  muted: "text-muted",
};

export function MetricDonut({
  value,
  label,
  tone,
  size = 56,
}: {
  /** 0–100. Si no aplica, pasa `tone="muted"` y queda con anillo gris. */
  value: number;
  label: string;
  tone: Tone;
  size?: number;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  const display = tone === "muted" ? "—" : `${value}%`;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#f4f4f5"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={TONE_STROKE[tone]}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <div
          className={`absolute inset-0 flex items-center justify-center text-[12px] font-bold ${TONE_TEXT[tone]}`}
        >
          {display}
        </div>
      </div>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}
