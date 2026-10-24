import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, appApi, dayKey, getSessionUser, hhmm, shortDate, timeRange, useVocab, WEEKDAYS } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, Tabs, useFlash, useForm } from "../../../components/ui";
import { AptoPill, MemberPicker, FEE_TONE, num, useTab } from "../../../components/c2/shared";
import "../../../c2.css";

interface Sess {
  id: number; activity_id: number; activity_name: string | null; color: string | null; space_name: string | null; instructor_id: number | null;
  instructor_name: string | null; substitute_instructor_id: number | null; substitute_name: string | null; starts_at: string; ends_at: string;
  capacity: number; status: string; cancel_reason: string | null; booked: number; waitlist: number; free: number; attended: number;
}
interface BookingRow {
  id: number; member_id: number; name: string; dni: string; status: string; waitlist_position: number | null; apto: { state: string; label: string } | null;
  fee_state?: string; fee_label?: string; health_flags?: { injury: string | null; parq: boolean }; is_prospect: boolean;
}
interface Detail extends Sess { bookings: BookingRow[] }
interface Tpl {
  id: number; activity_id: number; activity_name: string | null; color: string | null; space_id: number | null; space_name: string | null;
  instructor_id: number | null; instructor_name: string | null; weekday: number; start_time: string; duration_min: number; capacity: number;
  allow_drop_in: boolean; active: boolean; conflicts: number[];
}
interface Act { id: number; name: string; color: string; default_capacity: number; active: boolean; description: string | null; requires_level: boolean }
interface Space { id: number; name: string; kind: string; capacity: number; active: boolean }
interface Instr { id: number; first_name: string; last_name: string; name?: string; active: boolean }

const STATUS_TEXT: Record<string, [string, string]> = {
  RESERVADA: ["Reservó", "teal"], LISTA_ESPERA: ["En espera", "orange"], ASISTIO: ["Vino", "green"], AUSENTE: ["No vino", "red"],
  CANCELADA: ["Canceló", "gray"], CANCELADA_TARDE: ["Canceló tarde", "gray"],
};
const SPACE_KINDS: [string, string][] = [["SALA", "Sala"], ["CARRIL", "Carril"], ["TATAMI", "Tatami"], ["CANCHA", "Cancha"], ["OTRO", "Otro"]];
const iname = (i: Instr) => i.name || `${i.first_name} ${i.last_name}`;

type TabKey = "semana" | "grilla" | "catalogo";

function Index() {
  const { t } = useVocab();
  const user = getSessionUser();
  const role = user?.role || "";
  const isManager = role === "ADMINISTRADOR" || role === "ENCARGADO";
  const isInstructor = role === "INSTRUCTOR";
  const [tab, setTab] = useTab<TabKey>(["semana", "grilla", "catalogo"], "semana");
  const { show, fail, node: flash } = useFlash();
  const opts: [TabKey, string][] = [["semana", isInstructor ? "Mis clases" : "Agenda semanal"]];
  if (isManager) opts.push(["grilla", "Grilla fija"], ["catalogo", "Actividades y espacios"]);
  return (
    <section className="products-page">
      <PageHeader eyebrow="CLASES" title={`${t("session", true)}s y reservas`}
        subtitle={`La agenda de la semana, los cupos, la lista de espera y la asistencia de cada ${t("session")}.`} />
      {opts.length > 1 && <Tabs value={tab} onChange={setTab} options={opts} />}
      {tab === "semana" || !isManager ? <Week role={role} fail={fail} show={show} /> : tab === "grilla" ? <Grid fail={fail} show={show} /> : <Catalog fail={fail} show={show} />}
      {flash}
    </section>
  );
}

// ---------------------------------------------------------------- agenda semanal
function Week({ role, fail, show }: { role: string; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [monday, setMonday] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return addDays(d, -((d.getDay() + 6) % 7)); });
  const [items, setItems] = useState<Sess[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [activity, setActivity] = useState("");
  const load = useCallback(() => {
    appApi<{ items: Sess[] }>(`/class-sessions?from=${dayKey(monday)}&to=${dayKey(addDays(monday, 6))}`).then((r) => setItems(r.items)).catch(fail);
  }, [monday, fail]);
  useEffect(() => { setItems(null); load(); }, [load]);
  const acts = useMemo(() => [...new Map((items || []).map((s) => [s.activity_id, s.activity_name || ""])).entries()], [items]);
  const today = dayKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <>
      <div className="c2-toolbar">
        <button className="secondary-button c2-small-btn" onClick={() => setMonday(addDays(monday, -7))} aria-label="Semana anterior">‹ Anterior</button>
        <strong>{shortDate(dayKey(monday))} al {shortDate(dayKey(addDays(monday, 6)))}</strong>
        <button className="secondary-button c2-small-btn" onClick={() => setMonday(addDays(monday, 7))} aria-label="Semana siguiente">Siguiente ›</button>
        {acts.length > 1 && (
          <select value={activity} onChange={(e) => setActivity(e.target.value)} aria-label="Filtrar por actividad">
            <option value="">Todas las actividades</option>{acts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>)}
      </div>
      {!items ? <Loading /> : (
        <>
          {items.length === 0 && <Empty title="No hay clases en esta semana">{role === "INSTRUCTOR" ? "Cuando te asignen clases las ves acá." : "Armá la grilla fija y se generan solas, o revisá otra semana."}</Empty>}
          {items.length > 0 && (
            <div className="c2-week">
              {days.map((d, i) => {
                const k = dayKey(d);
                const list = items.filter((s) => s.starts_at.slice(0, 10) === k && (!activity || String(s.activity_id) === activity));
                return (
                  <div key={k} className={`c2-day ${k === today ? "is-today" : ""}`}>
                    <header>{WEEKDAYS[i].slice(0, 3)}<b>{d.getDate()}</b></header>
                    {list.length === 0 ? <span className="c2-empty-day">Sin clases</span> : list.map((s) => (
                      <button key={s.id} className={`c2-sess ${s.status === "CANCELADA" ? "is-cancel" : ""}`} style={{ ["--c2-color" as any]: s.color || undefined }} onClick={() => setOpen(s.id)}>
                        <strong>{hhmm(s.starts_at)} {s.activity_name}</strong>
                        <small>{s.instructor_name || "Sin instructor"}{s.substitute_name ? ` (suple: ${s.substitute_name})` : ""}</small>
                        {s.status === "CANCELADA" ? <small>Cancelada</small> : (
                          <small><span className={`c2-cap ${s.free === 0 ? "is-full" : ""}`}>{s.booked}/{s.capacity}</span>{s.waitlist > 0 ? ` · ${s.waitlist} en espera` : ""}{s.status === "DICTADA" ? " · dictada" : ""}</small>)}
                      </button>))}
                  </div>);
              })}
            </div>)}
        </>)}
      {open && <SessionModal id={open} role={role} onClose={() => setOpen(null)} onChanged={load} fail={fail} show={show} />}
    </>
  );
}

function SessionModal({ id, role, onClose, onChanged, fail, show }: {
  id: number; role: string; onClose: () => void; onChanged: () => void; fail: (e: unknown) => void; show: (s: string) => void;
}) {
  const { t } = useVocab();
  const [d, setD] = useState<Detail | null>(null);
  const [mode, setMode] = useState<"" | "reservar" | "lista" | "cancelar" | "suplente">("");
  const [reason, setReason] = useState("");
  const [instrs, setInstrs] = useState<Instr[]>([]);
  const [sub, setSub] = useState("");
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const staff = role !== "INSTRUCTOR";
  const load = useCallback(() => { appApi<Detail>(`/class-sessions/${id}`).then(setD).catch(fail); }, [id, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (mode === "suplente" && instrs.length === 0) appApi<Instr[]>("/instructors?active=true").then(setInstrs).catch(fail); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn: () => Promise<any>, ok: string) {
    setBusy(true);
    try { await fn(); show(ok); load(); onChanged(); setMode(""); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  if (!d) return <Modal title="Cargando..." onClose={onClose}><Loading /></Modal>;
  const cancelled = d.status === "CANCELADA";
  const seated = d.bookings.filter((b) => ["RESERVADA", "ASISTIO", "AUSENTE"].includes(b.status));
  const waiting = d.bookings.filter((b) => b.status === "LISTA_ESPERA");
  const startMs = new Date(d.starts_at).getTime();
  const book = (m: { id: number }) => run(async () => {
    const r = await appApi<{ status: string }>(`/class-sessions/${id}/bookings`, { method: "POST", body: { member_id: m.id } });
    if (r.status === "LISTA_ESPERA") show("No había lugar: quedó en la lista de espera");
  }, "Reserva hecha");

  function startRoll() {
    const init: Record<number, string> = {};
    seated.forEach((b) => { init[b.id] = b.status === "AUSENTE" ? "AUSENTE" : "ASISTIO"; });
    setMarks(init); setMode("lista");
  }
  return (
    <Modal eyebrow={cancelled ? "CLASE CANCELADA" : "CLASE"} title={`${d.activity_name} · ${hhmm(d.starts_at)}`} size="wide" onClose={onClose}
      footer={<button className="secondary-button" onClick={onClose}>Cerrar</button>}>
      <div className="cb-detail-grid">
        <div><small>Cuándo</small><strong>{shortDate(d.starts_at.slice(0, 10))} · {timeRange(d.starts_at, d.ends_at)}</strong></div>
        <div><small>{t("instructor", true)}</small><strong>{d.instructor_name || "Sin asignar"}</strong>{d.substitute_name && <small>Suplente: {d.substitute_name}</small>}</div>
        <div><small>{t("space", true)}</small><strong>{d.space_name || "-"}</strong></div>
        <div><small>Cupo</small><strong>{d.booked} de {d.capacity}{d.waitlist ? ` · ${d.waitlist} en espera` : ""}</strong></div>
      </div>
      {cancelled && <div className="cb-note cb-note-warn" style={{ marginTop: 10 }}>Cancelada: {d.cancel_reason}</div>}

      {!cancelled && (
        <div className="c2-actions" style={{ margin: "12px 0" }}>
          {staff && d.status === "PROGRAMADA" && <button className="primary-button c2-small-btn" onClick={() => setMode(mode === "reservar" ? "" : "reservar")}>Reservar un lugar</button>}
          {seated.length > 0 && <button className="secondary-button c2-small-btn" onClick={startRoll}>Pasar lista</button>}
          {staff && <button className="secondary-button c2-small-btn" onClick={() => setMode("suplente")}>Poner suplente</button>}
          {staff && d.status === "PROGRAMADA" && <button className="cb-danger-button c2-small-btn" onClick={() => setMode("cancelar")}>Cancelar la clase</button>}
        </div>)}

      {mode === "reservar" && (
        <div className="cb-card" style={{ marginBottom: 12 }}>
          <MemberPicker autoFocus endpoint={(q) => `/class-members?q=${encodeURIComponent(q)}`} map={(r) => r} onPick={book} placeholder={`Buscar ${t("member")} por nombre o DNI`} />
          {d.free === 0 && <p className="cb-muted">La clase está llena: si reservás, queda en la lista de espera.</p>}
        </div>)}
      {mode === "cancelar" && (
        <div className="cb-card c2-stack" style={{ marginBottom: 12 }}>
          <div className="cb-note cb-note-warn">Se devuelven los créditos y se avisa a quienes reservaron (si el club tiene avisos). No se puede deshacer.</div>
          <Field label="Motivo"><input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Ej: el profe está enfermo" /></Field>
          <div className="c2-actions">
            <button className="cb-danger-button" disabled={busy || reason.trim().length < 3}
              onClick={() => run(() => appApi(`/class-sessions/${id}/cancel`, { method: "POST", body: { reason: reason.trim() } }), "Clase cancelada")}>Confirmar cancelación</button>
            <button className="secondary-button" onClick={() => setMode("")}>Volver</button>
          </div>
        </div>)}
      {mode === "suplente" && (
        <div className="cb-card c2-stack" style={{ marginBottom: 12 }}>
          <Field label="Suplente" hint="Cobra la clase dictada. Dejalo vacío para quitar al suplente."><select value={sub} onChange={(e) => setSub(e.target.value)}>
            <option value="">Sin suplente</option>{instrs.filter((i) => i.active && i.id !== d.instructor_id).map((i) => <option key={i.id} value={i.id}>{iname(i)}</option>)}</select></Field>
          <div className="c2-actions">
            <button className="primary-button" disabled={busy} onClick={() => run(() => appApi(`/class-sessions/${id}/substitute`, { method: "POST", body: { instructor_id: sub ? Number(sub) : null } }), "Suplente guardado")}>Guardar</button>
            <button className="secondary-button" onClick={() => setMode("")}>Volver</button>
          </div>
        </div>)}

      {mode === "lista" ? (
        <div className="c2-stack">
          <div className="cb-note cb-note-info">Marcá quién vino. Se puede pasar lista desde 1 hora antes hasta 24 horas después de la clase.</div>
          <ul className="c2-roster">{seated.map((b) => (
            <li key={b.id}><div><strong>{b.name}</strong></div>
              <Seg value={marks[b.id] || "ASISTIO"} onChange={(v) => setMarks({ ...marks, [b.id]: v })} options={[["ASISTIO", "Vino"], ["AUSENTE", "No vino"]]} /></li>))}</ul>
          <div className="c2-actions">
            <button className="primary-button" disabled={busy} onClick={() => run(() => appApi(`/class-sessions/${id}/attendance/bulk`, { method: "POST", body: { items: Object.entries(marks).map(([k, v]) => ({ booking_id: Number(k), status: v })) } }), "Asistencia guardada")}>Guardar asistencia</button>
            <button className="secondary-button" onClick={() => setMode("")}>Volver</button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="cb-form-title">Reservas ({seated.length})</h3>
          {seated.length === 0 ? <Empty title="Nadie reservó todavía" /> : (
            <ul className="c2-roster">{seated.map((b) => <BookingLine key={b.id} b={b} staff={staff} cancelled={cancelled} past={startMs < Date.now()} busy={busy}
              onCancel={() => run(async () => { const r: any = await appApi(`/bookings/${b.id}/cancel`, { method: "POST" }); if (r.late) show("Cancelación tardía: puede tener cargo"); }, "Reserva cancelada")} />)}</ul>)}
          {waiting.length > 0 && (
            <>
              <h3 className="cb-form-title">Lista de espera ({waiting.length})</h3>
              <ul className="c2-roster">{waiting.map((b) => (
                <li key={b.id}><div><strong>{b.waitlist_position}. {b.name}</strong></div>
                  {staff && <div className="c2-actions">
                    <button className="secondary-button c2-small-btn" disabled={busy || d.free === 0} title={d.free === 0 ? "No hay lugar libre" : ""}
                      onClick={() => run(() => appApi(`/bookings/${b.id}/promote`, { method: "POST" }), "Pasó a la clase")}>Darle el lugar</button>
                    <button className="secondary-button c2-small-btn" disabled={busy} onClick={() => run(() => appApi(`/bookings/${b.id}/cancel`, { method: "POST" }), "Sacado de la lista")}>Sacar</button></div>}</li>))}</ul>
            </>)}
        </>)}
    </Modal>
  );
}

function BookingLine({ b, staff, cancelled, past, busy, onCancel }: { b: BookingRow; staff: boolean; cancelled: boolean; past: boolean; busy: boolean; onCancel: () => void }) {
  const [txt, tone] = STATUS_TEXT[b.status] || [b.status, "gray"];
  return (
    <li>
      <div>
        <strong>{b.name}</strong>
        <small>DNI {b.dni}{b.is_prospect ? " · prospecto (clase de prueba)" : ""}</small>
        {b.health_flags?.injury && <small>Lesión: {b.health_flags.injury}</small>}
        {b.health_flags?.parq && <small>PAR-Q con respuesta afirmativa: consultar al médico antes de entrenar</small>}
      </div>
      <div className="cb-row">
        {b.apto && b.apto.state !== "VIGENTE" && <AptoPill state={b.apto.state} />}
        {b.fee_state && b.fee_state !== "AL_DIA" && <Pill tone={FEE_TONE[b.fee_state] || "gray"}>{b.fee_label || b.fee_state}</Pill>}
        <Pill tone={tone}>{txt}</Pill>
        {staff && b.status === "RESERVADA" && !cancelled && !past && <button className="c2-link" disabled={busy} onClick={onCancel}>Cancelar</button>}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- grilla fija
function Grid({ fail, show }: { fail: (e: unknown) => void; show: (s: string) => void }) {
  const { t } = useVocab();
  const [list, setList] = useState<Tpl[] | null>(null);
  const [edit, setEdit] = useState<Tpl | "new" | null>(null);
  const [cat, setCat] = useState<{ acts: Act[]; spaces: Space[]; instrs: Instr[] } | null>(null);
  const load = useCallback(() => { appApi<Tpl[]>("/class-templates?all=true").then(setList).catch(fail); }, [fail]);
  useEffect(() => { load(); Promise.all([appApi<Act[]>("/activities"), appApi<Space[]>("/spaces"), appApi<Instr[]>("/instructors?active=true").catch(() => [])])
    .then(([acts, spaces, instrs]) => setCat({ acts, spaces, instrs })).catch(fail); }, [load, fail]);
  async function generate() {
    try { const r = await appApi<{ created: number }>("/class-sessions/generate", { method: "POST", body: { weeks: 4 } }); show(r.created ? `Se crearon ${r.created} clases` : "Ya estaba todo generado"); } catch (e) { fail(e); }
  }
  if (!list) return <Loading />;
  return (
    <>
      <div className="c2-toolbar">
        <button className="primary-button" onClick={() => setEdit("new")} disabled={!cat || cat.acts.length === 0}>Agregar a la grilla</button>
        <button className="secondary-button" onClick={generate}>Generar las próximas 4 semanas</button>
      </div>
      {cat && cat.acts.length === 0 && <div className="cb-note cb-note-warn" style={{ marginBottom: 12 }}>Primero creá al menos una actividad en la pestaña «Actividades».</div>}
      {list.length === 0 ? <Empty title="La grilla está vacía">Cargá los horarios fijos de la semana: cada uno genera sus clases solo.</Empty> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Día</th><th>Hora</th><th>Actividad</th><th>{t("instructor", true)}</th><th>{t("space", true)}</th><th>Cupo</th><th></th></tr></thead>
          <tbody>{list.map((x) => (
            <tr key={x.id} className="is-click" onClick={() => setEdit(x)}>
              <td>{WEEKDAYS[x.weekday]}</td><td>{x.start_time} ({x.duration_min} min)</td>
              <td><span className="c2-color-dot" style={{ ["--c2-color" as any]: x.color || undefined }} /><strong>{x.activity_name}</strong>{!x.active && <small>Pausada</small>}</td>
              <td>{x.instructor_name || <Pill tone="orange">Sin asignar</Pill>}</td><td>{x.space_name || "-"}</td><td>{x.capacity}</td>
              <td>{x.conflicts.length > 0 && <Pill tone="red">Se pisa con otra</Pill>}</td></tr>))}</tbody></table></div>)}
      {edit && cat && <TplModal tpl={edit === "new" ? null : edit} cat={cat} onClose={() => setEdit(null)} fail={fail}
        onSaved={(msg) => { setEdit(null); load(); show(msg); }} />}
    </>
  );
}

function TplModal({ tpl, cat, onClose, onSaved, fail }: { tpl: Tpl | null; cat: { acts: Act[]; spaces: Space[]; instrs: Instr[] }; onClose: () => void; onSaved: (m: string) => void; fail: (e: unknown) => void }) {
  const { t } = useVocab();
  const { form, set } = useForm({
    activity_id: String(tpl?.activity_id || cat.acts[0]?.id || ""), weekday: String(tpl?.weekday ?? 0), start_time: tpl?.start_time || "19:00",
    duration_min: String(tpl?.duration_min || 60), capacity: String(tpl?.capacity || cat.acts[0]?.default_capacity || 15),
    instructor_id: String(tpl?.instructor_id || ""), space_id: String(tpl?.space_id || ""), allow_drop_in: tpl?.allow_drop_in || false, active: tpl ? tpl.active : true,
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const body = { activity_id: Number(form.activity_id), weekday: Number(form.weekday), start_time: form.start_time, duration_min: Number(form.duration_min),
      capacity: Number(form.capacity), instructor_id: form.instructor_id ? Number(form.instructor_id) : null, space_id: form.space_id ? Number(form.space_id) : null,
      allow_drop_in: form.allow_drop_in, active: form.active };
    try {
      const r: any = await appApi(tpl ? `/class-templates/${tpl.id}` : "/class-templates", { method: tpl ? "PUT" : "POST", body });
      onSaved(r.warnings?.length ? `Guardado. Atención: ${r.warnings[0]}` : "Guardado");
    } catch (e) { fail(e); } finally { setSaving(false); }
  }
  async function remove() {
    if (!tpl || !window.confirm("¿Sacar este horario de la grilla? Las clases ya generadas con reservas se mantienen.")) return;
    try { await appApi(`/class-templates/${tpl.id}`, { method: "DELETE" }); onSaved("Horario sacado de la grilla"); } catch (e) { fail(e); }
  }
  return (
    <Modal eyebrow="GRILLA FIJA" title={tpl ? "Editar horario" : "Nuevo horario"} onClose={onClose}
      footer={<>{tpl && <button className="cb-danger-button" onClick={remove}>Sacar</button>}<button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Actividad"><select value={form.activity_id} onChange={(e) => { set("activity_id", e.target.value); const a = cat.acts.find((x) => String(x.id) === e.target.value); if (a && !tpl) set("capacity", String(a.default_capacity)); }}>
          {cat.acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Día"><select value={form.weekday} onChange={(e) => set("weekday", e.target.value)}>{WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}</select></Field>
        <Field label="Hora de inicio"><input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} /></Field>
        <Field label="Duración (minutos)"><input type="number" min={5} max={480} value={form.duration_min} onChange={(e) => set("duration_min", e.target.value)} /></Field>
        <Field label="Cupo"><input type="number" min={1} max={500} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        <Field label={t("instructor", true)}><select value={form.instructor_id} onChange={(e) => set("instructor_id", e.target.value)}><option value="">Sin asignar</option>{cat.instrs.map((i) => <option key={i.id} value={i.id}>{iname(i)}</option>)}</select></Field>
        <Field label={t("space", true)}><select value={form.space_id} onChange={(e) => set("space_id", e.target.value)}><option value="">Sin definir</option>{cat.spaces.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="c2-stack">
          <label className="c2-check"><input type="checkbox" checked={form.allow_drop_in} onChange={(e) => set("allow_drop_in", e.target.checked)} /> Acepta clase de prueba o pase del día</label>
          <label className="c2-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activa (genera clases)</label>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- actividades y espacios
function Catalog({ fail, show }: { fail: (e: unknown) => void; show: (s: string) => void }) {
  const { t } = useVocab();
  const [acts, setActs] = useState<Act[] | null>(null);
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [editA, setEditA] = useState<Act | "new" | null>(null);
  const [editS, setEditS] = useState<Space | "new" | null>(null);
  const load = useCallback(() => {
    appApi<Act[]>("/activities?all=true").then(setActs).catch(fail);
    appApi<Space[]>("/spaces?all=true").then(setSpaces).catch(fail);
  }, [fail]);
  useEffect(load, [load]);
  if (!acts || !spaces) return <Loading />;
  return (
    <div className="c2-two">
      <div className="cb-card c2-stack">
        <div className="cb-card-head"><div><h2>Actividades</h2><p>Lo que se dicta: cada una tiene su color y cupo habitual.</p></div><button className="primary-button c2-small-btn" onClick={() => setEditA("new")}>Agregar</button></div>
        {acts.length === 0 ? <Empty title="Todavía no cargaste actividades" /> : <ul className="c2-roster">{acts.map((a) => (
          <li key={a.id}><div><span className="c2-color-dot" style={{ ["--c2-color" as any]: a.color }} /><strong>{a.name}</strong><small>Cupo habitual {a.default_capacity}</small></div>
            <div className="cb-row">{!a.active && <Pill>Pausada</Pill>}<button className="c2-link" onClick={() => setEditA(a)}>Editar</button></div></li>))}</ul>}
      </div>
      <div className="cb-card c2-stack">
        <div className="cb-card-head"><div><h2>{t("space", true)}s</h2><p>Salas, carriles, tatamis o canchas.</p></div><button className="primary-button c2-small-btn" onClick={() => setEditS("new")}>Agregar</button></div>
        {spaces.length === 0 ? <Empty title="Todavía no cargaste espacios" /> : <ul className="c2-roster">{spaces.map((s) => (
          <li key={s.id}><div><strong>{s.name}</strong><small>{SPACE_KINDS.find((k) => k[0] === s.kind)?.[1]} · capacidad {s.capacity}</small></div>
            <div className="cb-row">{!s.active && <Pill>Pausado</Pill>}<button className="c2-link" onClick={() => setEditS(s)}>Editar</button></div></li>))}</ul>}
      </div>
      {editA && <ActModal item={editA === "new" ? null : editA} onClose={() => setEditA(null)} fail={fail} onSaved={() => { setEditA(null); load(); show("Guardado"); }} />}
      {editS && <SpaceModal item={editS === "new" ? null : editS} onClose={() => setEditS(null)} fail={fail} onSaved={() => { setEditS(null); load(); show("Guardado"); }} />}
    </div>
  );
}

function ActModal({ item, onClose, onSaved, fail }: { item: Act | null; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const { form, set } = useForm({ name: item?.name || "", color: item?.color || "#1f2a5c", default_capacity: String(item?.default_capacity || 15), description: item?.description || "", active: item ? item.active : true });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.name.trim()) { fail(new Error("Escribí el nombre")); return; }
    setSaving(true);
    try { await appApi(item ? `/activities/${item.id}` : "/activities", { method: item ? "PUT" : "POST", body: { ...form, name: form.name.trim(), default_capacity: num(form.default_capacity), description: form.description.trim() || null } }); onSaved(); }
    catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="ACTIVIDAD" title={item ? item.name : "Nueva actividad"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>Guardar</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Nombre"><input value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Color"><input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} aria-label="Color" /></Field>
        <Field label="Cupo habitual"><input type="number" min={1} value={form.default_capacity} onChange={(e) => set("default_capacity", e.target.value)} /></Field>
        <Field label="Descripción (opcional)"><input value={form.description} maxLength={300} onChange={(e) => set("description", e.target.value)} /></Field>
        <label className="c2-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activa</label>
      </div>
    </Modal>
  );
}

function SpaceModal({ item, onClose, onSaved, fail }: { item: Space | null; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const { form, set } = useForm({ name: item?.name || "", kind: item?.kind || "SALA", capacity: String(item?.capacity || 20), active: item ? item.active : true });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.name.trim()) { fail(new Error("Escribí el nombre")); return; }
    setSaving(true);
    try { await appApi(item ? `/spaces/${item.id}` : "/spaces", { method: item ? "PUT" : "POST", body: { ...form, name: form.name.trim(), capacity: num(form.capacity) } }); onSaved(); }
    catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="ESPACIO" title={item ? item.name : "Nuevo espacio"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>Guardar</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Nombre"><input value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Tipo"><select value={form.kind} onChange={(e) => set("kind", e.target.value)}>{SPACE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Capacidad"><input type="number" min={1} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        <label className="c2-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activo</label>
      </div>
    </Modal>
  );
}

export default Index;
