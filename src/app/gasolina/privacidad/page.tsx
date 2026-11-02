import Link from "next/link";
import { BrandLogo } from "@/components/brand-mark";
export const metadata = { title: "Privacidad · GASOLINA | Al Fallo" };

export default function PrivacyPage() {
  return <main className="min-h-screen bg-[#170d1c] px-5 py-10 text-white">
    <div className="mx-auto max-w-3xl">
      <Link href="/gasolina" className="inline-block text-[#ff9ecf]"><BrandLogo /></Link>
      <h1 className="mt-10 text-3xl font-extrabold tracking-tight">Privacidad del recurso GASOLINA</h1>
      <p className="mt-3 text-sm text-[#e2cadc]">Información sobre el tratamiento de datos al solicitar la guía para comer según tu WOD.</p>
      <div className="mt-7 space-y-6 rounded-2xl border border-[#69405a] bg-[#2b192e] p-6 text-sm leading-relaxed text-[#f1ddec] sm:p-8">
        <section><h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Responsable y finalidad</h2><p>Al Fallo Nutrition gestiona este recurso. Utiliza tus datos para facilitar el acceso a la guía, mostrarte un resultado educativo y atender las solicitudes relacionadas con él.</p></section>
        <section><h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Datos que se registran</h2><p>Al iniciar el test registramos únicamente un inicio anónimo. Al finalizar, si aceptas, guardamos tu nombre, correo electrónico y las tres respuestas. Teléfono e Instagram son opcionales. También registramos el origen de campaña y, si lo utilizas, el clic en compartir por WhatsApp. No accedemos a tus conversaciones de WhatsApp.</p></section>
        <section><h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Consentimiento y publicidad</h2><p>La base del tratamiento es el consentimiento que prestas al completar el formulario. Solicitar esta guía no implica suscribirse a comunicaciones publicitarias. Puedes retirar el consentimiento y solicitar la supresión de tus datos.</p></section>
        <section><h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Conservación y proveedores</h2><p>Los datos se conservarán durante el tiempo necesario para gestionar la solicitud y los posibles requisitos legales. La aplicación utiliza servicios técnicos de alojamiento y base de datos, incluidos Vercel y Neon.</p></section>
        <section><h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Tus derechos</h2><p>Puedes solicitar acceso, rectificación, supresión, oposición o limitación mediante el canal de contacto oficial de Al Fallo Nutrition por el que recibiste este recurso. Puedes acudir a la Agencia Española de Protección de Datos si consideras vulnerados tus derechos.</p></section>
        <section><h2 className="mb-1.5 text-base font-bold text-[#ffafd6]">Alcance del resultado</h2><p>Se trata de información educativa para personas adultas activas. No constituye un diagnóstico ni un plan dietético individualizado.</p></section>
      </div>
      <Link href="/gasolina" className="mt-7 inline-block text-sm font-bold text-[#ff9ac9] underline">← Volver al test</Link>
    </div>
  </main>;
}
