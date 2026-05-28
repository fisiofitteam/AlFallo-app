import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center pt-12 text-center">
      <Link href="/cliente" className="mb-6 flex items-center gap-1.5 self-start text-sm text-muted hover:text-text">
        <ArrowLeft size={16} /> Inicio
      </Link>
      <div className="rounded-2xl border border-border bg-surface p-8">
        <Icon size={56} className="mx-auto text-primary" strokeWidth={1.6} />
        <h1 className="mt-4 text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
        <p className="mt-4 inline-block rounded-full bg-primary-soft px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          Próximamente
        </p>
      </div>
    </div>
  );
}
