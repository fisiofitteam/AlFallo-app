import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveProfessional } from "@/lib/session";
import { canUseMarketerIA } from "@/lib/marketer-access";
import { getAiBrief } from "@/lib/ai-brief";
import { saveAiBrief } from "./actions";

export const metadata = { title: "Brief de marca · Marketer IA" };
export const dynamic = "force-dynamic";

const FIELDS: {
  name: keyof Awaited<ReturnType<typeof getAiBrief>>;
  label: string;
  hint: string;
  minHeight: number;
}[] = [
  {
    name: "brand",
    label: "Contexto de marca",
    hint: "Nombre del servicio, gran idea, promesa, cliente ideal, diferencial. Es lo primero que lee la IA.",
    minHeight: 220,
  },
  {
    name: "voiceTone",
    label: "Voz y tono",
    hint: "Cómo suena la marca. Personalidad, registro, nivel de confrontación, referencias que inspiran y de las que huyes.",
    minHeight: 180,
  },
  {
    name: "dos",
    label: "Sí hacer",
    hint: "Vocabulario, giros conversacionales, elementos obligatorios en cada pieza (CTA, nombre completo del servicio, etc.).",
    minHeight: 140,
  },
  {
    name: "donts",
    label: "No hacer",
    hint: "Palabras y conceptos prohibidos: promesas garantizadas, fitness genérico, tono cursi, tecnicismos sin traducir.",
    minHeight: 140,
  },
  {
    name: "structureHints",
    label: "Estructura semanal habitual",
    hint: "Los pilares, la distribución típica, la gran idea que atraviesa todo el contenido.",
    minHeight: 180,
  },
  {
    name: "goodExamples",
    label: "Ejemplos buenos (referencia de nivel)",
    hint: "2–3 piezas que ya te salieron bien: hook + cuerpo. Le dan a la IA una vara de medir.",
    minHeight: 160,
  },
  {
    name: "badExamples",
    label: "Ejemplos a evitar (AI-slop)",
    hint: "Lo que NO quieres. Le sirve a la IA para reconocerlo y descartarlo.",
    minHeight: 140,
  },
];

export default async function BriefPage() {
  const user = await getActiveProfessional();
  if (!user) redirect("/login");
  if (!canUseMarketerIA(user.email)) redirect("/contenido");

  const brief = await getAiBrief();

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/contenido/marketer"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={15} /> Volver al Marketer IA
      </Link>
      <header className="mb-5">
        <h1 className="text-2xl font-bold md:text-3xl">Brief de marca</h1>
        <p className="mt-1 text-sm text-muted">
          Este es el system prompt que Claude usa cada vez que generas una estrategia. Si dejas un
          campo en blanco, la IA cae al fallback embebido de Al Fallo.
        </p>
      </header>

      <form action={saveAiBrief} className="space-y-6">
        {FIELDS.map((f) => (
          <div key={f.name}>
            <label htmlFor={f.name} className="text-sm font-semibold">
              {f.label}
            </label>
            <p className="mt-0.5 text-xs text-muted">{f.hint}</p>
            <textarea
              id={f.name}
              name={f.name}
              defaultValue={brief[f.name]}
              className="mt-2 w-full rounded-lg border border-border bg-surface p-3 text-sm font-mono leading-relaxed"
              style={{ minHeight: f.minHeight }}
            />
          </div>
        ))}

        <div className="sticky bottom-0 flex justify-end gap-2 bg-bg pb-2 pt-3">
          <Link
            href="/contenido/marketer"
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
          >
            Guardar brief
          </button>
        </div>
      </form>
    </main>
  );
}
