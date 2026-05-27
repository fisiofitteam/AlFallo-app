// Logo de Al Fallo: una "A" triangular de trazo, en color de marca (rosa).
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary"
      aria-hidden
    >
      <path d="M4 21 L12 3 L20 21" />
      <path d="M7.7 14 H16.3" />
    </svg>
  );
}

export function BrandLogo() {
  return (
    <span className="flex items-center gap-2">
      <BrandMark />
      <span className="text-lg font-extrabold tracking-tight">Al Fallo</span>
    </span>
  );
}
