import { redirect } from "next/navigation";

// La vista antigua "Esta semana" (ThisWeekView) se ha retirado. La entrada
// raíz del panel de contenido lleva directamente al calendario, que es
// ahora la vista principal de planificación.
export default function ContentIndex() {
  redirect("/contenido/calendario");
}
