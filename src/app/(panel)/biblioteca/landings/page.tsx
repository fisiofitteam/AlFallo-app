import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, RotateCcw } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { getAgendaLandingCopy, getAgendaGraciasCopy } from "@/lib/landing-config";
import { Field, TextArea, TextInput } from "@/components/form-ui";
import { resetLandingCopy, saveAgendaGraciasCopy, saveAgendaLandingCopy } from "./actions";

export const metadata = { title: "Landings · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function LandingsEditorPage() {
  const prof = await requireProfessional();
  if (prof.role !== "ceo" && prof.role !== "head_coach") redirect("/");

  const [agenda, gracias] = await Promise.all([getAgendaLandingCopy(), getAgendaGraciasCopy()]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/biblioteca" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Biblioteca
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Landings</h1>
        <p className="mt-1 text-muted">
          Edita el texto de la landing pública de agenda y la página de confirmación. Los cambios se ven
          inmediatamente en <Link href="/agenda" className="text-primary underline" target="_blank">/agenda</Link>.
        </p>
      </header>

      {/* ─── LANDING DE AGENDA ─── */}
      <section className="mb-10 rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Landing /agenda</h2>
            <p className="text-sm text-muted">El primer impacto, los datos del equipo y los huecos.</p>
          </div>
          <a
            href="/agenda"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Ver página <ExternalLink size={14} />
          </a>
        </div>

        <form action={saveAgendaLandingCopy} className="space-y-6">
          {/* Hero */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Hero (primera vista)</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Título línea 1" htmlFor="heroTitle1">
                <TextInput id="heroTitle1" name="heroTitle1" defaultValue={agenda.heroTitle1} />
              </Field>
              <Field label="Título línea 2 (acento rosa)" htmlFor="heroTitle2">
                <TextInput id="heroTitle2" name="heroTitle2" defaultValue={agenda.heroTitle2} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Subtítulo (descripción del hero)" htmlFor="heroSubtitle">
                <TextArea id="heroSubtitle" name="heroSubtitle" defaultValue={agenda.heroSubtitle} />
              </Field>
            </div>
          </div>

          {/* Autoridad */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Autoridad / quiénes sois</h3>
            <Field label="Titular" htmlFor="authorityTitle">
              <TextInput id="authorityTitle" name="authorityTitle" defaultValue={agenda.authorityTitle} />
            </Field>
            <div className="mt-3">
              <Field label="Texto de autoridad" htmlFor="authorityText">
                <TextArea id="authorityText" name="authorityText" defaultValue={agenda.authorityText} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Foto del equipo (URL)" htmlFor="groupImageUrl" hint="Opcional: pega una URL pública (Vercel Blob, Imgur, etc.)">
                <TextInput
                  id="groupImageUrl"
                  name="groupImageUrl"
                  type="url"
                  defaultValue={agenda.groupImageUrl}
                  placeholder="https://…/equipo.jpg"
                />
              </Field>
            </div>
          </div>

          {/* Stats */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Cifras (3 cajas)</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                  <Field label={`Cifra ${i + 1} (valor)`} htmlFor={`stats_${i}_value`}>
                    <TextInput
                      id={`stats_${i}_value`}
                      name={`stats_${i}_value`}
                      defaultValue={agenda.stats[i]?.value ?? ""}
                    />
                  </Field>
                  <div className="mt-2">
                    <Field label={`Etiqueta ${i + 1}`} htmlFor={`stats_${i}_label`}>
                      <TextInput
                        id={`stats_${i}_label`}
                        name={`stats_${i}_label`}
                        defaultValue={agenda.stats[i]?.label ?? ""}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bloques (opcionales) */}
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Bloques libres (testimonios / casos)</h3>
            <p className="mb-3 text-xs text-muted">Hasta 3 bloques. Deja vacío el que no quieras mostrar.</p>
            <div className="space-y-3">
              {[0, 1, 2].map((i) => {
                const b = agenda.blocks[i];
                return (
                  <div key={i} className="rounded-xl border border-border p-3">
                    <p className="mb-2 text-xs font-semibold text-muted">Bloque {i + 1}</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Título" htmlFor={`block_${i}_title`}>
                        <TextInput id={`block_${i}_title`} name={`block_${i}_title`} defaultValue={b?.title ?? ""} />
                      </Field>
                      <Field label="Imagen (URL)" htmlFor={`block_${i}_imageUrl`}>
                        <TextInput
                          id={`block_${i}_imageUrl`}
                          name={`block_${i}_imageUrl`}
                          defaultValue={b?.imageUrl ?? ""}
                          placeholder="Opcional"
                        />
                      </Field>
                    </div>
                    <div className="mt-2">
                      <Field label="Texto del bloque" htmlFor={`block_${i}_text`}>
                        <TextArea id={`block_${i}_text`} name={`block_${i}_text`} defaultValue={b?.text ?? ""} />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <ResetForm id="agenda" />
            <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
              Guardar landing de agenda
            </button>
          </div>
        </form>
      </section>

      {/* ─── LANDING DE GRACIAS ─── */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Landing /agenda/gracias</h2>
            <p className="text-sm text-muted">Lo que ve el lead tras reservar (vídeo, pasos, política).</p>
          </div>
          <a
            href="/agenda/gracias"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Ver página <ExternalLink size={14} />
          </a>
        </div>

        <form action={saveAgendaGraciasCopy} className="space-y-6">
          {/* Saludo */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Saludo</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Título (con nombre)" htmlFor="heroTitleWithName" hint="Usa {nombre} donde quieras que aparezca">
                <TextInput id="heroTitleWithName" name="heroTitleWithName" defaultValue={gracias.heroTitleWithName} />
              </Field>
              <Field label="Título (sin nombre)" htmlFor="heroTitleNoName">
                <TextInput id="heroTitleNoName" name="heroTitleNoName" defaultValue={gracias.heroTitleNoName} />
              </Field>
              <Field label="Texto reserva con fecha" htmlFor="reservedWithDate" hint="Usa {fecha}">
                <TextInput id="reservedWithDate" name="reservedWithDate" defaultValue={gracias.reservedWithDate} />
              </Field>
              <Field label="Texto reserva sin fecha" htmlFor="reservedNoDate">
                <TextInput id="reservedNoDate" name="reservedNoDate" defaultValue={gracias.reservedNoDate} />
              </Field>
            </div>
          </div>

          {/* Cómo será la llamada */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Cómo será la llamada</h3>
            <Field label="Título" htmlFor="callTitle">
              <TextInput id="callTitle" name="callTitle" defaultValue={gracias.callTitle} />
            </Field>
            <div className="mt-3">
              <Field label="Texto" htmlFor="callText">
                <TextArea id="callText" name="callText" defaultValue={gracias.callText} />
              </Field>
            </div>
          </div>

          {/* Vídeo */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Vídeo previo</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Badge (ej. IMPORTANTE)" htmlFor="videoBadge">
                <TextInput id="videoBadge" name="videoBadge" defaultValue={gracias.videoBadge} />
              </Field>
              <Field label="Título del vídeo" htmlFor="videoTitle">
                <TextInput id="videoTitle" name="videoTitle" defaultValue={gracias.videoTitle} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Texto de introducción al vídeo" htmlFor="videoIntro">
                <TextArea id="videoIntro" name="videoIntro" defaultValue={gracias.videoIntro} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="ID de YouTube" htmlFor="videoId" hint='Ejemplo: en "youtu.be/DnEAQXs09BI" el ID es DnEAQXs09BI. Deja vacío para no mostrar vídeo.'>
                <TextInput id="videoId" name="videoId" defaultValue={gracias.videoId} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Bullets del vídeo (uno por línea)" htmlFor="videoBullets">
                <TextArea
                  id="videoBullets"
                  name="videoBullets"
                  rows={4}
                  defaultValue={gracias.videoBullets.join("\n")}
                />
              </Field>
            </div>
          </div>

          {/* Cómo prepararse */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Cómo prepararse</h3>
            <Field label="Título" htmlFor="prepTitle">
              <TextInput id="prepTitle" name="prepTitle" defaultValue={gracias.prepTitle} />
            </Field>
            <div className="mt-3">
              <Field label="Texto" htmlFor="prepText">
                <TextArea id="prepText" name="prepText" defaultValue={gracias.prepText} />
              </Field>
            </div>
          </div>

          {/* Pasos */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pasos previos a la llamada</h3>
            <Field label="Título de la sección" htmlFor="stepsTitle">
              <TextInput id="stepsTitle" name="stepsTitle" defaultValue={gracias.stepsTitle} />
            </Field>
            <div className="mt-3">
              <Field label="Pasos (uno por línea, en orden)" htmlFor="steps">
                <TextArea id="steps" name="steps" rows={5} defaultValue={gracias.steps.join("\n")} />
              </Field>
            </div>
          </div>

          {/* Política */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Política de cancelación</h3>
            <Field label="Título" htmlFor="policyTitle">
              <TextInput id="policyTitle" name="policyTitle" defaultValue={gracias.policyTitle} />
            </Field>
            <div className="mt-3">
              <Field label="Texto" htmlFor="policyText">
                <TextArea id="policyText" name="policyText" defaultValue={gracias.policyText} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Aviso / warning" htmlFor="policyWarning">
                <TextArea id="policyWarning" name="policyWarning" defaultValue={gracias.policyWarning} />
              </Field>
            </div>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Contacto</h3>
            <Field label="Texto introductorio" htmlFor="contactText">
              <TextInput id="contactText" name="contactText" defaultValue={gracias.contactText} />
            </Field>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="WhatsApp" htmlFor="whatsappNumber" hint="Ej. +34621495367">
                <TextInput id="whatsappNumber" name="whatsappNumber" defaultValue={gracias.whatsappNumber} />
              </Field>
              <Field label="Instagram (sin @)" htmlFor="instagramHandle">
                <TextInput id="instagramHandle" name="instagramHandle" defaultValue={gracias.instagramHandle} />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <ResetForm id="agenda_gracias" />
            <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
              Guardar landing de gracias
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ResetForm({ id }: { id: string }) {
  return (
    <form action={resetLandingCopy}>
      <input type="hidden" name="id" value={id} />
      <button
        title="Restablecer al texto por defecto"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
      >
        <RotateCcw size={14} /> Restablecer por defecto
      </button>
    </form>
  );
}
