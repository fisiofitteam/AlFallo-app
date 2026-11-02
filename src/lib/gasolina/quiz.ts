/**
 * GASOLINA v1: orientación educativa basada únicamente en respuestas declaradas.
 * No calcula calorías, macros personales, IMC ni diagnósticos.
 */
export const TRAINING_TIMES = [
  { id: "morning", label: "Por la mañana", detail: "Antes de empezar el día" },
  { id: "midday", label: "A mediodía", detail: "Entre trabajo y otras tareas" },
  { id: "afternoon", label: "Por la tarde", detail: "Después de comer" },
  { id: "evening", label: "Por la noche", detail: "La última parte del día" },
  { id: "variable", label: "Cada día a una hora", detail: "Mis horarios cambian" },
] as const;

export const SESSION_TYPES = [
  { id: "hard", label: "WOD duro o intervalos", detail: "Mucho esfuerzo en poco tiempo" },
  { id: "strength", label: "Fuerza o técnica", detail: "Cargas y descansos más largos" },
  { id: "endurance", label: "HYROX o cardio largo", detail: "Trabajo sostenido" },
  { id: "double", label: "Doble sesión", detail: "Entreno dos veces en el mismo día" },
  { id: "easy", label: "Entreno suave o descanso", detail: "Carga moderada o baja" },
] as const;

export const MAIN_PROBLEMS = [
  { id: "pre", label: "No sé qué comer antes del WOD", detail: "Me lío con la comida y el horario" },
  { id: "lowEnergy", label: "A veces llego sin energía", detail: "El entreno me pilla sin gasolina" },
  { id: "carbs", label: "No sé cómo ajustar los hidratos", detail: "Como parecido todos los días" },
  { id: "recovery", label: "Me cuesta recuperar", detail: "No sé organizar lo que como después" },
  { id: "afterHunger", label: "Acabo con mucha hambre", detail: "Llego a la siguiente comida arrasando" },
  { id: "week", label: "La semana se me desordena", detail: "Horarios, trabajo y comidas fuera" },
] as const;

export type TrainingTime = (typeof TRAINING_TIMES)[number]["id"];
export type SessionType = (typeof SESSION_TYPES)[number]["id"];
export type MainProblem = (typeof MAIN_PROBLEMS)[number]["id"];
export type Focus = "preworkout" | "carbs" | "recovery" | "structure";

export type GasolinaAnswers = {
  trainingTime: TrainingTime;
  sessionType: SessionType;
  mainProblem: MainProblem;
};

export function isGasolinaAnswers(raw: unknown): raw is GasolinaAnswers {
  if (!raw || typeof raw !== "object") return false;
  const a = raw as Record<string, unknown>;
  return TRAINING_TIMES.some((v) => v.id === a.trainingTime)
    && SESSION_TYPES.some((v) => v.id === a.sessionType)
    && MAIN_PROBLEMS.some((v) => v.id === a.mainProblem);
}

const RESULTS: Record<Focus, { title: string; intro: string; actions: [string, string, string]; chapter: string }> = {
  preworkout: {
    title: "Tu primer ajuste: llegar con energía al WOD",
    intro: "Por lo que nos cuentas, te puede venir bien simplificar qué y cuándo comes antes de entrenar. No necesitas una fórmula perfecta: necesitas una opción que toleres y puedas repetir.",
    actions: ["Prueba una comida completa unas horas antes cuando te sea posible.", "Si entrenas muy cerca de la última comida, valora un snack sencillo que te siente bien.", "Observa energía y molestias digestivas para ajustar en lugar de improvisar."],
    chapter: "Página 2 · Qué comer antes del WOD",
  },
  carbs: {
    title: "Tu primer ajuste: hidratos según la carga",
    intro: "No todos tus días piden lo mismo. Tu siguiente paso puede ser distinguir los entrenamientos exigentes de los suaves y organizar tus raciones con esa información.",
    actions: ["Identifica dos días de mayor carga esta semana.", "Prepara una fuente fácil de hidratos alrededor de esos entrenamientos.", "Evita eliminar carbohidratos por sistema en días suaves o de descanso."],
    chapter: "Página 3 · Ajustar hidratos",
  },
  recovery: {
    title: "Tu primer ajuste: la comida de recuperación",
    intro: "Para recuperar no hace falta un ritual complejo. Puede ayudarte tener una comida o snack post-entreno que encaje con tus horarios y tu siguiente sesión.",
    actions: ["Deja prevista una fuente de proteína y alimentos que te aporten energía.", "Si vuelves a entrenar pronto, presta especial atención a la reposición entre sesiones.", "No olvides rehidratarte, sobre todo si sudas mucho."],
    chapter: "Página 4 · Recuperación post-WOD",
  },
  structure: {
    title: "Tu primer ajuste: un plan que aguante la semana",
    intro: "Si los horarios y las comidas fuera te descolocan, puede ayudarte una estructura flexible antes que más reglas. La idea es decidir con antelación tus opciones fáciles.",
    actions: ["Ten dos comidas rápidas que puedas hacer en días complicados.", "Adapta tu organización cuando cambie la hora del entreno.", "Si un día se tuerce, retoma tu patrón habitual sin compensaciones."],
    chapter: "Página 5 · Cuando la semana se tuerce",
  },
};

const WHEN: Record<TrainingTime, string> = {
  morning: "Como entrenas por la mañana, prueba una opción ligera antes si la toleras y completa el desayuno después.",
  midday: "Al entrenar a mediodía, organiza el desayuno y un tentempié si lo necesitas según la hora exacta.",
  afternoon: "Si entrenas por la tarde, la comida y una merienda sencilla pueden ayudarte a llegar con más estabilidad.",
  evening: "Para sesiones nocturnas, planifica una merienda si hay muchas horas desde la comida y una cena completa después.",
  variable: "Con horarios variables, prepara dos opciones previas: una comida normal si tienes margen y un snack sencillo si vas justo.",
};

const LOAD: Record<SessionType, string> = {
  hard: "Cuando el WOD es duro, revisa si tu día incluye suficiente energía y una fuente de hidratos en torno a la sesión.",
  strength: "En fuerza o técnica, ajusta la comida a la duración y el volumen real, no al nombre del entrenamiento.",
  endurance: "Si haces cardio largo o HYROX, presta atención al volumen total y a la hidratación.",
  double: "Con doble sesión, organiza especialmente la comida y líquidos entre entrenamientos.",
  easy: "En días suaves, mantén una alimentación completa; no necesitas recortar alimentos por obligación.",
};

export function gasolineResult(answers: GasolinaAnswers) {
  const focus: Focus = answers.mainProblem === "pre" || answers.mainProblem === "lowEnergy" ? "preworkout"
    : answers.mainProblem === "carbs" ? "carbs"
    : answers.mainProblem === "recovery" ? "recovery" : "structure";
  return { focus, ...RESULTS[focus], when: WHEN[answers.trainingTime], load: LOAD[answers.sessionType] };
}
