/** GASOLINA v2 · orientaciones educativas, no diagnóstico ni dieta personalizada. */
export const TRAINING_TIMES = [
  { id: "morning", label: "Por la mañana", detail: "Antes de empezar el día" },
  { id: "midday", label: "A mediodía", detail: "Entre trabajo y otras tareas" },
  { id: "afternoon", label: "Por la tarde", detail: "Después de comer" },
  { id: "evening", label: "Por la noche", detail: "La última parte del día" },
  { id: "variable", label: "A horas distintas", detail: "Mis horarios cambian mucho" },
] as const;
export const SESSION_TYPES = [
  { id: "hard", label: "WOD duro o intervalos", detail: "Alta intensidad, poca pausa" },
  { id: "strength", label: "Fuerza o técnica", detail: "Cargas, descansos y trabajo técnico" },
  { id: "endurance", label: "HYROX o cardio largo", detail: "Resistencia sostenida" },
  { id: "double", label: "Doble sesión", detail: "Dos entrenamientos el mismo día" },
  { id: "easy", label: "Suave o descanso", detail: "Carga de entrenamiento moderada o baja" },
] as const;
export const MAIN_PROBLEMS = [
  { id: "pre", label: "No sé qué comer antes del WOD", detail: "Dudo con los horarios y las cantidades" },
  { id: "lowEnergy", label: "Llego sin energía a entrenar", detail: "Me cuesta dar lo mejor durante la sesión" },
  { id: "carbs", label: "No sé ajustar los hidratos", detail: "Mi comida no cambia aunque el entreno sí" },
  { id: "recovery", label: "Me cuesta recuperar", detail: "No sé qué priorizar después" },
  { id: "afterHunger", label: "Acabo con mucha hambre", detail: "Se me hace difícil llegar bien a la siguiente comida" },
  { id: "week", label: "Se me desordena la semana", detail: "Trabajo, imprevistos y comidas fuera" },
] as const;
export const OBJECTIVES = [
  { id: "marks", label: "Rendir más y mejorar mis marcas", detail: "Tener recursos cuando el WOD aprieta" },
  { id: "body", label: "Mejorar mi composición corporal", detail: "Sin dejar de rendir ni vivir a dieta" },
  { id: "energy", label: "Tener energía en el box y el resto del día", detail: "No acabar agotado/a cada tarde" },
  { id: "flexible", label: "Comer bien sin renunciar a mi vida", detail: "Un plan que se adapte a mí" },
] as const;
export const WEEK_PATTERNS = [
  { id: "lowFuel", label: "A veces entreno sin comer suficiente antes", detail: "Salgo con prisa y lo dejo al azar" },
  { id: "samePlate", label: "Como parecido en días muy distintos", detail: "Da igual si toca técnica o un WOD duro" },
  { id: "unplanned", label: "Acabo improvisando casi cada comida", detail: "El trabajo y los horarios mandan" },
  { id: "lateHunger", label: "Llego al final del día con muchísima hambre", detail: "Me cuesta repartir las comidas" },
] as const;
export const BLOCKERS = [
  { id: "structure", label: "Me falta organización", detail: "No tengo un esquema sencillo al que recurrir" },
  { id: "knowledge", label: "No sé qué priorizar", detail: "Hay demasiadas recomendaciones diferentes" },
  { id: "time", label: "No tengo tiempo para prepararlo todo", detail: "Necesito opciones prácticas" },
  { id: "consistency", label: "Me cuesta mantenerlo con el paso de las semanas", detail: "Empiezo bien, luego se me complica" },
] as const;

export type TrainingTime = (typeof TRAINING_TIMES)[number]["id"];
export type SessionType = (typeof SESSION_TYPES)[number]["id"];
export type MainProblem = (typeof MAIN_PROBLEMS)[number]["id"];
export type Objective = (typeof OBJECTIVES)[number]["id"];
export type WeekPattern = (typeof WEEK_PATTERNS)[number]["id"];
export type Blocker = (typeof BLOCKERS)[number]["id"];
export type Focus = "preworkout" | "carbs" | "recovery" | "structure";
export type GasolinaAnswers = {
  trainingTime: TrainingTime;
  sessionType: SessionType;
  mainProblem: MainProblem;
  objective: Objective;
  weekPattern: WeekPattern;
  blocker: Blocker;
};
export function isGasolinaAnswers(raw: unknown): raw is GasolinaAnswers {
  if (!raw || typeof raw !== "object") return false;
  const a = raw as Record<string, unknown>;
  return TRAINING_TIMES.some((o) => o.id === a.trainingTime)
    && SESSION_TYPES.some((o) => o.id === a.sessionType)
    && MAIN_PROBLEMS.some((o) => o.id === a.mainProblem)
    && OBJECTIVES.some((o) => o.id === a.objective)
    && WEEK_PATTERNS.some((o) => o.id === a.weekPattern)
    && BLOCKERS.some((o) => o.id === a.blocker);
}
export const FOCUS_NAMES: Record<Focus, string> = {
  preworkout: "Energía antes del WOD",
  carbs: "Hidratos y carga de entrenamiento",
  recovery: "Recuperación entre sesiones",
  structure: "Organización que encaja contigo",
};
const RESULTS: Record<Focus, {
  title: string; intro: string; actions: [string, string, string];
  example: string; mistake: string; opportunity: string;
}> = {
  preworkout: {
    title: "Tienes margen para llegar con más energía al WOD",
    intro: "Por tus respuestas, merece la pena empezar por cómo llegas alimentado/a al entrenamiento. No se trata de comer más a ciegas: se trata de ajustar el momento y las opciones a tu horario y tolerancia.",
    actions: [
      "Si tienes tres o cuatro horas, prueba una comida normal con hidratos y una fuente de proteína.",
      "Si solo tienes 30–90 minutos y necesitas algo, elige una opción sencilla que toleres bien.",
      "Observa energía, molestias digestivas y sensaciones en dos entrenamientos similares.",
    ],
    example: "Si entrenas al salir del trabajo, puedes planear una merienda fácil —por ejemplo pan con mermelada o yogur con cereales— según el margen y tu digestión.",
    mistake: "Llegar al box con muchas horas sin comer y esperar que un café lo arregle siempre.",
    opportunity: "Una estrategia previa más consistente puede ayudarte a aprovechar mejor tus entrenos sin complicar todo tu día.",
  },
  carbs: {
    title: "Tu comida puede acompañar mejor la carga de tus entrenos",
    intro: "Tu semana no exige la misma energía cada día. Lo interesante es aprender a diferenciar sesiones duras, suaves y días con poco margen de recuperación, sin convertir la comida en un examen.",
    actions: [
      "Señala cuáles son realmente tus dos o tres entrenamientos de mayor volumen.",
      "Organiza fuentes de hidratos accesibles alrededor de las sesiones más exigentes.",
      "En los días suaves, adapta porciones según actividad y apetito sin prohibir alimentos.",
    ],
    example: "Un día de intervalos largos o HYROX puede pedir una planificación de hidratos distinta a un día corto de técnica; arroz, pan, patata, fruta o cereales pueden encajar.",
    mistake: "Comer exactamente igual con independencia de la duración y la carga, o recortar hidratos por miedo a ganar grasa.",
    opportunity: "Aprender a distribuir energía según el trabajo real puede ayudarte a entrenar con más recursos y recuperarte de forma más consistente.",
  },
  recovery: {
    title: "Tu siguiente avance puede empezar después de entrenar",
    intro: "La recuperación no es solo un batido post-WOD. También influyen lo que has comido durante el día, el descanso y el tiempo que queda hasta tu siguiente sesión.",
    actions: [
      "Deja lista una comida con proteína, alimentos que te aporten energía y líquidos.",
      "Si vuelves a entrenar en pocas horas, presta más atención a lo que comes y bebes entre sesiones.",
      "Revisa si pasas demasiado tiempo entre el WOD y tu siguiente comida por falta de organización.",
    ],
    example: "Después de una sesión exigente: arroz o patata + pollo, pescado o tofu + fruta. Si sales con prisa, un bocadillo sencillo puede ayudarte hasta una comida completa.",
    mistake: "Pensar que solo cuenta lo que tomas en los primeros 20 minutos, ignorando el conjunto del día.",
    opportunity: "Tener una rutina post-entreno fácil de cumplir puede ayudarte a llegar más preparado/a a la siguiente sesión.",
  },
  structure: {
    title: "Lo que necesitas es una alimentación que sobreviva a tu semana",
    intro: "Si tus días cambian, una pauta rígida suele darte más trabajo que soluciones. Tu punto de partida puede ser preparar alternativas flexibles que no choquen con entrenar, trabajar y tener vida.",
    actions: [
      "Define dos comidas y dos snacks fáciles de resolver incluso en días de mucho trabajo.",
      "Crea una opción A si entrenas a tu hora y una opción B si la sesión cambia.",
      "Cuando comas fuera o tengas un imprevisto, continúa con normalidad en la siguiente comida.",
    ],
    example: "Una base simple: comida preparada de arroz/patata + proteína, fruta para llevar y una merienda alternativa para los días en los que la sesión se retrasa.",
    mistake: "Creer que si una comida cambia, toda la semana está perdida y hay que compensar después.",
    opportunity: "Tener un sistema flexible puede ayudarte a dedicar más cabeza a tus marcas y menos a decidir qué comer cada día.",
  },
};
const WHEN: Record<TrainingTime, string> = {
  morning: "Para los entrenos tempranos, valora un snack pequeño antes si te sienta bien y un desayuno completo después.",
  midday: "A mediodía, organiza la primera parte del día para no llegar sin haber comido nada si necesitas energía.",
  afternoon: "Si entrenas por la tarde, la comida y una merienda sencilla pueden ayudarte a llegar mejor preparado/a.",
  evening: "Con entrenamiento nocturno, planifica una opción antes si hay muchas horas desde la comida y cena después.",
  variable: "Con horarios cambiantes, ten dos opciones previas: comida completa cuando hay margen y snack fácil si vas justo/a.",
};
const LOAD: Record<SessionType, string> = {
  hard: "Para WODs intensos, revisa si has comido suficiente y dispones de hidratos en torno a la sesión.",
  strength: "Con fuerza y técnica, ajusta las raciones al volumen real, no solo al nombre del entrenamiento.",
  endurance: "En HYROX o cardio prolongado, la planificación global de energía, hidratos e hidratación cobra más importancia.",
  double: "Con doble sesión, hay menos margen entre esfuerzos: merece la pena planificar lo que comes y bebes entre ellos.",
  easy: "En días suaves, mantén una alimentación completa. No necesitas eliminar alimentos como castigo por entrenar menos.",
};
const OBJECTIVE_COPY: Record<Objective, string> = {
  marks: "Quieres que tu alimentación acompañe el trabajo que haces para mejorar tus marcas. Eso empieza por tener energía disponible, recuperar y repetir hábitos útiles, no por una dieta perfecta.",
  body: "Quieres cambiar tu composición corporal sin sentir que la alimentación limita tus entrenos o tu vida. El contexto, las cantidades y la constancia importan más que las prohibiciones.",
  energy: "Buscas llegar con energía al WOD y conservarla para el resto del día. Merece la pena revisar la distribución de comidas, el descanso y la carga global.",
  flexible: "Quieres dejar de elegir entre cuidarte y disfrutar de tus planes. Una estructura adaptable a tus horarios tiene más posibilidades de sostenerse.",
};
const BLOCKER_COPY: Record<Blocker, string> = {
  structure: "Empieza con una plantilla de comidas básica para tus entrenamientos más habituales.",
  knowledge: "No necesitas memorizar normas: aprende primero a distinguir una sesión exigente de una suave y qué comida te sienta bien.",
  time: "Prioriza comidas de pocos ingredientes y opciones que puedas preparar o comprar fácilmente.",
  consistency: "Diseña un mínimo que puedas mantener incluso durante semanas complicadas. La flexibilidad no es fallar.",
};
export function gasolineResult(answers: GasolinaAnswers) {
  const score: Record<Focus, number> = { preworkout: 0, carbs: 0, recovery: 0, structure: 0 };
  const base: Record<MainProblem, Focus> = {
    pre: "preworkout", lowEnergy: "preworkout", carbs: "carbs",
    recovery: "recovery", afterHunger: "recovery", week: "structure",
  };
  score[base[answers.mainProblem]] += 4;
  const patterns: Record<WeekPattern, Focus> = {
    lowFuel: "preworkout", samePlate: "carbs", unplanned: "structure", lateHunger: "recovery",
  };
  score[patterns[answers.weekPattern]] += 2;
  if (answers.objective === "energy") score.preworkout++;
  if (answers.objective === "marks") score.carbs++;
  if (answers.objective === "flexible") score.structure++;
  if (answers.objective === "body") score.structure++;
  if (answers.sessionType === "double") score.recovery++;
  if (answers.sessionType === "endurance") score.carbs++;
  if (answers.trainingTime === "variable") score.structure++;
  if (answers.blocker === "time" || answers.blocker === "structure" || answers.blocker === "consistency") score.structure++;
  if (answers.blocker === "knowledge") score.carbs++;
  const ordered: Focus[] = ["preworkout", "carbs", "recovery", "structure"];
  const focus = ordered.reduce((best, key) => score[key] > score[best] ? key : best, base[answers.mainProblem]);
  return {
    focus, focusName: FOCUS_NAMES[focus], ...RESULTS[focus],
    when: WHEN[answers.trainingTime], load: LOAD[answers.sessionType],
    ambition: OBJECTIVE_COPY[answers.objective],
    nextHabit: BLOCKER_COPY[answers.blocker],
  };
}

export const WEB_GUIDE = [
  {
    id: "pre", badge: "01 / Antes de entrenar", title: "Come antes para llegar con gasolina",
    text: "El tiempo que queda hasta el WOD cambia qué puedes tolerar. No es obligatorio comer justo antes si ya llegas bien alimentado/a, pero tampoco conviene pasar hambre por sistema.",
    examples: ["3–4 h antes: comida completa con hidratos + proteína (arroz y pollo, pasta y atún).", "1–2 h antes: opción más ligera (pan con pavo y fruta, yogur con cereales).", "30–60 min antes: si lo necesitas, un snack pequeño y fácil de digerir."],
    tip: "Prueba la opción en entrenamientos normales antes de usarla en una competición.",
  },
  {
    id: "carbs", badge: "02 / Hidratos y carga", title: "No todos tus WODs piden lo mismo",
    text: "Una sesión larga, de intervalos exigentes o una doble sesión puede requerir más energía que una técnica breve. Ajustar no es eliminar hidratos en descanso.",
    examples: ["WOD duro: planifica una fuente de hidratos en comidas cercanas al entrenamiento.", "Fuerza o técnica suave: usa la carga real y tu apetito para ajustar las porciones.", "HYROX o doble sesión: presta atención a la energía total y al intervalo entre entrenos."],
    tip: "Arroz, patata, pasta, pan, fruta o cereales son herramientas, no alimentos buenos o malos.",
  },
  {
    id: "recovery", badge: "03 / Después de entrenar", title: "Recupera sin complicarte la vida",
    text: "El conjunto del día pesa más que una supuesta ventana de 20 minutos. Proteína, energía suficiente, líquidos y descanso importan para llegar mejor a la siguiente sesión.",
    examples: ["En casa: patata o arroz + pescado, huevos o tofu + verduras.", "Con prisa: bocadillo con una fuente de proteína y fruta.", "Si entrenas otra vez pronto: planifica qué comer y beber entre sesiones."],
    tip: "No necesitas suplementos para convertir una comida normal en una buena comida post-entreno.",
  },
  {
    id: "structure", badge: "04 / La semana real", title: "Tu nutrición tiene que encajar en tu vida",
    text: "Trabajo, viajes, comidas fuera, familia y WODs que cambian: el plan útil es el que se adapta sin obligarte a compensar cuando algo sale distinto.",
    examples: ["Prepara dos comidas que puedas repetir sin aburrirte.", "Ten un snack de emergencia para días con menos margen.", "Si cenas fuera, continúa con normalidad al día siguiente, sin restricciones compensatorias."],
    tip: "La flexibilidad y la constancia suelen ser más sostenibles que perseguir la perfección.",
  },
] as const;
