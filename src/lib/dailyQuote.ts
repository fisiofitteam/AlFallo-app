// Banco de frases motivacionales que rotan por día. La home del cliente pinta
// arriba una frase corta. Para que sea estable durante todo el día (sin que
// "salte" al refrescar) usamos el día del año como índice → la misma frase
// para todo el calendario natural.
//
// Mantenemos las frases en español casual de España, con la idea de "Al Fallo"
// (sin culpas, sin perfeccionismo). Si se quieren cambiar, basta editar el
// array; el orden no importa porque rotamos por día.

const QUOTES: { head: string; tail: string }[] = [
  { head: "Lo difícil era empezar.", tail: "Ya estás aquí." },
  { head: "Hoy no toca ser perfecto.", tail: "Toca ser constante." },
  { head: "Suma un día más.", tail: "Eso es lo único que cuenta." },
  { head: "Tu peor día sigue siendo entrenamiento.", tail: "Sigue." },
  { head: "Sin culpa, sin drama.", tail: "Mañana otra vez." },
  { head: "Comer bien no es castigo.", tail: "Es respeto." },
  { head: "Los resultados llegan a quien se queda.", tail: "Quédate." },
  { head: "Lo importante no es el plan.", tail: "Es cumplirlo." },
  { head: "Avanza, aunque sea poco.", tail: "Eso ya es ganar." },
  { head: "Nadie va a hacerlo por ti.", tail: "Por suerte." },
  { head: "El cuerpo se acuerda de cada comida.", tail: "También de las buenas." },
  { head: "Dieta no es restricción.", tail: "Es elección." },
  { head: "Si caes, vuelves.", tail: "Eso es entrenar." },
  { head: "No cuentes calorías.", tail: "Cuenta hábitos." },
  { head: "Pequeño, sostenido, real.", tail: "Así se cambia." },
  { head: "El progreso se nota en lo que aguantas.", tail: "No en lo que prometes." },
  { head: "Hoy es un buen día.", tail: "Como todos los demás." },
  { head: "Tu mejor versión no llega de golpe.", tail: "Llega cada día." },
  { head: "Más simple. Más realista.", tail: "Más tuyo." },
  { head: "No empieces el lunes.", tail: "Empieza hoy." },
  { head: "Lo que no se mide, se olvida.", tail: "Apunta el check-in." },
  { head: "Comer fuera no rompe nada.", tail: "Olvidarte sí." },
  { head: "Entrenar y comer son la misma cosa.", tail: "Ambas, casi todos los días." },
  { head: "Una comida no engorda.", tail: "Una semana, tampoco." },
  { head: "Hoy es para sumar.", tail: "Mañana también." },
  { head: "Si estás cansado, descansa.", tail: "No abandones." },
  { head: "Cada plato cuenta.", tail: "No al revés." },
  { head: "Lo bueno se construye lento.", tail: "Lo rápido se cae igual." },
  { head: "Confía en el proceso.", tail: "Y haz tu parte." },
  { head: "Vas a llegar.", tail: "Pero hoy toca esto." },
];

/** Devuelve la frase del día en zona horaria Madrid. Misma frase desde las
 *  00:00 hasta las 23:59 — no salta al refrescar. */
export function getDailyQuote(date: Date = new Date()): { head: string; tail: string } {
  // Día del año (1-366) en Europa/Madrid. Lo construimos sin libs:
  // ajustamos a Madrid restando el offset y nos quedamos con la parte de fecha.
  const madrid = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const start = new Date(madrid.getFullYear(), 0, 0);
  const diff = madrid.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (24 * 60 * 60 * 1000));
  const idx = dayOfYear % QUOTES.length;
  return QUOTES[idx];
}
