import { prisma } from "@/lib/prisma";

export const AI_BRIEF_ID = "singleton";

export type AiBrief = {
  brand: string;
  voiceTone: string;
  dos: string;
  donts: string;
  structureHints: string;
  goodExamples: string;
  badExamples: string;
};

// Fallback embebido con la voz de marca de Al Fallo Nutrition Performance.
// Si nadie ha editado el brief en la BD, el Marketer IA se apoya en este.
// Cuando el usuario edita la fila `AiContentBrief` en `/contenido/marketer/brief`,
// el fallback deja de usarse (BD tiene prioridad).
const AL_FALLO_DEFAULT_BRIEF: AiBrief = {
  brand: `AL FALLO NUTRITION PERFORMANCE — nutrición online premium para atletas amateur de CrossFit / Hyrox.

Gran idea: "Si haces lo que toca, el resultado es prácticamente inevitable. No por magia: por sistema."
Promesa: "Resultados adaptados a tu vida y no al revés."

CLIENTE IDEAL
- 30–50 años, vida laboral sedentaria pero apasionado del CrossFit / Hyrox. Competidor amateur.
- Clase media solvente. Ambicioso con su físico y su rendimiento.
- Dolor principal: falta de ESTRUCTURA real, no falta de conocimiento. Vive en modo "todo o nada", saturado de info de redes, e inconsistente en el tiempo.
- Subtexto emocional: quiere ganar al de al lado del box, verse los abdominales, dejar de ser "alguien que empieza y abandona". Sentir que "he cambiado de verdad".
- Frases literales que piensa: "Me noto en forma pero no consigo abdomen"; "Tanto esfuerzo para nada"; "Este mes lo iba a hacer bien".

DIFERENCIAL
- Seguimiento SEMANAL real (no mensual): reporte con métricas cada 7 días.
- Videollamada cada 15–20 días.
- App propia + IA entrenada por el equipo. Comunidad.

RESULTADO ESPERADO
- 3 meses: energía + adherencia + "se ha convertido en la persona que sí logra resultados".
- 6 meses: cambio notorio en físico, rendimiento y autoestima.

CTA DE VENTA: escribir PERFORMANCE al DM (nunca "Premium", "Pro" o "Avanzado").`,

  voiceTone: `Personalidad: cercana, premium (no pijo), educativa, aspiracional, divulgativa, flexible, realista.

Cómo suena: urbano, conversacional, directo. "Sin postureo, ni brusca. Alguna palabrota suelta permitida (joder, hostia, mierda) SIN abusar. Palabras de calle/barrio si encajan. Nada forzado."

Reglas de forma:
- Frases cortas. Cero párrafos densos. Habla como en WhatsApp a un colega del box.
- Preguntas retóricas y expresiones conversacionales: "mira", "te cuento", "el tema es", "la realidad es esta", "si haces lo que toca".
- Tecnicismos SOLO si se explican en la misma frase. Si dices "glucógeno", aclaras qué es.
- Tutea siempre. Cero "usted", cero formal, cero paper académico.

NIVEL DE CONFRONTACIÓN: 7/10
- Sí: cuestionar mitos directamente, posicionarse fuerte ("yo no soy de las que te quitan el arroz"), opinar sobre prácticas del sector ("los retos de 21 días son una estafa de adherencia").
- No: atacar por nombre a otros profesionales/marcas, insultar a la audiencia, clickbait sucio.

TONO SEGÚN PIEZA
- Reel de mito: directo, ligeramente provocador. "Te van a contar X, la realidad es Y".
- Reel de identificación: cercano, "si esto te suena, sigue leyendo".
- Carrusel didáctico: premium-educativo, claro, paso a paso, sin palabrotas.
- Story día a día: casi mensaje de WhatsApp.
- Caption de venta: premium + directo, con confianza sin presión.

Referencias de comunicación que INSPIRAN: @elcoachnutricional, @thesaiyankiwi, @fitness.revolucionario, @lahiperactina, @doctorabellan, @carol_satorres_nutricion, @marcosbernabeu (técnico-divulgativo, posicionado, sin pose).

De las que NO se quiere parecer: fitness genérico, coach motivacional cursi, paper académico, cuentas de "amor propio" sin criterio.

TEST antes de publicar: léelo en voz alta. Si suena a influencer fitness genérico, coach motivacional, paper académico o cuenta cursi → reescribe.`,

  dos: `- Habla de "rendimiento", "estructura", "sistema", "adherencia", "vida real", "acompañamiento", "recomposición".
- Vocabulario del cliente: "atleta", "box" (NUNCA "gimnasio"), "WOD", "compe", "competidor amateur".
- Habla de "tu mejor versión", "adaptado a tu vida", "sin valles, sin bajones, sin empezar de cero".
- Metodología: "seguimiento semanal", "ajuste semanal", "criterio profesional", "progresivo, sostenible, medible".
- Conversacionales: "te explico", "te cuento", "mira", "la realidad es esta", "el tema es", "si haces lo que toca".
- Alguna palabrota suelta puntual (joder, hostia, mierda) para dar naturalidad — nunca como muletilla.
- En venta: siempre menciona el nombre COMPLETO "AL FALLO NUTRITION PERFORMANCE" y el CTA "Escribe PERFORMANCE al DM".
- Cierra siempre con CTA claro y concreto (guardar / comentar / compartir / escribir PERFORMANCE).`,

  donts: `PROMESAS PROHIBIDAS (nunca aparecen)
- "resultados garantizados" / "100% asegurado".
- "transformación milagrosa" / "pierde X kilos en Y semanas".
- "el método definitivo" / "el secreto que nadie te cuenta".
- "dieta detox" / "depurar" / "limpiar el cuerpo".
- Retos de 21 días o similares.

FITNESS/GYM GENÉRICO (prohibido)
- "fit", "fitness lifestyle", "tonificar", "quemar grasa", "quemagrasas".
- "comer limpio" / "clean eating" / "comida basura" como insulto moral.
- "cheat meal" (la marca lo rechaza como concepto).
- "bestia", "máquina", "killer" en tono motivacional vacío.

CURSI / MOTIVACIONAL BARATO
- "creer es crear", "tú puedes con todo", "el único límite eres tú", "haz que valga la pena".
- Emojis 💪🔥💯 en exceso (1 puntual está bien, 5 es cursi).

TECNICISMOS SIN TRADUCIR
- Ratios de macros sin contexto. "Termogénesis adaptativa" a pelo. Jerga académica.

REGLAS ROJAS
- Nunca prometer resultados garantizados: el cliente asume su responsabilidad.
- Nunca asociar la marca a fitness/gym, dietas detox, retos rápidos.
- Nunca atacar por nombre a otros profesionales o marcas.
- Nunca tono cursi, ñoño, ni excesivamente técnico.
- Nunca "Premium", "Pro" o "Avanzado" — es AL FALLO NUTRITION PERFORMANCE.`,

  structureHints: `LOS 8 PILARES DE CONTENIDO (distribución orientativa semanal)
1. Educación nutricional para atletas (20%) — hidratos, proteína, peri-entreno, déficit, recomposición, hambre, báscula. Tono educativo + cercano.
2. Rendimiento (15%) — errores pre/post entreno, cargas de hidratos, estrategia entre WODs. Técnico-divulgativo.
3. Recomposición corporal (15%) — mitos de pérdida de grasa, "tonificar", báscula, déficit agresivo. Directo, confrontación 7.
4. Adherencia y vida real (15%) — findes, cumpleaños, viajes, turnos, comidas fuera, "todo o nada". Muy cercano.
5. Autoridad y metodología (10%) — por qué seguimiento semanal > mensual, check-in con métricas, app + IA, sistema vs disciplina. Premium-educativo.
6. Prueba social (10%) — testimonios de cambio físico, rendimiento, energía, relación con la comida. Cercano, con contexto.
7. Venta y servicio (10%) — para quién es / para quién no, qué incluye, resultados a 3/6 meses. CTA "Escribe PERFORMANCE".
8. Marca personal y conexión (5%) — por qué CrossFit/Hyrox, día a día, valores. Humano, sin pose.

DURANTE LANZAMIENTO: pilar 7 sube al 30–40% y el resto se reequilibra.

ESTRUCTURA HABITUAL DE UNA SEMANA
- Lunes: hook de identificación o pregunta de encuesta (adherencia / recomposición).
- Martes: mito vs realidad (educación o recomposición).
- Miércoles: educativo profundo (carrusel didáctico) o error pre/post entreno.
- Jueves: caso / testimonio o autoridad metodológica.
- Viernes: venta o CTA a lead magnet, cierre con "Escribe PERFORMANCE".
- Sábado/Domingo: día a día personal o encuesta conversacional.

FORMATOS PREFERIDOS
- Reel (30–60s): hook 0-3s + cuerpo + cierre/CTA. Una sola idea por reel. Frases cortas y concretas, ejemplos reales.
- Carrusel (6–10 slides): portada gancho, contexto, cuerpo (una idea por slide), síntesis, CTA. Sin palabrotas.
- Stories: secuencias de 3–7. Muy WhatsApp. Encuestas para engagement. Sticker DM en ventas.

GRAN IDEA QUE ATRAVIESA TODO
"No fallas por falta de conocimiento ni por falta de fuerza de voluntad. Fallas por falta de estructura. Y una estructura adaptada a tu vida es lo que cambia todo."`,

  goodExamples: `EJEMPLO A — REEL EDUCATIVO
Hook: "Te han dicho que los hidratos engordan. Es mentira. Y te explico por qué."
Cuerpo: Los hidratos son tu gasolina. Si entrenas CrossFit o Hyrox y los quitas, lo primero que notas no es perder grasa — es bajón de fuerza, peor recuperación y arrastrarte por el box. Lo que engorda no son los hidratos: es comer más de lo que gastas, vengan de donde vengan. Si entrenas 5 días necesitas hidratos. Sí o sí.
CTA: "Guárdatelo para cuando alguien te diga lo contrario."
Pilar: 1 + 3.

EJEMPLO B — CARRUSEL DE VENTA (Pilar 7 + 4)
Slide 1: "ENTRENAS DURO. NO CAMBIAS NADA." / "Y no es por falta de esfuerzo."
Slide 2: "No es falta de info. Sabes que necesitas proteína. Sabes que el déficit existe. Has visto 200 reels. El problema es otro."
Slide 3: "No es falta de fuerza de voluntad. Si fuera eso, apretarías. Llevas años apretando. Sigues igual."
Slide 4: "Es falta de ESTRUCTURA. Un sistema que aguante tu vida real. Turnos, viajes, cumpleaños, semanas locas. Sin sistema cada lunes empiezas de cero."
Slide 5: "¿Por qué nadie te lo soluciona? Porque te dan una pauta y te ven dentro de un mes. Entre medias se cae todo."
Slide 6: "La diferencia: que te acompañen SEMANA a SEMANA. Ajustar en caliente. Ver qué pasa cada 7 días, no cada 30."
Slide 7: "No es magia. Es sistema. Si haces lo que toca, el resultado es prácticamente inevitable."
Slide 8: "¿Listo para dejar de fallar? AL FALLO NUTRITION PERFORMANCE. Escribe PERFORMANCE al DM y te cuento si encajas."

EJEMPLO C — CAPTION DE VENTA
"Este mes lo iba a hacer bien." Y otra vez nada. No es que no sepas. No es que no quieras. Llevas años intentándolo. Lo que te falta es estructura. Un sistema que aguante turnos, cenas, viajes, findes. Sin eso, cada lunes empiezas de cero — y al mes ya estás igual. AL FALLO NUTRITION PERFORMANCE es eso: seguimiento real semana a semana. No es para todo el mundo. Es para gente que entrena en serio y está cansada de probar cosas. Si te ves ahí, hablamos. Escribe PERFORMANCE al DM.`,

  badExamples: `NO ESCRIBAS ASÍ (contenido AI-slop que rechazamos)
- "En este nuevo vídeo os traigo 5 tips increíbles para que consigáis vuestro cuerpo soñado 💪🔥" → cursi, motivacional vacío, plural formal, emojis en exceso.
- "Descubre el secreto que los influencers de fitness no quieren que sepas" → clickbait sucio, promesa de "secreto", asociación fitness genérica.
- "Con esta dieta detox de 21 días vas a limpiar tu cuerpo y sentirte on fire" → dieta detox + reto 21 días + "limpiar el cuerpo" + inglés motivacional. Todo prohibido.
- "Recuerda: creer es crear. ¡Tú puedes con todo!" → cursi puro, motivacional barato.
- "Los macronutrientes son moléculas orgánicas cuya termogénesis adaptativa…" → tecnicismos sin traducir, tono académico.
- Reels llamando a la audiencia "bestias", "máquinas", "killers" en tono motivacional vacío.
- Vender con "quedan 3 plazas" sin contexto ni historia previa.
- Copiar recursos de growth hacking de 2019: "doble click si te ha gustado", "tag a un amigo que…".`,
};

export async function getAiBrief(): Promise<AiBrief> {
  const row = await prisma.aiContentBrief.findUnique({ where: { id: AI_BRIEF_ID } });
  if (!row) return AL_FALLO_DEFAULT_BRIEF;
  // Si el CEO ha editado alguna sección la respetamos; si dejó una en blanco
  // rellenamos con el fallback para no perder base de marca.
  return {
    brand: row.brand || AL_FALLO_DEFAULT_BRIEF.brand,
    voiceTone: row.voiceTone || AL_FALLO_DEFAULT_BRIEF.voiceTone,
    dos: row.dos || AL_FALLO_DEFAULT_BRIEF.dos,
    donts: row.donts || AL_FALLO_DEFAULT_BRIEF.donts,
    structureHints: row.structureHints || AL_FALLO_DEFAULT_BRIEF.structureHints,
    goodExamples: row.goodExamples || AL_FALLO_DEFAULT_BRIEF.goodExamples,
    badExamples: row.badExamples || AL_FALLO_DEFAULT_BRIEF.badExamples,
  };
}

export async function updateAiBrief(
  patch: Partial<AiBrief>,
  updatedById?: string | null,
): Promise<AiBrief> {
  const row = await prisma.aiContentBrief.upsert({
    where: { id: AI_BRIEF_ID },
    update: { ...patch, updatedById: updatedById ?? undefined },
    create: {
      id: AI_BRIEF_ID,
      brand: patch.brand ?? "",
      voiceTone: patch.voiceTone ?? "",
      dos: patch.dos ?? "",
      donts: patch.donts ?? "",
      structureHints: patch.structureHints ?? "",
      goodExamples: patch.goodExamples ?? "",
      badExamples: patch.badExamples ?? "",
      updatedById: updatedById ?? undefined,
    },
  });
  return {
    brand: row.brand,
    voiceTone: row.voiceTone,
    dos: row.dos,
    donts: row.donts,
    structureHints: row.structureHints,
    goodExamples: row.goodExamples,
    badExamples: row.badExamples,
  };
}

