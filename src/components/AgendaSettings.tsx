"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleAlert, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";

const WEEKDAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
type Shift = { id: string; dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number; closerId: string; closer: { fullName: string } };
type Professional = { id: string; fullName: string; role: string };
type Config = { shifts: Shift[]; closers: Professional[]; connectedEmail: string | null; oauthConfigured: boolean };

export function AgendaSettings() {
  const [data, setData] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("14:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(45);
  const [closerId, setCloserId] = useState("");

  async function reload() {
    try {
      const res = await fetch("/api/agenda/config", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cargar la configuración");
      setData(json);
      setCloserId((prev) => prev || json.closers[0]?.id || "");
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error de red"); }
  }
  useEffect(() => { void reload(); }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const res = await fetch("/api/agenda/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayOfWeek, startTime, endTime, slotDurationMinutes, closerId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar la franja");
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Error de red"); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("¿Eliminar esta franja? Las citas ya reservadas no se borrarán.")) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/agenda/config", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo eliminar la franja");
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Error de red"); }
    finally { setSaving(false); }
  }

  const active = Boolean(data?.connectedEmail && data?.shifts.length && data?.oauthConfigured);
  const input = "rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-text focus:border-primary min-w-0";
  return (
    <main className="mx-auto max-w-5xl px-3 py-6 space-y-6">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div><Link href="/ajustes" className="text-sm text-muted hover:text-primary">← Ajustes</Link><h1 className="mt-1 text-2xl font-extrabold">Agenda de llamadas</h1><p className="mt-1 text-sm text-muted">Gestiona la disponibilidad que ven los leads al reservar.</p></div>
        <Link href="/agenda" target="_blank" className="inline-flex gap-2 items-center rounded-xl bg-primary px-4 py-2.5 text-white text-sm font-semibold hover:opacity-90"><ExternalLink size={16}/> Ver landing pública</Link>
      </div>

      {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</div>}
      {!data ? <p className="text-sm text-muted flex gap-2 items-center"><Loader2 size={16} className="animate-spin"/> Cargando configuración…</p> : <>
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${active ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          {active ? <CheckCircle2 size={22} className="text-emerald-600 shrink-0"/> : <CircleAlert size={22} className="text-amber-600 shrink-0"/>}
          <div><h2 className="font-bold text-sm text-text">{active ? "Agenda configurada" : "Configuración pendiente"}</h2><p className="text-sm text-muted mt-1">{active ? "Hay franjas horarias y una cuenta conectada. Las horas libres dependerán de las citas y bloqueos reales en Google Calendar." : "Para publicar huecos y aceptar reservas necesitas conectar Google Calendar y configurar al menos una franja semanal."}</p></div>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex gap-2 items-center mb-2"><CalendarDays size={19} className="text-primary"/><h2 className="font-bold text-lg">1. Google Calendar</h2></div>
          <p className="text-sm text-muted mb-4">La disponibilidad consulta los eventos existentes y cada reserva crea una videollamada con Google Meet y un lead en el CRM.</p>
          {data.connectedEmail ? <div className="flex gap-2 items-center flex-wrap"><CheckCircle2 size={18} className="text-emerald-600"/><span className="text-sm font-semibold">{data.connectedEmail}</span><a className="text-sm text-primary underline ml-auto" href="/api/agenda/google/connect">Cambiar cuenta</a></div> : data.oauthConfigured ? <a className="inline-flex rounded-xl px-4 py-2.5 bg-primary text-white text-sm font-semibold" href="/api/agenda/google/connect">Conectar Google Calendar</a> : <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">Falta habilitar OAuth para esta app en Vercel: <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> y <code>GOOGLE_REDIRECT_URI</code>. Autoriza la URI de redirección <code>https://al-fallo-app.vercel.app/api/agenda/google/callback</code> en Google Cloud. Al estar configurado aparecerá aquí el botón de conexión.</div>}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-bold text-lg mb-1">2. Horarios semanales</h2>
          <p className="text-sm text-muted mb-4">Indica cuándo podrán reservar los leads y quién atenderá cada franja. Horarios en España peninsular. Los eventos ya agendados siempre bloquean su hueco.</p>
          {data.shifts.length ? <div className="space-y-2 mb-5">{data.shifts.map(s => <div key={s.id} className="rounded-xl border border-border bg-surface-2 px-3 py-3 flex items-center justify-between gap-3"><div><span className="font-semibold text-sm">{WEEKDAYS[s.dayOfWeek]} · {s.startTime}–{s.endTime}</span><p className="text-xs text-muted mt-1">{s.closer.fullName} · Llamadas de {s.slotDurationMinutes} min</p></div><button aria-label={`Eliminar franja de ${WEEKDAYS[s.dayOfWeek]}`} type="button" disabled={saving} onClick={() => void remove(s.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={18}/></button></div>)}</div> : <p className="text-sm text-muted mb-4">Todavía no hay franjas creadas.</p>}
          <form onSubmit={add} className="grid grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1.6fr_auto] gap-3 items-end rounded-xl border border-border bg-surface-2 p-4">
            <label className="text-xs font-medium flex flex-col gap-1.5">Día<select className={input} value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>{WEEKDAYS.slice(1).map((name,i)=><option key={name} value={i+1}>{name}</option>)}</select></label>
            <label className="text-xs font-medium flex flex-col gap-1.5">Inicio<input className={input} type="time" required value={startTime} onChange={e=>setStartTime(e.target.value)}/></label>
            <label className="text-xs font-medium flex flex-col gap-1.5">Fin<input className={input} type="time" required value={endTime} onChange={e=>setEndTime(e.target.value)}/></label>
            <label className="text-xs font-medium flex flex-col gap-1.5">Duración<select className={input} value={slotDurationMinutes} onChange={e=>setSlotDurationMinutes(Number(e.target.value))}>{[30,45,60].map(n=><option key={n} value={n}>{n} min</option>)}</select></label>
            <label className="text-xs font-medium flex flex-col gap-1.5">Closer<select className={input} value={closerId} required onChange={e=>setCloserId(e.target.value)}>{data.closers.length ? data.closers.map(c=><option key={c.id} value={c.id}>{c.fullName} ({c.role})</option>) : <option value="">Sin closers activos</option>}</select></label>
            <button type="submit" disabled={saving || !closerId} className="col-span-2 lg:col-span-1 rounded-xl bg-primary text-white font-semibold text-sm px-4 py-2.5 disabled:opacity-50 flex items-center justify-center gap-1">{saving ? <Loader2 className="animate-spin" size={15}/> : <Plus size={15}/>} Añadir</button>
          </form>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-bold text-lg">3. Personaliza la landing</h2>
          <p className="mt-2 text-sm text-muted">Puedes editar el titular, la explicación, la presentación del equipo y los bloques de prueba social sin modificar código.</p>
          <Link className="inline-flex mt-3 text-sm font-semibold text-primary underline" href="/biblioteca/landings">Editar textos y fotos de la landing</Link>
        </section>
      </>}
    </main>
  );
}
