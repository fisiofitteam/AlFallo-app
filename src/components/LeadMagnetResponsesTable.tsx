"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare2, Trash2 } from "lucide-react";
import {
  TRAINING_TIMES, SESSION_TYPES, MAIN_PROBLEMS, OBJECTIVES, WEEK_PATTERNS, BLOCKERS,
} from "@/lib/gasolina/quiz";

type ResponseRow = {
  id: string;
  dateLabel: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  status: string;
  campaign: string | null;
  source: string | null;
  whatsappClicked: boolean;
  resultJson: string | null;
};

type FocusKey = "preworkout" | "carbs" | "recovery" | "structure";
const focusLabels: Record<FocusKey, string> = {
  preworkout: "Energía previa", carbs: "Hidratos", recovery: "Recuperación", structure: "Semana real",
};

function gasolineSummary(raw: string | null) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || !["gasolina-v1", "gasolina-v2"].includes(data.guide)) return null;
    const focus: FocusKey | null = data.focus in focusLabels ? data.focus as FocusKey : null;
    return {
      focus: focus ? focusLabels[focus] : "Ver respuesta",
      trainingTime: TRAINING_TIMES.find((v) => v.id === data.trainingTime)?.label,
      sessionType: SESSION_TYPES.find((v) => v.id === data.sessionType)?.label,
      mainProblem: MAIN_PROBLEMS.find((v) => v.id === data.mainProblem)?.label,
      objective: OBJECTIVES.find((v) => v.id === data.objective)?.label,
      weekPattern: WEEK_PATTERNS.find((v) => v.id === data.weekPattern)?.label,
      blocker: BLOCKERS.find((v) => v.id === data.blocker)?.label,
    };
  } catch { return null; }
}

export function LeadMagnetResponsesTable({
  leadMagnetId, rows, canDelete,
}: {
  leadMagnetId: string;
  rows: ResponseRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  // Select only the rows visible with the current filters and on this page.
  const visibleIds = new Set(rows.map((r) => r.id));
  const selectedIds = selected.filter((id) => visibleIds.has(id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id));
    setError(""); setFeedback("");
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? rows.map((row) => row.id) : []);
    setError(""); setFeedback("");
  }

  async function deleteResponses(ids: string[]) {
    if (!canDelete || busy || ids.length === 0) return;
    const label = ids.length === 1
      ? `la respuesta de ${rows.find((row) => row.id === ids[0])?.fullName || "este registro"}`
      : `${ids.length} respuestas seleccionadas`;
    if (!window.confirm(
      `¿Eliminar definitivamente ${label}?\n\nSe borrarán sus respuestas, sus datos de contacto y su contribución a las métricas. No se puede deshacer.\n\n¿Continuar?`,
    )) return;

    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch(`/api/content/lead-magnets/${encodeURIComponent(leadMagnetId)}/responses`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || data.deleted !== ids.length) {
        throw new Error(data.error || "No se pudieron borrar las respuestas. Actualiza e inténtalo otra vez.");
      }
      setSelected([]);
      setFeedback(`${data.deleted} ${data.deleted === 1 ? "respuesta eliminada" : "respuestas eliminadas"}.`);
      // Avoid leaving the user on a now-empty last page after bulk deletion.
      const url = new URL(window.location.href);
      const page = Number(url.searchParams.get("page") || "1");
      if (ids.length === rows.length && page > 1) {
        url.searchParams.set("page", String(page - 1));
        router.replace(url.pathname + url.search);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión al eliminar respuestas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {canDelete && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-[#fffbfd] px-4 py-3">
          <span className="inline-flex items-center gap-2 text-xs text-neutral-600">
            <CheckSquare2 size={15} className="text-[#c01769]" />
            {selectedIds.length ? `${selectedIds.length} seleccionadas en esta página` : "Selecciona las respuestas que quieras borrar"}
          </span>
          <button
            type="button" disabled={!selectedIds.length || busy}
            onClick={() => void deleteResponses(selectedIds)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} /> {busy ? "Eliminando..." : `Eliminar seleccionadas${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
          </button>
        </div>
      )}
      {error && <p role="alert" className="m-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {feedback && <p role="status" className="m-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">{feedback}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-500">
              {canDelete && <th className="px-3 py-3 font-semibold">
                <input type="checkbox" checked={allSelected} disabled={busy}
                  aria-label="Seleccionar todas las respuestas de esta página"
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-[#e6197e]" />
              </th>}
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Contacto</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Campaña</th>
              <th className="px-4 py-3 font-semibold">WhatsApp</th>
              <th className="px-4 py-3 font-semibold">Resultado</th>
              {canDelete && <th className="px-3 py-3 font-semibold">Acciones</th>}
            </tr>
          </thead>
          <tbody>{rows.map((row) => {
            const summary = gasolineSummary(row.resultJson);
            return (
              <tr key={row.id} className={`border-t border-neutral-100 align-top hover:bg-neutral-50 ${selectedIds.includes(row.id) ? "bg-[#fff4fa]" : ""}`}>
                {canDelete && <td className="px-3 py-3">
                  <input type="checkbox" checked={selectedIds.includes(row.id)} disabled={busy}
                    aria-label={`Seleccionar respuesta de ${row.fullName || row.dateLabel}`}
                    onChange={(e) => toggleOne(row.id, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-[#e6197e]" />
                </td>}
                <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{row.dateLabel}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-neutral-900">{row.fullName || "Sin nombre"}</p>
                  {row.email && <p className="mt-1 text-neutral-500">{row.email}</p>}
                  {row.phone && <p className="mt-1 text-neutral-500">{row.phone}</p>}
                  {row.instagram && <p className="mt-1 text-neutral-500">{row.instagram}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${row.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>
                    {row.status === "completed" ? "Completado" : "En curso"}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-600">{row.campaign || row.source || "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{row.whatsappClicked ? "Sí" : "No"}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {row.resultJson ? <details className="max-w-xs">
                    <summary className="cursor-pointer text-[#c01769]">{summary?.focus || "Ver respuesta"}</summary>
                    {summary ? <div className="mt-2 space-y-1 rounded bg-neutral-50 p-2 text-[11px]">
                      {summary.trainingTime && <p><strong>Horario:</strong> {summary.trainingTime}</p>}
                      {summary.sessionType && <p><strong>Sesión:</strong> {summary.sessionType}</p>}
                      {summary.mainProblem && <p><strong>Principal dificultad:</strong> {summary.mainProblem}</p>}
                      {summary.objective && <p><strong>Ambición:</strong> {summary.objective}</p>}
                      {summary.weekPattern && <p><strong>Semana habitual:</strong> {summary.weekPattern}</p>}
                      {summary.blocker && <p><strong>Obstáculo:</strong> {summary.blocker}</p>}
                    </div> : <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded bg-neutral-50 p-2 text-[11px]">{row.resultJson}</pre>}
                  </details> : <span className="text-neutral-400">—</span>}
                </td>
                {canDelete && <td className="px-3 py-3">
                  <button type="button" disabled={busy}
                    onClick={() => void deleteResponses([row.id])}
                    title="Eliminar solo esta respuesta"
                    aria-label={`Eliminar respuesta de ${row.fullName || row.dateLabel}`}
                    className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  ><Trash2 size={16} /></button>
                </td>}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
