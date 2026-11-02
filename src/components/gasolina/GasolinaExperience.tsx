"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Flame, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import {
  MAIN_PROBLEMS, SESSION_TYPES, TRAINING_TIMES, OBJECTIVES, WEEK_PATTERNS, BLOCKERS,
  FOCUS_NAMES, WEB_GUIDE, type GasolinaAnswers, type Focus
} from "@/lib/gasolina/quiz";

type Step = "intro" | "time" | "type" | "problem" | "objective" | "weekPattern" | "blocker" | "contact" | "result";
type Attempt = { id: string; token: string };
type Result = {
  focus: Focus; focusName: string; title: string; intro: string;
  actions: [string, string, string]; example: string; mistake: string;
  opportunity: string; ambition: string; nextHabit: string; when: string; load: string;
};
const steps = {
  time: { index: 1, title: "¿Cuándo entrenas normalmente?", intro: "Elige tu horario más frecuente. Si cambia, también hay una opción para ti." },
  type: { index: 2, title: "¿Qué tipo de sesión predomina en tu semana?", intro: "Piensa en la carga que más quieres acompañar con tu alimentación." },
  problem: { index: 3, title: "¿Qué te cuesta más con la comida?", intro: "No buscamos hacerlo perfecto: queremos detectar por dónde puedes empezar." },
  objective: { index: 4, title: "¿Qué te gustaría conseguir con tu nutrición?", intro: "No es solo comer mejor: es para qué quieres hacerlo." },
  weekPattern: { index: 5, title: "¿Qué suele pasar en una semana normal?", intro: "Piensa en los días de trabajo y entrenamiento, no en una semana ideal." },
  blocker: { index: 6, title: "¿Qué te frena para dar el siguiente paso?", intro: "Queremos que la solución encaje con tu realidad." },
  contact: { index: 7, title: "Ya tenemos tu punto de partida", intro: "Solo necesitamos tu nombre y apellidos para mostrarte el resultado. Instagram es opcional." },
};
const optionSets = { time: TRAINING_TIMES, type: SESSION_TYPES, problem: MAIN_PROBLEMS, objective: OBJECTIVES, weekPattern: WEEK_PATTERNS, blocker: BLOCKERS };
const nextSteps = { time: "type", type: "problem", problem: "objective", objective: "weekPattern", weekPattern: "blocker", blocker: "contact" } as const;
const answerKeys = { time: "trainingTime", type: "sessionType", problem: "mainProblem", objective: "objective", weekPattern: "weekPattern", blocker: "blocker" } as const;
const inputClass = "w-full rounded-xl border border-[#70445f] bg-[#1b1020] px-4 py-3 text-sm text-white placeholder:text-[#a3889d] focus:border-[#eb4c9b]";

export function GasolinaExperience() {
  const [step, setStep] = useState<Step>("intro");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Partial<GasolinaAnswers>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [fullName, setFullName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const q = new URLSearchParams(window.location.search);
      const response = await fetch("/api/gasolina", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: q.get("utm_source") || "direct", campaign: q.get("utm_campaign") || "gasolina-reel" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo comenzar el test.");
      setAttempt({ id: data.id, token: data.token });
      setStep("time");
    } catch (e) { setError(e instanceof Error ? e.message : "Comprueba tu conexión."); }
    finally { setBusy(false); }
  }

  function selectOption(value: string) {
    if (step === "intro" || step === "contact" || step === "result") return;
    const field = answerKeys[step];
    setAnswers((current) => ({ ...current, [field]: value }));
    setStep(nextSteps[step]);
    setError("");
  }

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !attempt) return;
    if (!answers.trainingTime || !answers.sessionType || !answers.mainProblem ||
        !answers.objective || !answers.weekPattern || !answers.blocker) {
      setError("Completa primero las seis preguntas."); return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/gasolina", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", ...attempt, answers, fullName, instagram }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo guardar tu resultado.");
      setResult(data.result as Result); setStep("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "Comprueba tu conexión."); }
    finally { setBusy(false); }
  }

  function recordWhatsappClick() {
    if (!attempt) return;
    void fetch("/api/gasolina", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "whatsapp", ...attempt }),
    }).catch(() => {});
  }

  function back() {
    const previous: Partial<Record<Step, Step>> = {
      time: "intro", type: "time", problem: "type", objective: "problem",
      weekPattern: "objective", blocker: "weekPattern", contact: "blocker",
    };
    setStep(previous[step] || "intro"); setError("");
  }
  const stepData = step !== "intro" && step !== "result" ? steps[step] : null;
  const choices = step !== "intro" && step !== "result" && step !== "contact" ? optionSets[step] : [];
  const selectedValue = step !== "intro" && step !== "result" && step !== "contact" ? answers[answerKeys[step]] : undefined;
  const officialWhatsapp = (process.env.NEXT_PUBLIC_AL_FALLO_WHATSAPP_NUMBER || "34865539963").replace(/[^0-9]/g, "");
  const whatsappText = result ? [
    "Hola, soy " + fullName.trim() + ".",
    "He completado GASOLINA y mi primer foco es " + FOCUS_NAMES[result.focus].toLowerCase() + ".",
    "Me gustaría saber cómo funciona Al Fallo Performance para tener más energía durante el WOD y el día, trabajar en mis marcas y organizar mi alimentación sin renunciar a mi vida. ¿Podéis contarme cómo trabajáis?",
  ].join(" ") : "";
  const whatsappUrl = "https://wa.me/" + officialWhatsapp + "?text=" + encodeURIComponent(whatsappText);

  return (
    <main className="al-fallo-booking min-h-screen overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 82% 4%,rgba(230,25,126,.28),transparent 42%), radial-gradient(ellipse at 0% 80%,rgba(118,28,85,.21),transparent 48%), #150b1b" }}>
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-7 sm:px-8 sm:pt-10">
        <header className="flex min-w-0 items-center justify-between gap-3">
          <img src="/gasolina/al-fallo-logo.svg" alt="Al Fallo Nutrition" width={90} height={94} className="h-[78px] w-auto object-contain sm:h-[94px]" />
          <span className="max-w-[175px] shrink-0 truncate rounded-full border border-[#77435e] px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wide text-[#f5bddb] sm:max-w-none sm:px-3 sm:text-[10px] sm:tracking-widest">Recurso gratuito · GASOLINA</span>
        </header>

        {step === "intro" && (
          <section className="grid min-w-0 grid-cols-1 items-center gap-14 pb-12 pt-14 md:grid-cols-2 md:pt-20">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#f17bad]/35 bg-[#e6197e]/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#ffb5d7]"><Flame size={15} /> TU NUTRICIÓN, AL NIVEL DE TU ENTRENO</span>
              <h1 className="mt-8 text-[clamp(2.65rem,10vw,5.8rem)] font-black leading-[.98] tracking-[-.06em]">
                DEJA DE<br />IMPROVISAR<br /><span className="al-fallo-gradient-text">TU COMIDA.</span>
              </h1>
              <p className="mt-7 max-w-full text-base leading-relaxed text-[#e7d0df] sm:max-w-xl sm:text-lg">
                Tu entrenamiento tiene objetivos. Tu comida debería acompañarte.
                Responde seis preguntas y descubre cómo empezar a organizar tu alimentación para entrenar con más energía, aspirar a mejorar tus marcas y seguir disfrutando de tu vida.
              </p>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#d7bacc]">
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[#ff8cbd]" /> Resultado inmediato</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[#ff8cbd]" /> Resultado completo en pantalla</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[#ff8cbd]" /> Sin dietas rígidas</span>
              </div>
              <button type="button" disabled={busy} onClick={() => void begin()}
                className="mt-9 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#e6197e] px-7 py-4 text-base font-extrabold shadow-xl shadow-[#e6197e]/20 transition hover:bg-[#f32991] disabled:opacity-50 sm:w-auto">
                {busy ? "Preparando tu test..." : "Quiero descubrir mi punto de partida"} <ArrowRight size={20} />
              </button>
              <p className="mt-3 text-xs text-[#b99cae]">Unos 2 minutos · 100 % gratuito</p>
              {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/35 bg-red-950/30 p-4 text-sm text-red-200">{error}</p>}
            </div>
            <div className="mx-auto min-w-0 w-full max-w-[450px]">
              <div className="relative mx-auto aspect-[.81] w-[84%] -rotate-[5deg] rounded-[26px] border border-[#ff9bca]/40 bg-gradient-to-br from-[#572144] via-[#2c162e] to-[#150b1c] p-7 shadow-[0_35px_90px_rgba(0,0,0,.48)] sm:p-10">
                <img src="/gasolina/al-fallo-logo.svg" alt="Al Fallo Nutrition" className="h-16 w-auto object-contain" />
                <p className="mt-8 text-[11px] font-extrabold uppercase tracking-[.23em] text-[#ff9bcb]">GASOLINA · TU PLAN INICIAL</p>
                <p className="mt-5 text-[clamp(2.4rem,4vw,4rem)] font-black leading-[1.05] tracking-[-.065em]">COME<br />PARA<br /><span className="al-fallo-gradient-text">RENDIR.</span></p>
                <p className="absolute bottom-8 left-7 right-7 border-t border-[#9f6283] pt-4 text-[11px] font-semibold text-[#e0b5cd] sm:left-10 sm:right-10">ENERGÍA · HIDRATOS · RECUPERACIÓN</p>
                <span className="absolute -bottom-4 -right-5 rotate-[8deg] rounded-xl border border-[#ffb3d3]/40 bg-[#fbe7f2] px-5 py-3 text-center shadow-xl"><strong className="block text-sm text-[#b21e66]">6 PREGUNTAS</strong><span className="text-[10px] text-[#65435b]">un punto de partida</span></span>
              </div>
            </div>
          </section>
        )}

        {stepData && (
          <section className="mx-auto max-w-2xl pt-12 sm:pt-16">
            <div className="mb-6 flex justify-between text-xs font-bold uppercase tracking-wider text-[#d4b2ca]"><span>Tu plan GASOLINA</span><span>Paso {stepData.index} de 7</span></div>
            <div className="mb-9 h-1.5 overflow-hidden rounded-full bg-[#4f2d45]"><div className="h-full rounded-full bg-gradient-to-r from-[#e6197e] to-[#ff97c8]" style={{ width: String(stepData.index / 7 * 100) + "%" }} /></div>
            <div className="rounded-[26px] border border-[#633c57] bg-[#2a192f]/95 p-6 shadow-2xl sm:p-9">
              <h2 className="text-3xl font-black leading-tight tracking-[-.045em] sm:text-4xl">{stepData.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#d6b7ca]">{stepData.intro}</p>
              {step !== "contact" && (
                <div key={step} className="mt-8 grid gap-3">
                  {choices.map((option) => (
                    <button type="button" key={step + ":" + option.id} onClick={() => selectOption(option.id)}
                      aria-pressed={selectedValue === option.id}
                      className={"group flex min-h-[70px] items-center justify-between gap-4 rounded-xl border px-5 py-3.5 text-left transition hover:border-[#e6197e] hover:bg-[#4c2945] " + (selectedValue === option.id ? "border-[#ff7db8] bg-[#502640]" : "border-[#5c3852] bg-[#37213b]")}>
                      <span><strong className="block text-sm font-bold sm:text-base">{option.label}</strong><span className="mt-1 block text-xs text-[#cbaec2]">{option.detail}</span></span>
                      {selectedValue === option.id ? <Check size={17} className="shrink-0 text-[#ffafd1]" /> : <ArrowRight size={17} className="shrink-0 text-[#c590b0] transition group-hover:translate-x-1 group-hover:text-[#ff9dcb]" />}
                    </button>
                  ))}
                </div>
              )}
              {step === "contact" && (
                <form className="mt-8 space-y-4" onSubmit={(e) => void finish(e)}>
                  <div>
                    <label htmlFor="gas-nombre" className="mb-2 block text-sm font-semibold text-[#f8e5f0]">Nombre y apellidos *</label>
                    <input
                      id="gas-nombre" className={inputClass} autoComplete="name"
                      required minLength={3} maxLength={100}
                      value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. Ana García"
                    />
                  </div>
                  <div>
                    <label htmlFor="gas-ig" className="mb-2 block text-sm font-semibold text-[#f8e5f0]">
                      Usuario de Instagram <span className="font-normal text-[#c2a5b9]">— opcional</span>
                    </label>
                    <input
                      id="gas-ig" className={inputClass}
                      autoComplete="off" maxLength={65}
                      value={instagram} onChange={(e) => setInstagram(e.target.value)}
                      placeholder="@tuusuario"
                    />
                  </div>
                  <p className="rounded-xl border border-[#674358] bg-[#221527] px-4 py-3 text-xs leading-relaxed text-[#d9c0d1]">
                    Usaremos tu nombre, Instagram si lo añades y tus respuestas para mostrarte el resultado y medir
                    el uso de GASOLINA. No te suscribimos a publicidad ni te pedimos teléfono ni email.
                    Consulta nuestro <Link href="/gasolina/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#ffb6d9] underline">aviso de privacidad</Link>.
                  </p>
                  <button
                    type="submit" disabled={busy || fullName.trim().split(/\s+/).length < 2}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#e6197e] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#f32b91] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Preparando tu resultado..." : "Descubrir cómo empezar a rendir mejor"} <ArrowRight size={18} />
                  </button>
                  <p className="text-center text-[11px] text-[#bca5b7]">Resultado inmediato en esta misma página · Sin descargas</p>
                </form>
              )}
              {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/35 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</p>}
              <div className="mt-7 border-t border-[#5b3650] pt-5">
                <button type="button" disabled={busy} onClick={back} className="inline-flex items-center gap-2 text-xs font-semibold text-[#c5a4bb] hover:text-white disabled:opacity-40"><ArrowLeft size={15} /> Volver</button>
              </div>
            </div>
          </section>
        )}

        {step === "result" && result && (
          <section className="mx-auto max-w-4xl pt-12 sm:pt-16">
            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#f48dba]/35 bg-[#e6197e]/10 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-[#ffadd4]">
                <CheckCircle2 size={16} /> Resultado completado
              </span>
            </div>
            <h1 className="text-center text-[clamp(2.2rem,6vw,3.9rem)] font-black leading-[1.08] tracking-[-.05em]">
              {fullName.trim().split(/\s+/)[0]}, tu siguiente paso<br />
              <span className="al-fallo-gradient-text">empieza aquí.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-[#e5cfe0] sm:text-base">
              Has entrenado para mejorar. Ahora toca ver cómo puede acompañarte tu alimentación:
              con más recursos para el WOD, margen para trabajar en tus marcas y una organización
              que no te obligue a renunciar a tu vida.
            </p>
            <p className="mx-auto mt-3 max-w-xl text-center text-xs text-[#c7acc1]">
              Esta orientación parte de tus respuestas. No diagnostica déficits ni sustituye una valoración individual.
            </p>

            <section className="mt-10 overflow-hidden rounded-[26px] border border-[#72435e] bg-[#2b192e]">
              <div className="border-b border-[#5c3850] bg-gradient-to-r from-[#592542] to-[#2b192f] p-6 sm:p-9">
                <span className="text-[11px] font-black uppercase tracking-[.19em] text-[#ff9cca]">
                  Tu primer foco · {FOCUS_NAMES[result.focus]}
                </span>
                <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{result.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#e9cfdf]">{result.intro}</p>
                <div className="mt-5 rounded-xl border border-[#834967] bg-[#4a2340]/60 p-4">
                  <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#ffb4d7]">Lo que te gustaría conseguir</h3>
                  <p className="text-sm leading-relaxed text-[#f0d9e8]">{result.ambition}</p>
                </div>
              </div>
              <div className="p-6 sm:p-9">
                <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-[#ffb4d9]">
                  3 acciones para probar esta semana
                </h3>
                <div className="grid gap-3">
                  {result.actions.map((item, i) => (
                    <div key={item} className="flex items-start gap-3 rounded-xl border border-[#5a3750] bg-[#372139] px-4 py-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e6197e]/25 text-xs font-black text-[#ffabd3]">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-[#f2dce9]">{item}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#59374f] bg-[#1e1325] p-4">
                    <h4 className="mb-2 text-xs font-black uppercase text-[#ff9bca]">Según tu horario</h4>
                    <p className="text-sm leading-relaxed text-[#ebd3e2]">{result.when}</p>
                  </div>
                  <div className="rounded-xl border border-[#59374f] bg-[#1e1325] p-4">
                    <h4 className="mb-2 text-xs font-black uppercase text-[#ff9bca]">Según tu entrenamiento</h4>
                    <p className="text-sm leading-relaxed text-[#ebd3e2]">{result.load}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-[#623d54] bg-[#3b2440] p-4">
                  <h4 className="mb-2 text-xs font-black uppercase text-[#ffb4d6]">Un ejemplo que puedes adaptar</h4>
                  <p className="text-sm leading-relaxed text-[#f0d9e7]">{result.example}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#623d54] p-4">
                    <h4 className="mb-2 text-xs font-black uppercase text-[#ffc2d5]">Evita este error habitual</h4>
                    <p className="text-sm leading-relaxed text-[#e8d2df]">{result.mistake}</p>
                  </div>
                  <div className="rounded-xl border border-[#623d54] p-4">
                    <h4 className="mb-2 text-xs font-black uppercase text-[#ffc2d5]">Tu próximo hábito</h4>
                    <p className="text-sm leading-relaxed text-[#e8d2df]">{result.nextHabit}</p>
                  </div>
                </div>
                <p className="mt-5 border-l-2 border-[#ff87bc] pl-4 text-sm leading-relaxed text-[#eecfe0]">{result.opportunity}</p>
              </div>
            </section>

            <section className="mt-8 rounded-[26px] border border-[#a64f7c] bg-gradient-to-br from-[#5a2548] via-[#3d1d3b] to-[#2a1933] p-6 shadow-xl shadow-[#e6197e]/5 sm:p-9">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e6197e]/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-[#ffc4df]">
                <Sparkles size={15} /> ¿Y si pudieses llevarlo más lejos?
              </div>
              <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                Mejor energía. Más recursos para tus marcas.
                <span className="al-fallo-gradient-text"> Una alimentación que encaja contigo.</span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#efd9e5] sm:text-base">
                Si te gustaría llegar con energía al WOD y conservarla para el resto del día,
                trabajar en tus marcas y organizar tu comida sin dejar de disfrutar de tus planes,
                en Al Fallo Performance podemos ayudarte a encontrar una estrategia adaptada a ti.
              </p>
              <a
                href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                onClick={recordWhatsappClick}
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#e6197e] px-6 py-4 text-center text-sm font-black text-white shadow-lg shadow-[#e6197e]/20 transition hover:bg-[#f32b90] sm:w-auto sm:text-base"
              >
                <MessageCircle size={20} /> Quiero información sobre Al Fallo Performance <ArrowRight size={18} />
              </a>
              <p className="mt-3 text-xs text-[#dfb9cd]">
                Se abrirá WhatsApp con un mensaje preparado. Tú decides si enviarlo, sin compromiso.
              </p>
            </section>

            <section className="mt-12" aria-label="Tu guía GASOLINA">
              <div className="mb-7 text-center">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#ff9ecb]">
                  GASOLINA · Guía práctica completa
                </span>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Qué comer <span className="al-fallo-gradient-text">según tu WOD</span>
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#d5bacb]">
                  Estas cuatro claves complementan tu resultado. Guárdalas como referencia
                  y adapta las opciones a tus sensaciones, horarios y necesidades reales.
                </p>
              </div>
              <div className="grid gap-4">
                {WEB_GUIDE.map((chapter) => (
                  <article key={chapter.id} className="rounded-2xl border border-[#633b56] bg-[#2a192e] p-5 sm:p-7">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#ff9bc9]">{chapter.badge}</span>
                    <h3 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">{chapter.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#e5cddd]">{chapter.text}</p>
                    <div className="mt-5 space-y-2.5">
                      {chapter.examples.map((example) => (
                        <p key={example} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#f1deea]">
                          <Check size={16} className="mt-0.5 shrink-0 text-[#ffa2cd]" /> {example}
                        </p>
                      ))}
                    </div>
                    <p className="mt-5 rounded-xl border border-[#784760] bg-[#41243f] px-4 py-3 text-xs leading-relaxed text-[#edcddd]">
                      <strong>Para tener en cuenta:</strong> {chapter.tip}
                    </p>
                  </article>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-[#734861] bg-[#2e1c33] px-5 py-6">
                <h3 className="text-lg font-black">Tu checklist para la próxima semana</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    "He identificado los entrenamientos que más energía me exigen.",
                    "Tengo una opción sencilla antes y después de entrenar.",
                    "He pensado cómo organizarme si cambia mi horario.",
                    "Voy a valorar mis sensaciones sin exigirme perfección.",
                  ].map((item) => (
                    <p key={item} className="flex items-start gap-2.5 text-sm text-[#e9d3e0]">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#ff95c5]" /> {item}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-[#8c4c6d] bg-[#492440] px-6 py-7 text-center sm:px-9">
              <h2 className="text-2xl font-black tracking-tight">Entrena para mejorar. Come para acompañarlo.</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#f0d7e6]">
                Si quieres dejar de improvisar y descubrir cómo adaptamos la nutrición al
                entrenamiento y a la vida de cada atleta, escríbenos.
              </p>
              <a
                href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                onClick={recordWhatsappClick}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e6197e] px-6 py-3 text-center text-sm font-extrabold text-white hover:bg-[#f32b90]"
              >
                <MessageCircle size={18} /> Hablar con Al Fallo Performance <ArrowRight size={16} />
              </a>
            </section>
            <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-[#aa8e9f]">
              Información general para adultos activos. No sustituye una valoración nutricional
              individual, especialmente ante necesidades clínicas o alimentarias específicas.
            </p>
          </section>
        )}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[#633c58] pt-5 text-xs text-[#b59aab]">
          <span>© {new Date().getFullYear()} Al Fallo Nutrition · GASOLINA</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> <Link href="/gasolina/privacidad" className="underline hover:text-white">Privacidad</Link> · Orientación educativa</span>
        </footer>
      </div>
    </main>
  );
}
