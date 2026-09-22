import { Sparkles } from "lucide-react";

export function TabPlaceholder({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles size={20} />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{hint}</p>
    </section>
  );
}
