"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Heart, MessageCircle, Send, Image as ImageIcon, X, BadgeCheck,
  GraduationCap, Loader2, Pin,
} from "lucide-react";
import { CourseCover } from "@/components/CourseCover";
import { parseVideo } from "@/lib/video";

type CourseCard = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  totalLessons: number;
  completedLessons: number;
};

type Post = {
  id: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  videoUrl: string | null;
  pinned: boolean;
  createdAt: string;
  authorName: string;
  authorImageUrl: string | null;
  isTeam: boolean;
  teamRole: string | null;
  isMine: boolean;
  comments: number;
  reactions: number;
  liked: boolean;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorImageUrl: string | null;
  isTeam: boolean;
  teamRole: string | null;
};

type Tab = "feed" | "cursos";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error");
  return res.json();
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="flex-shrink-0 rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-fg"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function TeamBadge({ role }: { role: string | null }) {
  // Marca al staff con un tick. El rol concreto se ve en el tooltip.
  const label = role === "ceo" ? "Dirección"
    : role === "head_coach" ? "Head coach"
    : role === "nutricionista" ? "Nutricionista"
    : "Equipo";
  return (
    <span title={label} className="ml-1 inline-flex items-center text-primary" aria-label={label}>
      <BadgeCheck size={14} fill="currentColor" className="text-primary" />
    </span>
  );
}

// Imagen del post: en cliente solo permitimos pegar URL externa (no upload).
function isUrl(s: string) {
  return /^https?:\/\//i.test(s.trim());
}

function CourseRow({ c }: { c: CourseCard }) {
  const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
  return (
    <Link
      href={`/cliente/comunidad/curso/${c.id}`}
      className="flex gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-primary"
    >
      <div className="w-24 flex-shrink-0">
        <CourseCover coverUrl={c.coverUrl} title={c.title} className="aspect-video w-full rounded-lg border border-border" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-sm font-bold text-text">{c.title}</p>
        {c.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.description}</p>
        ) : null}
        <div className="mt-auto pt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {c.completedLessons}/{c.totalLessons} · {pct}%
          </p>
        </div>
      </div>
    </Link>
  );
}

function PostCard({
  post, onLike, onDelete, onOpenComments, deleting,
}: {
  post: Post;
  onLike: () => void;
  onDelete: () => void;
  onOpenComments: () => void;
  deleting: boolean;
}) {
  const videoInfo = post.videoUrl ? parseVideo(post.videoUrl) : null;
  const thumb = post.imageUrl || videoInfo?.thumbnail || null;
  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-start gap-3">
        <Avatar url={post.authorImageUrl} name={post.authorName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">
            {post.authorName}
            {post.isTeam ? <TeamBadge role={post.teamRole} /> : null}
          </p>
          <p className="text-xs text-muted">{timeAgo(post.createdAt)}</p>
        </div>
        {post.pinned ? <Pin size={14} className="mt-1 text-primary" /> : null}
        {post.isMine ? (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
            aria-label="Borrar mi post"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
          </button>
        ) : null}
      </header>
      {post.title ? <h3 className="mb-1 text-base font-bold text-text">{post.title}</h3> : null}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{post.body}</p>
      {thumb ? (
        videoInfo?.embedUrl ? (
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-border">
            <iframe
              src={videoInfo.embedUrl}
              title="video"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <img
            src={thumb}
            alt=""
            className="mt-3 max-h-96 w-full rounded-xl border border-border object-cover"
          />
        )
      ) : null}
      <footer className="mt-3 flex gap-1 border-t border-border pt-3">
        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
            post.liked ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text"
          }`}
        >
          <Heart size={16} fill={post.liked ? "currentColor" : "none"} />
          {post.reactions}
        </button>
        <button
          onClick={onOpenComments}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <MessageCircle size={16} />
          {post.comments}
        </button>
      </footer>
    </article>
  );
}

function CommentsSheet({
  postId, meName, onClose, onCountChange,
}: {
  postId: string;
  meName: string;
  onClose: () => void;
  onCountChange: (n: number) => void;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/community/feed/${postId}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (alive) setComments(data as Comment[]);
      })
      .catch(() => alive && setComments([]));
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => {
      alive = false;
    };
  }, [postId]);

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    try {
      const created = await api(`/api/community/feed/${postId}/comments`, "POST", { body: text });
      setComments((prev) => [...(prev ?? []), created as Comment]);
      onCountChange(((comments?.length ?? 0) + 1));
      setBody("");
    } catch {
      // silent
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-2xl border-t border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold text-text">Comentarios</p>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {comments === null ? (
            <p className="text-center text-sm text-muted">Cargando…</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted">Sé el primero en comentar.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar url={c.authorImageUrl} name={c.authorName} size={32} />
                <div className="flex-1 rounded-xl bg-surface-2 px-3 py-2">
                  <p className="text-xs font-semibold text-text">
                    {c.authorName}
                    {c.isTeam ? <TeamBadge role={c.teamRole} /> : null}
                    <span className="ml-2 font-normal text-muted">{timeAgo(c.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-text">{c.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-3">
          <Avatar url={null} name={meName} size={32} />
          <input
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Escribe un comentario…"
            className="flex-1 rounded-full border border-border bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-primary"
          />
          <button
            onClick={submit}
            disabled={posting || !body.trim()}
            className="rounded-full bg-primary p-2 text-primary-fg disabled:opacity-50"
            aria-label="Enviar"
          >
            {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposerCard({
  meName,
  onPosted,
}: {
  meName: string;
  onPosted: (p: Post) => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const text = body.trim();
    if (!text) return;
    if (imageUrl && !isUrl(imageUrl)) {
      setError("Pega una URL completa (https://…) o deja el campo vacío.");
      return;
    }
    setPosting(true);
    try {
      const created = await api("/api/community/feed", "POST", {
        body: text,
        imageUrl: imageUrl.trim() || undefined,
      });
      // El endpoint devuelve el post crudo de prisma; lo adaptamos al shape Post.
      const p: Post = {
        id: created.id,
        title: created.title ?? null,
        body: created.body,
        imageUrl: created.imageUrl ?? null,
        videoUrl: created.videoUrl ?? null,
        pinned: !!created.pinned,
        createdAt: typeof created.createdAt === "string" ? created.createdAt : new Date(created.createdAt).toISOString(),
        authorName: created.authorClient?.fullName ?? meName,
        authorImageUrl: created.authorClient?.imageUrl ?? null,
        isTeam: false,
        teamRole: null,
        isMine: true,
        comments: 0,
        reactions: 0,
        liked: false,
      };
      onPosted(p);
      setBody("");
      setImageUrl("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar.");
    } finally {
      setPosting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left text-sm text-muted transition hover:border-primary"
      >
        <Avatar url={null} name={meName} size={36} />
        Comparte algo con el equipo y la comunidad…
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-3">
        <Avatar url={null} name={meName} size={36} />
        <p className="font-semibold text-text">{meName}</p>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="¿Qué quieres compartir? Un PR, una comida, una duda…"
        className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-primary"
      />
      <div className="mt-2">
        <label className="mb-1 flex items-center gap-1 text-xs text-muted">
          <ImageIcon size={12} /> URL de imagen o vídeo (opcional)
        </label>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-primary"
        />
      </div>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => { setOpen(false); setBody(""); setImageUrl(""); setError(null); }}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={posting || !body.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
        >
          {posting ? <Loader2 size={16} className="inline animate-spin" /> : "Publicar"}
        </button>
      </div>
    </div>
  );
}

export function ClientCommunity({
  me,
  courses,
  initialPosts,
}: {
  me: { id: string; fullName: string };
  courses: CourseCard[];
  initialPosts: Post[];
}) {
  const [tab, setTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function toggleLike(post: Post) {
    // Optimistic UI: el endpoint ya devuelve el estado real.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, liked: !p.liked, reactions: p.reactions + (p.liked ? -1 : 1) } : p,
      ),
    );
    try {
      const res = await api(`/api/community/feed/${post.id}/react`, "POST");
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, liked: res.liked, reactions: res.count } : p,
        ),
      );
    } catch {
      // revertir
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, liked: post.liked, reactions: post.reactions } : p,
        ),
      );
    }
  }

  async function deletePost(post: Post) {
    if (!confirm("¿Borrar este post?")) return;
    setDeletingId(post.id);
    try {
      await api(`/api/community/feed/${post.id}`, "DELETE");
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="pb-10">
      <h1 className="mb-1 text-2xl font-extrabold text-text">Comunidad</h1>
      <p className="mb-4 text-sm text-muted">Tu academia y el muro del equipo.</p>

      <nav className="mb-5 flex rounded-xl border border-border bg-surface p-1">
        <button
          onClick={() => setTab("feed")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "feed" ? "bg-primary text-primary-fg" : "text-muted hover:text-text"
          }`}
        >
          Muro
        </button>
        <button
          onClick={() => setTab("cursos")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "cursos" ? "bg-primary text-primary-fg" : "text-muted hover:text-text"
          }`}
        >
          Cursos
        </button>
      </nav>

      {tab === "feed" ? (
        <div className="space-y-3">
          <ComposerCard meName={me.fullName} onPosted={(p) => setPosts((prev) => [p, ...prev])} />
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
              Aún no hay publicaciones. ¡Empieza la conversación!
            </div>
          ) : (
            posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onLike={() => toggleLike(p)}
                onDelete={() => deletePost(p)}
                onOpenComments={() => setCommentsFor(p.id)}
                deleting={deletingId === p.id}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
              <GraduationCap size={28} className="mx-auto mb-2 text-primary" />
              Tu nutricionista está preparando los cursos. Vuelve pronto.
            </div>
          ) : (
            courses.map((c) => <CourseRow key={c.id} c={c} />)
          )}
        </div>
      )}

      {commentsFor ? (
        <CommentsSheet
          postId={commentsFor}
          meName={me.fullName}
          onClose={() => setCommentsFor(null)}
          onCountChange={(n) =>
            setPosts((prev) => prev.map((p) => (p.id === commentsFor ? { ...p, comments: n } : p)))
          }
        />
      ) : null}
    </div>
  );
}

