import { CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { parseQuestions, type SatisfactionQuestion } from "@/lib/satisfactionForms";

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function answerLabel(q: SatisfactionQuestion, value: unknown): string {
  if (q.type === "scale") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    const min = Math.min(q.scaleMin, q.scaleMax);
    const max = Math.max(q.scaleMin, q.scaleMax);
    return `${n} / ${max - min > 0 ? max : n}`;
  }
  if (typeof value === "string" && value.trim().length > 0) return value;
  return "—";
}

export async function FormulariosTab({ clientId }: { clientId: string }) {
  // Traemos TODOS los formularios activos + las respuestas del cliente. Así
  // vemos también los que aún tiene pendientes.
  const [forms, responses] = await Promise.all([
    prisma.satisfactionForm.findMany({
      orderBy: [{ weekOffset: "asc" }, { createdAt: "asc" }],
    }),
    prisma.satisfactionResponse.findMany({
      where: { clientId },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const responseByFormId = new Map(responses.map((r) => [r.formId, r]));

  const activeForms = forms.filter((f) => f.active);
  const inactiveWithResponse = forms.filter(
    (f) => !f.active && responseByFormId.has(f.id),
  );
  const orderedForms = [...activeForms, ...inactiveWithResponse];

  if (orderedForms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
        Todavía no hay formularios de satisfacción configurados. Créalos desde
        <br />
        <span className="font-medium">Biblioteca › Formularios de satisfacción</span>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Los formularios saltan automáticamente al atleta en su app cuando alcanza
        la semana de programa configurada. Aquí puedes consultar las respuestas.
      </p>

      {orderedForms.map((f) => {
        const response = responseByFormId.get(f.id) ?? null;
        const questions = parseQuestions(f.questions);
        const answers = (response?.answers ?? {}) as Record<string, unknown>;

        return (
          <article
            key={f.id}
            className={`rounded-2xl border p-5 ${
              response ? "border-border bg-surface" : "border-dashed border-border bg-bg/40"
            }`}
          >
            <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold">{f.name}</h3>
                <p className="text-[11px] text-muted">
                  Se envía en la <strong>semana {f.weekOffset}</strong> del programa
                  {questions.length > 0 ? (
                    <> · {questions.length} {questions.length === 1 ? "pregunta" : "preguntas"}</>
                  ) : null}
                </p>
              </div>
              {response ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  <CheckCircle2 size={12} /> Respondido {formatDate(response.submittedAt)}
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                  <Clock size={12} /> Pendiente
                </span>
              )}
            </header>

            {response ? (
              questions.length === 0 ? (
                <p className="text-xs italic text-muted">
                  Este formulario no tenía preguntas cuando se respondió.
                </p>
              ) : (
                <ul className="space-y-2">
                  {questions.map((q) => {
                    const value = answers[q.id];
                    return (
                      <li
                        key={q.id}
                        className="rounded-xl bg-bg/60 p-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {q.label}
                          {q.type === "scale" && q.isSatisfactionScore ? (
                            <span className="ml-1 rounded bg-primary/10 px-1 text-[9px] text-primary">
                              Satisfacción
                            </span>
                          ) : null}
                        </p>
                        {q.type === "scale" ? (
                          <p className="mt-0.5 text-lg font-bold text-primary">
                            {answerLabel(q, value)}
                            <span className="ml-1 text-xs font-medium text-muted">
                              / {Math.max(q.scaleMin, q.scaleMax)}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-text">
                            {typeof value === "string" && value.trim().length > 0
                              ? value
                              : "—"}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <p className="text-xs text-muted">
                El atleta aún no lo ha respondido. Le saltará automáticamente cuando
                llegue a la semana {f.weekOffset} de su programa.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
