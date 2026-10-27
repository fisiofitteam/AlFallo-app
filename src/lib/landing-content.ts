// Copy editable de las landings de Al Fallo Nutrition. Tipos + valores por
// defecto + sustitución de variables. Sin dependencias de servidor (se puede
// importar en cliente).

// ============================================================================
// Landing de RENOVACIÓN (post-conversión: el cliente renueva su programa).
// ============================================================================

export type RenewalLandingCopy = {
  headline: string;
  subheadline: string;
  bullets: string[];
  ctaLabel: string;
  reassurance: string;
};

// Variables disponibles en el copy: {nombre} {programa} {meses} {importe}
export const RENEWAL_LANDING_DEFAULTS: RenewalLandingCopy = {
  headline: "{nombre}, tu progreso no se detiene aquí",
  subheadline:
    "Renueva tu plan y sigue construyendo sobre lo que ya has conseguido, con tu nutricionista al lado semana a semana.",
  bullets: [
    "Tu plan sigue adaptándose a ti, semana a semana",
    "Mantienes el seguimiento directo de tu nutricionista",
    "No pierdes la constancia ni el progreso que ya tienes",
  ],
  ctaLabel: "Renovar mi plan",
  reassurance: "Pago seguro con Stripe · Sigues con el mismo equipo de siempre",
};

export function normalizeRenewalCopy(raw: unknown): RenewalLandingCopy {
  const d = RENEWAL_LANDING_DEFAULTS;
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v : fallback;
  const bullets = Array.isArray(o.bullets)
    ? (o.bullets as unknown[]).map((b) => String(b)).filter((b) => b.trim() !== "")
    : d.bullets;
  return {
    headline: str(o.headline, d.headline),
    subheadline: str(o.subheadline, d.subheadline),
    bullets: bullets.length ? bullets : d.bullets,
    ctaLabel: str(o.ctaLabel, d.ctaLabel),
    reassurance: str(o.reassurance, d.reassurance),
  };
}

export function applyVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// ============================================================================
// Landing de CONTRATAR (post-venta). Copy general + por programa.
// ============================================================================

export type ContractProgramCopy = { title: string; subtitle: string; bullets: string[] };
export type ContractLandingCopy = {
  headline: string;
  subheadline: string;
  footer: string;
  programs: { ESENCIAL: ContractProgramCopy; PRO: ContractProgramCopy };
};

export const CONTRACT_LANDING_DEFAULTS: ContractLandingCopy = {
  headline: "Aquí tienes tu plan",
  subheadline: "El precio y la duración son los que acordamos en la videollamada.",
  footer: "¿Algo no encaja con lo que hablamos? Escríbenos por WhatsApp antes de pagar.",
  programs: {
    ESENCIAL: {
      title: "Programa ESENCIAL",
      subtitle: "Recompón tu nutrición sin volverte loca/o",
      bullets: [
        "Plan nutricional 100% personalizado a tu objetivo y a tus entrenos",
        "Tu nutricionista asignado, en seguimiento semanal",
        "Acceso a la app de Al Fallo: tu plan, check-ins y progreso",
        "Chat directo con tu nutricionista para resolver dudas",
        "Adaptado a tu deporte (CrossFit, Hyrox, running…)",
      ],
    },
    PRO: {
      title: "Programa PRO",
      subtitle: "Rendimiento al máximo, día a día",
      bullets: [
        "Plan + ajustes finos según fases (volumen, definición, competición)",
        "Tu nutricionista asignado, en seguimiento semanal con revisión personalizada",
        "Biblioteca de recetas y lista de la compra automática",
        "Chat directo con tu nutricionista, prioridad de respuesta",
        "Revisión periódica de composición corporal y rendimiento",
      ],
    },
  },
};

function normalizeProgram(raw: any, def: ContractProgramCopy): ContractProgramCopy {
  const o = raw && typeof raw === "object" ? raw : {};
  const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v : fb);
  const bullets = Array.isArray(o.bullets)
    ? o.bullets.map((b: unknown) => String(b)).filter((b: string) => b.trim() !== "")
    : def.bullets;
  return {
    title: str(o.title, def.title),
    subtitle: str(o.subtitle, def.subtitle),
    bullets: bullets.length ? bullets : def.bullets,
  };
}

export function normalizeContractCopy(raw: unknown): ContractLandingCopy {
  const d = CONTRACT_LANDING_DEFAULTS;
  const o = (raw && typeof raw === "object" ? raw : {}) as any;
  const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v : fb);
  return {
    headline: str(o.headline, d.headline),
    subheadline: str(o.subheadline, d.subheadline),
    footer: str(o.footer, d.footer),
    programs: {
      ESENCIAL: normalizeProgram(o.programs?.ESENCIAL, d.programs.ESENCIAL),
      PRO: normalizeProgram(o.programs?.PRO, d.programs.PRO),
    },
  };
}

// ============================================================================
// Landing de AGENDA (reserva videoconsulta). Hero + autoridad + credenciales.
// ============================================================================

export type AgendaStat = { value: string; label: string };
export type AgendaBlock = { id: string; title: string; text: string; imageUrl: string };
export type AgendaLandingCopy = {
  heroTitle1: string;
  heroTitle2: string; // segunda línea (en color de marca)
  heroSubtitle: string;
  authorityTitle: string;
  authorityText: string;
  groupImageUrl: string; // foto del equipo; "" = placeholder
  stats: AgendaStat[]; // exactamente 3
  blocks: AgendaBlock[]; // bloques libres (testimonios, casos…)
};

export const AGENDA_LANDING_DEFAULTS: AgendaLandingCopy = {
  heroTitle1: "TU NUTRICIÓN,",
  heroTitle2: "AL NIVEL DE TU ENTRENO.",
  heroSubtitle:
    "Entrenas duro. Tu alimentación también debería acompañarte. Reserva una valoración gratuita con el equipo de Al Fallo para descubrir cómo ajustar tu nutrición a tu objetivo, tus horarios y tu carga de entrenamiento.",
  authorityTitle: "Nutrición pensada para quien entrena",
  authorityText:
    "Tanto si haces crosstraining como HYROX o fuerza, te ayudamos a alinear tus comidas con tu carga de entrenamiento, tu recuperación y tus objetivos. Sin dietas genéricas ni menús desconectados de tu día a día.",
  groupImageUrl: "",
  stats: [
    { value: "01", label: "Valoración individual" },
    { value: "02", label: "Estrategia a tu medida" },
    { value: "03", label: "Seguimiento nutricional" },
  ],
  blocks: [],
};

// ============================================================================
// Landing de CONFIRMACIÓN de reserva (/agenda/gracias).
// ============================================================================

export type AgendaGraciasCopy = {
  heroTitleWithName: string; // usa {nombre}
  heroTitleNoName: string;
  reservedWithDate: string; // usa {fecha}
  reservedNoDate: string;
  callTitle: string;
  callText: string;
  videoBadge: string;
  videoTitle: string;
  videoIntro: string;
  videoId: string; // ID de YouTube
  videoBullets: string[];
  prepTitle: string;
  prepText: string;
  stepsTitle: string;
  steps: string[];
  policyTitle: string;
  policyText: string;
  policyWarning: string;
  contactText: string;
  whatsappNumber: string;
  instagramHandle: string;
};

export const AGENDA_GRACIAS_DEFAULTS: AgendaGraciasCopy = {
  heroTitleWithName: "Listo, {nombre}.",
  heroTitleNoName: "Reserva confirmada",
  reservedWithDate: "Tu videoconsulta está reservada para el {fecha}.",
  reservedNoDate: "Tu videoconsulta está reservada.",
  callTitle: "Cómo será tu videoconsulta",
  callText:
    "Será una llamada de 45-60 minutos con una nutricionista de Al Fallo.\n\nHablaremos de cómo entrenas, cómo comes ahora y qué te está limitando. Saldrás con claridad sobre qué cambiar y cómo, y si encajamos, te diremos cómo trabajaríamos juntos.",
  videoBadge: "IMPORTANTE",
  videoTitle: "Mira esto antes de la llamada",
  videoIntro:
    "Hemos preparado un vídeo corto para que llegues con todo el contexto. Es la mejor forma de aprovechar cada minuto de la sesión:",
  videoId: "", // pendiente de grabar
  videoBullets: [
    "Conocerás cómo trabajamos y nuestra metodología",
    "Llegarás con las preguntas correctas",
    "Aprovecharás cada minuto de la videoconsulta",
  ],
  prepTitle: "Cómo prepararte",
  prepText:
    "Busca un sitio tranquilo, sin distracciones. Evita conectarte por la calle o conduciendo: necesitamos toda tu atención. Si entrenas un día concreto pre/post-WOD, reserva fuera de ese rato para estar despejada/o.",
  stepsTitle: "Qué pasará antes de la llamada",
  steps: [
    "El equipo revisará la información que nos has facilitado para preparar tu valoración.",
    "Recibirás la invitación de Google Calendar con el enlace de Google Meet en el correo de la reserva.",
    "A la hora acordada, entra desde la invitación y prepárate para comentar tus objetivos de nutrición y entrenamiento.",
  ],
  policyTitle: "Política de cancelación",
  policyText:
    "Atendemos a un número muy limitado de personas cada semana. Si reservas, comprométete con tu cita.\n\nSi necesitas cancelar o reprogramar, avísanos con la mayor antelación posible. Liberamos tu hueco para otra persona que también lo está esperando.",
  policyWarning:
    "⚠️ Importante: si no acudes sin avisar, no podrás volver a agendar con nosotros. Nuestro tiempo es limitado y solo trabajamos con personas verdaderamente comprometidas con su nutrición.",
  contactText: "¿Te ha surgido un imprevisto o tienes dudas antes de la llamada?",
  whatsappNumber: "", // pendiente — el CEO lo edita desde Biblioteca
  instagramHandle: "", // pendiente — el CEO lo edita desde Biblioteca
};

export function normalizeAgendaGraciasCopy(raw: unknown): AgendaGraciasCopy {
  const d = AGENDA_GRACIAS_DEFAULTS;
  const o = (raw && typeof raw === "object" ? raw : {}) as any;
  const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v : fb);
  const optStr = (v: unknown) => (typeof v === "string" ? v : "");
  const list = (v: unknown, fb: string[]) => {
    if (!Array.isArray(v)) return fb;
    const arr = v.map((x) => String(x)).filter((x) => x.trim() !== "");
    return arr.length ? arr : fb;
  };
  return {
    heroTitleWithName: str(o.heroTitleWithName, d.heroTitleWithName),
    heroTitleNoName: str(o.heroTitleNoName, d.heroTitleNoName),
    reservedWithDate: str(o.reservedWithDate, d.reservedWithDate),
    reservedNoDate: str(o.reservedNoDate, d.reservedNoDate),
    callTitle: str(o.callTitle, d.callTitle),
    callText: str(o.callText, d.callText),
    videoBadge: str(o.videoBadge, d.videoBadge),
    videoTitle: str(o.videoTitle, d.videoTitle),
    videoIntro: str(o.videoIntro, d.videoIntro),
    videoId: optStr(o.videoId),
    videoBullets: list(o.videoBullets, d.videoBullets),
    prepTitle: str(o.prepTitle, d.prepTitle),
    prepText: str(o.prepText, d.prepText),
    stepsTitle: str(o.stepsTitle, d.stepsTitle),
    steps: list(o.steps, d.steps),
    policyTitle: str(o.policyTitle, d.policyTitle),
    policyText: str(o.policyText, d.policyText),
    policyWarning: str(o.policyWarning, d.policyWarning),
    contactText: str(o.contactText, d.contactText),
    whatsappNumber: optStr(o.whatsappNumber),
    instagramHandle: optStr(o.instagramHandle),
  };
}

export function normalizeAgendaCopy(raw: unknown): AgendaLandingCopy {
  const d = AGENDA_LANDING_DEFAULTS;
  const o = (raw && typeof raw === "object" ? raw : {}) as any;
  const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v : fb);
  const optStr = (v: unknown) => (typeof v === "string" ? v : "");
  const rawStats = Array.isArray(o.stats) ? o.stats : [];
  const stats: AgendaStat[] = [0, 1, 2].map((i) => ({
    value: str(rawStats[i]?.value, d.stats[i].value),
    label: str(rawStats[i]?.label, d.stats[i].label),
  }));
  const rawBlocks = Array.isArray(o.blocks) ? o.blocks : [];
  const blocks: AgendaBlock[] = [];
  rawBlocks.forEach((b: any, i: number) => {
    if (!b || typeof b !== "object") return;
    const title = optStr(b.title);
    const text = optStr(b.text);
    const imageUrl = optStr(b.imageUrl);
    if (!title.trim() && !text.trim() && !imageUrl.trim()) return;
    blocks.push({ id: typeof b.id === "string" && b.id ? b.id : `b_${i}`, title, text, imageUrl });
  });
  return {
    heroTitle1: str(o.heroTitle1, d.heroTitle1),
    heroTitle2: str(o.heroTitle2, d.heroTitle2),
    heroSubtitle: str(o.heroSubtitle, d.heroSubtitle),
    authorityTitle: str(o.authorityTitle, d.authorityTitle),
    authorityText: str(o.authorityText, d.authorityText),
    groupImageUrl: optStr(o.groupImageUrl),
    stats,
    blocks,
  };
}
