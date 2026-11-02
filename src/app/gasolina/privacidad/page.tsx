import Link from "next/link";
export const metadata = { title: "Privacidad · GASOLINA | Al Fallo" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#170d1c] px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/gasolina" className="inline-block">
          <img src="/gasolina/al-fallo-logo.svg" alt="Al Fallo Nutrition" className="h-24 w-auto" />
        </Link>
        <h1 className="mt-7 text-3xl font-extrabold tracking-tight">Privacidad del recurso GASOLINA</h1>
        <p className="mt-3 text-sm text-[#e2cadc]">
          Información sobre el tratamiento de datos al completar la orientación interactiva para comer según tu WOD.
        </p>
        <div className="mt-7 space-y-6 rounded-2xl border border-[#69405a] bg-[#2b192e] p-6 text-sm leading-relaxed text-[#f1ddec] sm:p-8">
          <section>
            <h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Responsable y finalidad</h2>
            <p>Al Fallo Nutrition gestiona este recurso educativo. Utilizamos la información facilitada
              exclusivamente para mostrar y registrar tu resultado, comprender qué áreas interesan a quienes usan
              GASOLINA y atender las solicitudes que hagas de forma voluntaria.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Qué datos se registran</h2>
            <p>Al comenzar se registra un inicio del test sin nombre ni datos de contacto. Al completarlo,
              guardamos tu nombre y apellidos, tus seis respuestas, y tu usuario de Instagram solo si decides
              proporcionarlo. No pedimos correo electrónico ni teléfono. También podemos registrar la campaña
              de procedencia y si pulsaste el enlace de WhatsApp; no podemos saber si enviaste el mensaje.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Uso y comunicaciones</h2>
            <p>Los datos se tratan para atender tu petición de resultado interactivo, de manera limitada
              a esa finalidad. No quedas suscrito/a a publicidad, no se te envían mensajes comerciales
              automáticamente y tus respuestas no se incorporan por defecto al CRM comercial.
              Solo iniciarás una conversación de WhatsApp si pulsas el botón y después decides enviar el mensaje.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Conservación y proveedores</h2>
            <p>Los datos se guardan durante el tiempo necesario para gestionar este servicio y atender
              solicitudes o responsabilidades que correspondan, revisando periódicamente su necesidad.
              La aplicación emplea proveedores técnicos como Vercel y Neon.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Derechos y contacto</h2>
            <p>Puedes solicitar acceso, rectificación, supresión, limitación u oposición, según proceda,
              escribiendo al contacto oficial de Al Fallo Nutrition:
              <a className="ml-1 font-semibold text-[#ffadd1] underline" href="mailto:Jessmoya@alfallonutrition.com">
                Jessmoya@alfallonutrition.com
              </a>. También puedes reclamar ante la Agencia Española de Protección de Datos.</p>
          </section>
          <section>
            <h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Alcance del resultado</h2>
            <p>Es información nutricional educativa de carácter general para personas adultas activas.
              No constituye un diagnóstico ni un plan individualizado; ante necesidades clínicas específicas,
              consulta con un profesional cualificado.</p>
          </section>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-[#bba6b5]">
          Puedes consultar también la
          <a href="https://alfallonutrition.com/politica-de-privacidad" target="_blank" rel="noopener noreferrer" className="ml-1 underline">
            política de privacidad general de Al Fallo Nutrition
          </a>.
        </p>
        <Link href="/gasolina" className="mt-7 inline-block text-sm font-bold text-[#ff9ac9] underline">← Volver al test</Link>
      </div>
    </main>
  );
}
