import { GraduationCap } from "lucide-react";

/**
 * Portada del curso. Si hay URL, muestra la imagen; si no, un placeholder
 * con el gradiente de marca. Acepta `url` o `coverUrl` (alias), y `size`
 * o `className`.
 */
export function CourseCover({
  url,
  coverUrl,
  title,
  size = "md",
  className,
}: {
  url?: string | null;
  coverUrl?: string | null;
  title: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const src = url ?? coverUrl ?? null;
  const cls =
    className ??
    (size === "sm"
      ? "aspect-video w-32 rounded-xl border border-border"
      : size === "lg"
      ? "aspect-video w-full rounded-xl border border-border"
      : "aspect-video w-full max-w-xs rounded-xl border border-border");

  if (src) {
    return <img src={src} alt={title} className={`${cls} object-cover`} />;
  }
  return (
    <div
      className={`${cls} flex items-center justify-center bg-gradient-to-br from-primary to-[#b8125f] text-white`}
      aria-label={title}
    >
      <GraduationCap size={32} className="opacity-75" />
    </div>
  );
}
