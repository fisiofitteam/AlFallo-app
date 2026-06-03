import { redirect } from "next/navigation";

// La raíz de /biblioteca no tiene contenido propio: el layout ya pinta
// header + tabs. Redirigimos al primer tab para que la URL refleje el estado.
export default function BibliotecaIndex() {
  redirect("/biblioteca/alimentos");
}
