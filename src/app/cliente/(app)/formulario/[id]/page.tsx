import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { parseQuestions } from "@/lib/satisfactionForms";
import { submitSatisfaction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SatisfactionFormPage({ params }: { params: { id: string } }) {
  const client = await requireOnboardedClient();
  const form = await prisma.satisfactionForm.findUnique({ where: { id: params.id } });
  if (!form || !form.active) notFound();

  const existing = await prisma.satisfactionResponse.findUnique({
    where: { clientId_formId: { clientId: client.id, formId: form.id } },
  });
  if (existing) redirect("/cliente?formulario=hecho");

  const questions = parseQuestions(form.questions);
  const submit = submitSatisfaction.bind(null, form.id);

  return (
    <div className="pt-1">
      <Link
        href="/cliente"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
      >
        <ArrowLeft size={12} /> Volver
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold leading-tight">{form.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Nos ayuda un montón que nos cuentes cómo lo estás viviendo. Un minuto y listo.
      </p>

      <form action={submit} className="mt-5 space-y-5">
        {questions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-muted">
            Este formulario aún no tiene preguntas.
          </p>
        ) : null}
        {questions.map((q) => (
          <div key={q.id} className="rounded-2xl border border-border bg-surface p-4">
            <label className="block text-sm font-semibold">
              {q.label}
              {q.required ? <span className="ml-1 text-primary">*</span> : null}
            </label>
            {q.type === "scale" ? (
              <ScaleField question={q} />
            ) : (
              <textarea
                name={`q_${q.id}`}
                rows={3}
                required={q.required}
                placeholder={q.placeholder}
                className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
          </div>
        ))}
        {questions.length > 0 ? (
          <button
            type="submit"
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-fg hover:opacity-90"
          >
            Enviar
          </button>
        ) : null}
      </form>
    </div>
  );
}

function ScaleField({
  question,
}: {
  question: Extract<ReturnType<typeof parseQuestions>[number], { type: "scale" }>;
}) {
  const min = Math.min(question.scaleMin, question.scaleMax);
  const max = Math.max(question.scaleMin, question.scaleMax);
  const values: number[] = [];
  for (let v = min; v <= max; v++) values.push(v);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <label
            key={v}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-bg text-sm font-semibold text-text has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-fg"
          >
            <input
              type="radio"
              name={`q_${question.id}`}
              value={v}
              required={question.required}
              className="sr-only"
            />
            {v}
          </label>
        ))}
      </div>
      {question.scaleMinLabel || question.scaleMaxLabel ? (
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>{question.scaleMinLabel}</span>
          <span>{question.scaleMaxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
