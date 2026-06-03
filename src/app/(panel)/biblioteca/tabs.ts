// Definición de tabs de /biblioteca. Vive en un archivo aparte para poder
// importarse desde el layout (server) y desde el componente cliente del nav.

export type LibraryTab = {
  href: string;
  label: string;
  emoji: string;
};

export const LIBRARY_TABS: LibraryTab[] = [
  { href: "/biblioteca/alimentos", label: "Alimentos", emoji: "🥦" },
  { href: "/biblioteca/recetas", label: "Recetas", emoji: "🍳" },
  { href: "/biblioteca/videos", label: "Vídeos", emoji: "🎥" },
  { href: "/biblioteca/landings", label: "Landings", emoji: "🌐" },
];
