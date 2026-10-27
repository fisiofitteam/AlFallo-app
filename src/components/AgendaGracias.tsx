"use client";

import { applyVars, type AgendaGraciasCopy } from "@/lib/landing-content";
import { BrandLogo } from "@/components/brand-mark";

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  const dayName = d.toLocaleDateString("es-ES", { weekday: "long", timeZone: "Europe/Madrid" });
  const day = d.toLocaleDateString("es-ES", { day: "numeric", timeZone: "Europe/Madrid" });
  const month = d.toLocaleDateString("es-ES", { month: "long", timeZone: "Europe/Madrid" });
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  return `${dayName} ${day} de ${month} a las ${time}`;
}

export function AgendaGracias({
  startISO,
  firstName,
  copy,
}: {
  startISO: string | null;
  firstName: string | null;
  copy: AgendaGraciasCopy;
}) {
  const dateLabel = startISO ? formatDateLong(startISO) : null;
  const WHATSAPP_LINK = `https://wa.me/${copy.whatsappNumber.replace(/[^0-9]/g, "")}`;
  const INSTAGRAM_HANDLE = copy.instagramHandle;
  const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}`;
  const PRE_CALL_VIDEO_ID = copy.videoId;

  return (
    <main
      className="al-fallo-booking min-h-screen relative"
      style={{
        backgroundColor: "#130b17",
        backgroundImage: "radial-gradient(ellipse at 84% 0%, rgba(230,25,126,.26), transparent 42%), linear-gradient(160deg,#1d0e20,#110a17)",
        color: "#FAFAFA",
      }}
    >
      {/* Overlay sutil para que la imagen del box se vea con buena legibilidad */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(10,5,15,.05),rgba(10,5,15,.2))", pointerEvents: "none" }}
      />

      <div className="relative max-w-2xl mx-auto px-5 py-10 pb-20">
        {/* ━━━ Confirmación inicial ━━━ */}
        <section className="text-center mb-8">
          <div className="mb-6 flex justify-center"><span className="rounded-2xl border border-[#e6197e]/30 bg-[#e6197e]/10 px-5 py-3 text-white"><BrandLogo/></span></div>
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.4)" }}
          >
            <span style={{ fontSize: 32 }}>✓</span>
          </div>
          <h1
            className="font-bold leading-none mb-4"
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              letterSpacing: "-0.035em",
            }}
          >
            {firstName ? applyVars(copy.heroTitleWithName, { nombre: firstName }) : copy.heroTitleNoName}
          </h1>
          <p className="text-sm sm:text-base" style={{ color: "#f0dbe7" }}>
            {dateLabel ? applyVars(copy.reservedWithDate, { fecha: dateLabel }) : copy.reservedNoDate}
          </p>
        </section>

        {/* ━━━ Cómo será tu videoconsulta ━━━ */}
        <section
          className="rounded-2xl p-5 sm:p-6 mb-4"
          style={{ background: "rgba(39, 22, 43, 0.88)", border: "1px solid #41283e", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 20 }}>📋</span>
            <h2 className="text-base sm:text-lg font-semibold">{copy.callTitle}</h2>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#f0dbe7" }}>
            {copy.callText}
          </p>
        </section>

        {/* Vídeo opcional: solo aparece cuando dirección haya configurado uno. */}
        {PRE_CALL_VIDEO_ID && <section
          className="rounded-2xl p-5 sm:p-6 mb-4"
          style={{ background: "rgba(39, 22, 43, 0.88)", border: "1px solid #41283e", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded"
              style={{ background: "#ff83bb", color: "#5a123a" }}
            >
              {copy.videoBadge}
            </span>
            <h2 className="text-base sm:text-lg font-semibold">{copy.videoTitle}</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: "#d2b8c9" }}>
            {copy.videoIntro}
          </p>
          <div
            className="rounded-lg overflow-hidden mb-4"
            style={{ aspectRatio: "16/9", background: "#000" }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${PRE_CALL_VIDEO_ID}?rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <ul className="space-y-1.5 text-sm" style={{ color: "#d2b8c9" }}>
            {copy.videoBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span style={{ color: "#86EFAC" }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>}

        {/* ━━━ Cómo prepararte ━━━ */}
        <section
          className="rounded-2xl p-5 sm:p-6 mb-4"
          style={{ background: "rgba(39, 22, 43, 0.88)", border: "1px solid #41283e", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 20 }}>📍</span>
            <h2 className="text-base sm:text-lg font-semibold">{copy.prepTitle}</h2>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#d2b8c9" }}>
            {copy.prepText}
          </p>
        </section>

        {/* ━━━ Qué pasará antes de la llamada ━━━ */}
        <section
          className="rounded-2xl p-5 sm:p-6 mb-4"
          style={{ background: "rgba(39, 22, 43, 0.88)", border: "1px solid #41283e", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span style={{ fontSize: 20 }}>⏱</span>
            <h2 className="text-base sm:text-lg font-semibold">{copy.stepsTitle}</h2>
          </div>

          <ol className="space-y-4 text-sm">
            {copy.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: "#41283e", color: "#FAFAFA" }}
                >
                  {i + 1}
                </span>
                <div className="whitespace-pre-line" style={{ color: "#d2b8c9" }}>{s}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* ━━━ Política de cancelación ━━━ */}
        <section
          className="rounded-2xl p-5 sm:p-6 mb-4"
          style={{
            background: "rgba(127, 29, 29, 0.15)",
            border: "1px solid rgba(252, 165, 165, 0.25)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 20 }}>🚫</span>
            <h2 className="text-base sm:text-lg font-semibold">{copy.policyTitle}</h2>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#f0dbe7" }}>
            {copy.policyText}
          </p>
          <div
            className="rounded-lg p-3 mt-3"
            style={{
              background: "rgba(127, 29, 29, 0.25)",
              border: "1px solid rgba(252, 165, 165, 0.4)",
            }}
          >
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#FCA5A5" }}>
              {copy.policyWarning}
            </p>
          </div>
        </section>

        {/* ━━━ Contacto / reprogramar ━━━ */}
        <section
          className="rounded-2xl p-5 text-sm"
          style={{
            background: "rgba(20, 20, 20, 0.7)",
            border: "1px solid #41283e",
            backdropFilter: "blur(8px)",
          }}
        >
          <p className="text-center mb-4" style={{ color: "#d2b8c9" }}>
            {copy.contactText}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {!copy.whatsappNumber && !INSTAGRAM_HANDLE && <p className="text-xs text-[#d2b8c9]">El equipo te contactará con los datos que has facilitado en la reserva.</p>}
            {copy.whatsappNumber && <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center justify-center gap-2"
              style={{ background: "#25D366", color: "#0A0A0A" }}
            >
              <span style={{ fontSize: 16 }}>💬</span> Escríbenos por WhatsApp
            </a>}
            {INSTAGRAM_HANDLE && <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm rounded-lg px-4 py-2.5 flex items-center justify-center gap-2"
              style={{
                background: "rgba(47, 27, 50, 0.78)",
                border: "1px solid #5a3854",
                color: "#f0dbe7",
              }}
            >
              <span style={{ fontSize: 16 }}>📷</span> @{INSTAGRAM_HANDLE}
            </a>}
          </div>
        </section>

        <footer className="mt-10 text-center text-xs" style={{ color: "#bea5b7" }}>
          Al Fallo Nutrition · Nutrición deportiva online · {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
