// Parsea URLs de YouTube/Vimeo y devuelve la URL embebible para iframe.
export type ParsedVideo = {
  provider: "youtube" | "vimeo" | "unknown";
  id: string | null;
  embedUrl: string | null;
  thumbnail: string | null;
};

const EMPTY: ParsedVideo = { provider: "unknown", id: null, embedUrl: null, thumbnail: null };

export function parseVideo(rawUrl: string | null | undefined): ParsedVideo {
  if (!rawUrl) return EMPTY;
  const url = rawUrl.trim();

  // YouTube
  const ytPatterns = [
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const re of ytPatterns) {
    const m = url.match(re);
    if (m) {
      return {
        provider: "youtube",
        id: m[1],
        embedUrl: `https://www.youtube.com/embed/${m[1]}`,
        thumbnail: `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`,
      };
    }
  }

  // Vimeo (no expone thumbnail por URL directa; queda null).
  const vimeoPatterns = [/vimeo\.com\/(\d+)/, /player\.vimeo\.com\/video\/(\d+)/];
  for (const re of vimeoPatterns) {
    const m = url.match(re);
    if (m) {
      return {
        provider: "vimeo",
        id: m[1],
        embedUrl: `https://player.vimeo.com/video/${m[1]}`,
        thumbnail: null,
      };
    }
  }

  return EMPTY;
}
