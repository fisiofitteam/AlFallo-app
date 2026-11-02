"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Flame, MessageCircle, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-mark";
import { MAIN_PROBLEMS, SESSION_TYPES, TRAINING_TIMES, type GasolinaAnswers, type Focus } from "@/lib/gasolina/quiz";

type Step = "intro" | "time" | "type" | "problem" | "contact" | "result";
type Attempt = { id: string; token: string };
type Result = { focus: Focus; title: string; intro: string; actions: [string, string, string]; chapter: string; when: string; load: string; };
const names: Record<Focus, string> = {
  preworkout: "Energía previa", carbs: "Ajuste de hidratos",
  recovery: "Recuperación", structure: "Estructura semanal",
};
const steps = {
  time: { index: 1, title: "¿Cuándo entrenas normalmente?", intro: "Elige el horario más habitual. No pasa nada si cambia a veces." },
  type: { index: 2, title: "¿Qué tipo de sesión predomina?", intro: "Piensa en la carga que más quieres aprender a organizar." },
  problem: { index: 3, title: "¿Qué te cuesta más con la comida?", intro: "Solo buscamos una primera prioridad, no un diagnóstico." },
  contact: { index: 4, title: "Tu resultado y la guía están preparados", intro: "Déjanos un correo para registrar tu resultado y acceder a la guía gratuita." },
};
const inputClass = "w-full rounded-xl border border-[#70445f] bg-[#1b1020] px-4 py-3 text-sm text-white placeholder:text-[#a3889d] focus:border-[#eb4c9b]";

export function GasolinaExperience() {
  const [step, setStep] = useState<Step>("intro");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Partial<GasolinaAnswers>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bookingReady, setBookingReady] = useState(false);
  const [error, setError] = useState("");

  // La agenda solo aparece como CTA si hay huecos reales. No queremos
  // llevar a una reserva vacía cuando Google Calendar no está conectado.
  useEffect(() => {
    if (step !== "result") return;
    fetch("/api/agenda/slots", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setBookingReady(json.ok && Array.isArray(json.slots) && json.slots.length > 0))
      .catch(() => setBookingReady(false));
  }, [step]);

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
    if (step === "time") {
      setAnswers((a) => ({ ...a, trainingTime: value as GasolinaAnswers["trainingTime"] })); setStep("type");
    } else if (step === "type") {
      setAnswers((a) => ({ ...a, sessionType: value as GasolinaAnswers["sessionType"] })); setStep("problem");
    } else if (step === "problem") {
      setAnswers((a) => ({ ...a, mainProblem: value as GasolinaAnswers["mainProblem"] })); setStep("contact");
    }
    setError("");
  }

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !attempt) return;
    if (!answers.trainingTime || !answers.sessionType || !answers.mainProblem || !consent) {
      setError("Completa las preguntas y acepta el aviso de privacidad."); return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/gasolina", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", ...attempt, answers, fullName, email, phone, instagram, consent }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo guardar tu resultado.");
      setResult(data.result as Result); setStep("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "Comprueba tu conexión."); }
    finally { setBusy(false); }
  }

  function share() {
    if (attempt) void fetch("/api/gasolina", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "whatsapp", ...attempt }),
    }).catch(() => {});
    const url = window.location.origin + "/gasolina/guia-comer-segun-tu-wod.pdf";
    window.open("https://wa.me/?text=" + encodeURIComponent("Te comparto GASOLINA, una guía gratuita para comer según tu WOD: " + url), "_blank", "noopener,noreferrer");
  }

  function back() {
    const previous: Partial<Record<Step, Step>> = { time: "intro", type: "time", problem: "type", contact: "problem" };
    setStep(previous[step] || "intro"); setError("");
  }
  const stepData = step !== "intro" && step !== "result" ? steps[step] : null;
  const choices = step === "time" ? TRAINING_TIMES : step === "type" ? SESSION_TYPES : MAIN_PROBLEMS;

  return (
    <main className="al-fallo-booking min-h-screen overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 82% 4%,rgba(230,25,126,.28),transparent 42%), radial-gradient(ellipse at 0% 80%,rgba(118,28,85,.21),transparent 48%), #150b1b" }}>
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-7 sm:px-8 sm:pt-10">
        <header className="flex min-w-0 items-center justify-between gap-3">
          <span className="shrink-0 rounded-2xl border border-[#e6197e]/35 bg-[#e6197e]/10 px-3 py-2.5 text-white sm:px-4"><BrandLogo /></span>
          <span className="max-w-[175px] truncate rounded-full border border-[#77435e] px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wide text-[#f5bddb] sm:max-w-none sm:px-3 sm:text-[10px] sm:tracking-widest">Recurso gratuito · GASOLINA</span>
        </header>

        {step === "intro" && (
          <section className="grid min-w-0 grid-cols-1 items-center gap-14 pb-12 pt-14 md:grid-cols-2 md:pt-20">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#f17bad]/35 bg-[#e6197e]/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#ffb5d7]"><Flame size={15} /> TU NUTRICIÓN, AL NIVEL DE TU ENTRENO</span>
              <h1 className="mt-8 text-[clamp(2.65rem,10vw,5.8rem)] font-black leading-[.98] tracking-[-.06em]">
                DEJA DE<br />IMPROVISAR<br /><span className="al-fallo-gradient-text">TU COMIDA.</span>
              </h1>
              <p className="mt-7 max-w-full text-base leading-relaxed text-[#e7d0df] sm:max-w-xl sm:text-lg">
                Tu entrenamiento cambia cada día. Tu alimentación debería acompañarte.
                Responde 3 preguntas y descubre por dónde empezar a comer según tu WOD.
              </p>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#d7bacc]">
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[#ff8cbd]" /> Resultado inmediato</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[#ff8cbd]" /> Guía PDF (6 páginas)</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-[#ff8cbd]" /> Sin dietas cerradas</span>
              </div>
              <button type="button" disabled={busy} onClick={() => void begin()}
                className="mt-9 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#e6197e] px-7 py-4 text-base font-extrabold shadow-xl shadow-[#e6197e]/20 transition hover:bg-[#f32991] disabled:opacity-50 sm:w-auto">
                {busy ? "Preparando tu test..." : "Quiero mi guía gratis"} <ArrowRight size={20} />
              </button>
              <p className="mt-3 text-xs text-[#b99cae]">Menos de 2 minutos · 100 % gratuito</p>
              {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/35 bg-red-950/30 p-4 text-sm text-red-200">{error}</p>}
            </div>
            <div className="mx-auto min-w-0 w-full max-w-[450px]">
              <div className="relative mx-auto aspect-[.81] w-[84%] -rotate-[5deg] rounded-[26px] border border-[#ff9bca]/40 bg-gradient-to-br from-[#572144] via-[#2c162e] to-[#150b1c] p-7 shadow-[0_35px_90px_rgba(0,0,0,.48)] sm:p-10">
                <div className="flex items-center gap-2 text-[#ff95c5]"><span className="grid h-10 w-10 place-items-center rounded-lg border-2 border-current text-2xl font-black">A</span><span className="text-xl font-black text-white">Al Fallo</span></div>
                <p className="mt-14 text-[11px] font-extrabold uppercase tracking-[.23em] text-[#ff9bcb]">GASOLINA · LA GUÍA</p>
                <p className="mt-5 text-[clamp(2.4rem,4vw,4rem)] font-black leading-[1.05] tracking-[-.065em]">COME<br />SEGÚN<br /><span className="al-fallo-gradient-text">TU WOD.</span></p>
                <p className="absolute bottom-8 left-7 right-7 border-t border-[#9f6283] pt-4 text-[11px] font-semibold text-[#e0b5cd] sm:left-10 sm:right-10">ENERGÍA · HIDRATOS · RECUPERACIÓN</p>
                <span className="absolute -bottom-4 -right-5 rotate-[8deg] rounded-xl border border-[#ffb3d3]/40 bg-[#fbe7f2] px-5 py-3 text-center shadow-xl"><strong className="block text-sm text-[#b21e66]">4 CLAVES</strong><span className="text-[10px] text-[#65435b]">para tu semana real</span></span>
              </div>
            </div>
          </section>
        )}

        {stepData && (
          <section className="mx-auto max-w-2xl pt-12 sm:pt-16">
            <div className="mb-6 flex justify-between text-xs font-bold uppercase tracking-wider text-[#d4b2ca]"><span>Tu plan GASOLINA</span><span>Paso {stepData.index} de 4</span></div>
            <div className="mb-9 h-1.5 overflow-hidden rounded-full bg-[#4f2d45]"><div className="h-full rounded-full bg-gradient-to-r from-[#e6197e] to-[#ff97c8]" style={{ width: String(stepData.index * 25) + "%" }} /></div>
            <div className="rounded-[26px] border border-[#633c57] bg-[#2a192f]/95 p-6 shadow-2xl sm:p-9">
              <h2 className="text-3xl font-black leading-tight tracking-[-.045em] sm:text-4xl">{stepData.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#d6b7ca]">{stepData.intro}</p>
              {step !== "contact" && (
                <div className="mt-8 grid gap-3">
                  {choices.map((option) => (
                    <button type="button" key={option.id} onClick={() => selectOption(option.id)}
                      className="group flex min-h-[70px] items-center justify-between gap-4 rounded-xl border border-[#5c3852] bg-[#37213b] px-5 py-3.5 text-left transition hover:border-[#e6197e] hover:bg-[#4c2945]">
                      <span><strong className="block text-sm font-bold sm:text-base">{option.label}</strong><span className="mt-1 block text-xs text-[#cbaec2]">{option.detail}</span></span>
                      <ArrowRight size={17} className="shrink-0 text-[#c590b0] transition group-hover:translate-x-1 group-hover:text-[#ff9dcb]" />
                    </button>
                  ))}
                </div>
              )}
              {step === "contact" && (
                <form className="mt-8 space-y-4" onSubmit={(e) => void finish(e)}>
                  <div>
                    <label htmlFor="gas-nombre" className="mb-1.5 block text-sm font-semibold text-[#f8e5f0]">Nombre y apellidos *</label>
                    <input id="gas-nombre" className={inputClass} autoComplete="name" required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" />
                  </div>
                  <div>
                    <label htmlFor="gas-email" className="mb-1.5 block text-sm font-semibold text-[#f8e5f0]">Correo electrónico *</label>
                    <input id="gas-email" className={inputClass} type="email" autoComplete="email" required maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="gas-phone" className="mb-1.5 block text-sm font-semibold text-[#f8e5f0]">WhatsApp / teléfono <span className="text-xs font-normal text-[#bba1b3]">Opcional</span></label>
                      <input id="gas-phone" className={inputClass} type="tel" autoComplete="tel" maxLength={35} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34..." />
                    </div>
                    <div>
                      <label htmlFor="gas-ig" className="mb-1.5 block text-sm font-semibold text-[#f8e5f0]">Instagram <span className="text-xs font-normal text-[#bba1b3]">Opcional</span></label>
                      <input id="gas-ig" className={inputClass} maxLength={65} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
                    </div>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-[#72485f] bg-[#211327] p-4 text-xs leading-relaxed text-[#dfcddd]">
                    <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#e6197e]" />
                    <span>He leído el <Link href="/gasolina/privacidad" target="_blank" rel="noopener noreferrer" className="font-bold text-[#ffabd3] underline">aviso de privacidad</Link> y acepto que se guarden mis datos y respuestas para obtener este recurso y mi orientación. No implica aceptar publicidad.</span>
                  </label>
                  <button type="submit" disabled={busy || !consent} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#e6197e] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#f32b91] disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? "Preparando tu resultado..." : "Ver mi resultado y descargar la guía"} <ArrowRight size={18} />
                  </button>
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
            <div className="mb-5 flex justify-center"><span className="inline-flex items-center gap-2 rounded-full border border-[#f48dba]/35 bg-[#e6197e]/10 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-[#ffaad4]"><CheckCircle2 size={16} /> Test completado</span></div>
            <h1 className="text-center text-4xl font-black leading-tight tracking-[-.05em] sm:text-6xl">{fullName.split(/\s+/)[0]}, aquí tienes<br /><span className="al-fallo-gradient-text">tu GASOLINA.</span></h1>
            <p className="mx-auto mt-5 max-w-xl text-center text-sm leading-relaxed text-[#dac2d1]">Estas sugerencias son un punto de partida educativo basado en tus respuestas, no un diagnóstico ni una pauta de nutrición personalizada.</p>
            <div className="mt-10 overflow-hidden rounded-[26px] border border-[#72435e] bg-[#2b192e]">
              <div className="border-b border-[#5c3850] bg-gradient-to-r from-[#592542] to-[#2b192f] p-6 sm:p-9">
                <span className="text-[11px] font-black uppercase tracking-[.19em] text-[#ff9cca]">Tu foco · {names[result.focus]}</span>
                <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{result.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#e9cfdf]">{result.intro}</p>
              </div>
              <div className="p-6 sm:p-9">
                <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-[#ffb4d9]">Tres acciones para empezar</h3>
                <div className="grid gap-3">
                  {result.actions.map((item, i) => (
                    <div key={item} className="flex items-start gap-3 rounded-xl border border-[#5a3750] bg-[#372139] px-4 py-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e6197e]/25 text-xs font-black text-[#ffabd3]">{i + 1}</span>
                      <p className="text-sm leading-relaxed text-[#f2dce9]">{item}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#59374f] bg-[#1e1325] p-4"><p className="mb-2 text-xs font-black uppercase text-[#ff9bca]">Según tu horario</p><p className="text-sm leading-relaxed text-[#ebd3e2]">{result.when}</p></div>
                  <div className="rounded-xl border border-[#59374f] bg-[#1e1325] p-4"><p className="mb-2 text-xs font-black uppercase text-[#ff9bca]">Según tu entrenamiento</p><p className="text-sm leading-relaxed text-[#ebd3e2]">{result.load}</p></div>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-[23px] border border-[#794960] bg-[#3e2240] p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-black uppercase tracking-[.15em] text-[#ffafda]">Tu guía de 6 páginas</p><h3 className="mt-2 text-xl font-black">GASOLINA · Come según tu WOD</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#e0c2d6]">Empieza por {result.chapter}. Contiene ejemplos reales y una checklist para organizar tu próxima semana.</p></div>
                <a href="/gasolina/guia-comer-segun-tu-wod.pdf" download="GASOLINA_Guia_Comer_Segun_Tu_WOD.pdf" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#e6197e] px-5 py-3.5 text-sm font-black text-white hover:bg-[#f32b91]"><Download size={19} /> Descargar mi guía</a>
              </div>
              <div className="mt-5 flex flex-wrap gap-5 border-t border-[#71495e] pt-5">
                <button type="button" onClick={share} className="inline-flex items-center gap-2 text-sm font-semibold text-[#f3d3e4] hover:text-white"><MessageCircle size={18} /> Compartir por WhatsApp</button>
                {bookingReady && <Link href="/agenda" className="inline-flex items-center gap-2 text-sm font-bold text-[#ff9dcb] hover:text-[#ffcee6]">Quiero una valoración individual <ArrowRight size={17} /></Link>}
              </div>
            </div>
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
