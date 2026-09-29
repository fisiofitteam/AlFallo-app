"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, Loader2, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { upload } from "@vercel/blob/client";
import {
  createCompetitionPlan,
  deleteCompetitionPlan,
  updateCompetitionPlan,
} from "../actions";

export type CompetitionPlanRow = {
  id: string;
  title: string;
  description: string | null;
  pdfUrl: string | null;
  pdfName: string | null;
  startDate: string; // ISO
  endDate: string; // ISO
  createdAt: string;
};

const inputCls =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";

function dateInputValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayInput(): string {
  return dateInputValue(new Date().toISOString());
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
function inWindow(iso1: string, iso2: string, now = new Date()): "activo" | "futuro" | "pasado" {
  const start = new Date(iso1);
  const end = new Date(iso2);
  end.setHours(23, 59, 59, 999);
  if (now < start) return "futuro";
  if (now > end) return "pasado";
  return "activo";
}

const STATUS_TONE: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800",
  futuro: "bg-sky-100 text-sky-800",
  pasado: "bg-neutral-100 text-neutral-600",
};

export function CompeticionTab({
  clientId,
  plans,
}: {
  clientId: string;
  plans: CompetitionPlanRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(plans.length === 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Planes de competición 1:1 con fechas concretas. El atleta lo ve en su app
        entre el <strong>inicio</strong> y el <strong>fin</strong>. Puedes adjuntar un PDF
        para que se lo descargue.
      </p>

      {plans.length === 0 ? null : (
        <ul className="space-y-3">
          {plans.map((p) => {
            const status = inWindow(p.startDate, p.endDate);
            const isEditing = editingId === p.id;
            return (
              <li key={p.id} className="rounded-2xl border border-border bg-surface p-4">
                {isEditing ? (
                  <PlanForm
                    clientId={clientId}
                    initial={p}
                    onDone={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold">{p.title}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_TONE[status]}`}
                          >
                            {status === "activo" ? "Visible ahora" : status === "futuro" ? "Programado" : "Pasado"}
                          </span>
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <CalendarDays size={12} />
                          {formatDate(p.startDate)} → {formatDate(p.endDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(p.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-bg px-2 py-1 text-[11px] font-medium hover:bg-surface-2"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <DeleteButton id={p.id} />
                      </div>
                    </div>
                    {p.description ? (
                      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-bg/50 p-3 text-sm text-text">
                        {p.description}
                      </p>
                    ) : null}
                    {p.pdfUrl ? (
                      <a
                        href={p.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
                      >
                        <Paperclip size={12} /> {p.pdfName ?? "PDF adjunto"}
                      </a>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-4">
          <PlanForm
            clientId={clientId}
            onDone={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 rounded-xl border border-dashed border-border bg-surface/60 px-3 py-2 text-sm font-medium text-text hover:border-primary"
        >
          <Plus size={14} /> Nuevo plan de competición
        </button>
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        if (!confirm("¿Borrar este plan de competición?")) return;
        start(async () => {
          await deleteCompetitionPlan(fd);
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md p-1 text-muted hover:text-red-600"
        title="Borrar"
      >
        <Trash2 size={13} />
      </button>
    </form>
  );
}

function PlanForm({
  clientId,
  initial,
  onDone,
  onCancel,
}: {
  clientId: string;
  initial?: CompetitionPlanRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startDate, setStartDate] = useState(
    initial ? dateInputValue(initial.startDate) : todayInput(),
  );
  const [endDate, setEndDate] = useState(initial ? dateInputValue(initial.endDate) : "");
  const [pdfUrl, setPdfUrl] = useState<string | null>(initial?.pdfUrl ?? null);
  const [pdfName, setPdfName] = useState<string | null>(initial?.pdfName ?? null);
  const [clearPdf, setClearPdf] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const key = `competicion/${clientId}/${Date.now()}-${file.name}`;
      const blob = await upload(key, file, {
        access: "public",
        handleUploadUrl: "/api/biblioteca/upload-doc",
      });
      setPdfUrl(blob.url);
      setPdfName(file.name);
      setClearPdf(false);
    } catch (e) {
      setUploadError((e as Error).message || "No se pudo subir el PDF.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePdf() {
    setPdfUrl(null);
    setPdfName(null);
    setClearPdf(true);
  }

  return (
    <form
      action={(fd) => {
        // Añadimos manualmente los campos del PDF y el clientId/id.
        fd.set("clientId", clientId);
        if (initial) fd.set("id", initial.id);
        if (pdfUrl) {
          fd.set("pdfUrl", pdfUrl);
          fd.set("pdfName", pdfName ?? "PDF adjunto");
        } else {
          fd.set("pdfUrl", "");
          fd.set("pdfName", "");
        }
        if (clearPdf) fd.set("clearPdf", "1");
        start(async () => {
          if (initial) await updateCompetitionPlan(fd);
          else await createCompetitionPlan(fd);
          onDone();
        });
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block font-semibold text-muted">Título</span>
        <input
          className={inputCls}
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. Semana previa a la competición X"
          maxLength={120}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-muted">Visible desde</span>
          <input
            className={inputCls}
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-muted">Visible hasta</span>
          <input
            className={inputCls}
            name="endDate"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
          />
        </label>
      </div>

      <label className="block text-xs">
        <span className="mb-1 block font-semibold text-muted">Descripción / instrucciones (opcional)</span>
        <textarea
          className={inputCls}
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Timing de comidas, hidratación, notas específicas..."
        />
      </label>

      <div>
        <p className="mb-1 text-xs font-semibold text-muted">PDF (opcional)</p>
        {pdfUrl ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg/50 p-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Paperclip size={12} /> {pdfName ?? "PDF"}
            </a>
            <button
              type="button"
              onClick={removePdf}
              className="ml-auto inline-flex items-center gap-1 rounded-md text-xs text-red-600 hover:underline"
            >
              <X size={12} /> Quitar
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-bg/40 px-3 py-2 text-xs font-medium text-text hover:border-primary">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            {uploading ? "Subiendo…" : "Adjuntar PDF"}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
          </label>
        )}
        {uploadError ? (
          <p className="mt-1 text-[11px] text-red-600">{uploadError}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending || uploading || !title || !endDate}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear plan"}
        </button>
      </div>
    </form>
  );
}
