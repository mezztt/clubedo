import { useCallback, useEffect, useState } from "react";
import { appApi, dayKey, getSessionUser, shortDate, useVocab } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, Tabs, useFlash, useForm } from "../../../components/ui";
import { MemberPicker, Stat, num, useTab } from "../../../components/c2/shared";
import type { PickedMember } from "../../../components/c2/shared";
import LineChart from "../../../components/c2/LineChart";
import "../../../c2.css";

interface Ex { id: number; name: string; muscle_group: string | null; equipment: string | null; video_url: string | null; how_to: string | null; active: boolean }
interface RLine { exercise_id: number; exercise_name?: string; sets: number | null; reps: string | null; load_note: string | null; rest_sec: number | null; notes: string | null }
interface RDay { day_label: string; exercises: RLine[] }
interface Routine { id: number; name: string; goal: string | null; level: string | null; days_per_week: number | null; notes: string | null; active: boolean; days: RDay[]; day_count?: number }
interface MR { id: number; routine_id: number | null; routine_name: string | null; from_date: string; to_date: string | null; status: string; snapshot: Routine | null }
interface Meas { id: number; measured_at: string; weight_kg: number | null; height_cm: number | null; body_fat_pct: number | null; muscle_kg: number | null; waist_cm: number | null; chest_cm: number | null; hip_cm: number | null; arm_cm: number | null; thigh_cm: number | null; bmi: number | null; note: string | null }
interface Perf { id: number; kind: string; name: string; value: number | null; unit: string | null; rx: boolean; recorded_at: string; note: string | null; is_best: boolean }
interface Progress { measurements: Meas[]; performance: { name: string; kind: string; unit: string | null; points: { date: string; value: number }[] }[] }
interface MRank { id: number; rank_name: string; color: string | null; activity_name: string | null; achieved_at: string; examiner: string | null }
interface Rank { id: number; activity_id: number | null; activity_name: string | null; name: string; order: number; color: string | null }
interface Overview { min_months: number; min_classes: number; activities: { activity_id: number; activity_name: string; ranks: { id: number; name: string; color: string | null }[]; members: { member_id: number; name: string; rank_name: string; rank_color: string | null; months: number | null; classes: number; next_rank_name: string | null; next_rank_id: number | null; can_take_exam: boolean }[] }[] }
interface Wod { id: number; day: string; title: string; body: string | null; activity_id: number | null; activity_name: string | null }

type TabKey = "rutinas" | "alumnos" | "ejercicios" | "grados" | "pizarra";
const MEAS: [keyof Meas, string, string][] = [["weight_kg", "Peso", "kg"], ["height_cm", "Altura", "cm"], ["body_fat_pct", "Grasa corporal", "%"], ["muscle_kg", "Masa muscular", "kg"], ["waist_cm", "Cintura", "cm"], ["chest_cm", "Pecho", "cm"], ["hip_cm", "Cadera", "cm"], ["arm_cm", "Brazo", "cm"], ["thigh_cm", "Muslo", "cm"]];
const PERF_KINDS: [string, string][] = [["FUERZA", "Fuerza (peso levantado)"], ["WOD", "WOD"], ["TIEMPO", "Tiempo"], ["DISTANCIA", "Distancia"], ["OTRO", "Otro"]];

function Index() {
  const { t } = useVocab();
  const role = getSessionUser()?.role || "";
  const canEdit = role !== "RECEPCION";
  const [tab, setTab] = useTab<TabKey>(["rutinas", "alumnos", "ejercicios", "grados", "pizarra"], "rutinas");
  const { show, fail, node: flash } = useFlash();
  return (
    <section className="products-page">
      <PageHeader eyebrow="ENTRENAMIENTO" title="Entrenamiento" subtitle={`Rutinas, ejercicios y el seguimiento de cada ${t("member")}: medidas, marcas y grados.`} />
      <Tabs value={tab} onChange={setTab} options={[["rutinas", "Rutinas"], ["alumnos", `Seguimiento`], ["ejercicios", "Ejercicios"], ["grados", "Grados"], ["pizarra", "Pizarra del día"]]} />
      {tab === "rutinas" ? <Routines canEdit={canEdit} role={role} fail={fail} show={show} /> :
        tab === "alumnos" ? <Follow role={role} canEdit={canEdit} fail={fail} show={show} word={t("member")} /> :
        tab === "ejercicios" ? <Exercises canEdit={canEdit} role={role} fail={fail} show={show} /> :
        tab === "grados" ? <Ranks role={role} canEdit={canEdit} fail={fail} show={show} /> :
        <Board canEdit={canEdit} fail={fail} show={show} />}
      {flash}
    </section>
  );
}

// ---------------------------------------------------------------- ejercicios
function Exercises({ canEdit, role, fail, show }: { canEdit: boolean; role: string; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [list, setList] = useState<Ex[] | null>(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Ex | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { appApi<Ex[]>(`/exercises?all=true${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`).then(setList).catch(fail); }, [q, fail]);
  useEffect(() => { const h = window.setTimeout(load, 200); return () => window.clearTimeout(h); }, [load]);
  async function template() {
    setBusy(true);
    try { const r = await appApi<{ created: { exercises: number; routines: number } }>("/training/apply-template", { method: "POST" }); show(`Se cargaron ${r.created.exercises} ejercicios y ${r.created.routines} rutinas de ejemplo`); load(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="c2-toolbar">
        <input type="search" className="c2-grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" />
        {canEdit && <button className="primary-button" onClick={() => setEdit("new")}>Agregar ejercicio</button>}
        {(role === "ADMINISTRADOR" || role === "ENCARGADO") && <button className="secondary-button" disabled={busy} onClick={template}>Cargar plantillas de mi rubro</button>}
      </div>
      {!list ? <Loading /> : list.length === 0 ? <Empty title="No hay ejercicios">Cargá los tuyos o usá «Cargar plantillas de mi rubro» para arrancar con ejemplos que después editás.</Empty> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Ejercicio</th><th>Grupo</th><th>Elemento</th><th></th></tr></thead>
          <tbody>{list.map((e) => (
            <tr key={e.id} className={canEdit ? "is-click" : ""} onClick={() => canEdit && setEdit(e)}>
              <td><strong>{e.name}</strong>{!e.active && <small>Archivado</small>}</td><td>{e.muscle_group || "-"}</td><td>{e.equipment || "-"}</td>
              <td>{e.video_url && <a href={e.video_url} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}>Ver video</a>}</td></tr>))}</tbody></table></div>)}
      {edit && <ExModal item={edit === "new" ? null : edit} onClose={() => setEdit(null)} fail={fail} onSaved={() => { setEdit(null); load(); show("Guardado"); }} />}
    </>
  );
}

function ExModal({ item, onClose, onSaved, fail }: { item: Ex | null; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const { form, set } = useForm({ name: item?.name || "", muscle_group: item?.muscle_group || "", equipment: item?.equipment || "", video_url: item?.video_url || "", how_to: item?.how_to || "", active: item ? item.active : true });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.name.trim()) { fail(new Error("Escribí el nombre del ejercicio")); return; }
    setSaving(true);
    const c = (v: string) => v.trim() || null;
    try { await appApi(item ? `/exercises/${item.id}` : "/exercises", { method: item ? "PUT" : "POST", body: { name: form.name.trim(), muscle_group: c(form.muscle_group), equipment: c(form.equipment), video_url: c(form.video_url), how_to: c(form.how_to), active: form.active } }); onSaved(); }
    catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="EJERCICIO" title={item ? item.name : "Nuevo ejercicio"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>Guardar</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Nombre"><input value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Grupo muscular o tipo"><input value={form.muscle_group} maxLength={60} onChange={(e) => set("muscle_group", e.target.value)} /></Field>
        <Field label="Elemento"><input value={form.equipment} maxLength={80} onChange={(e) => set("equipment", e.target.value)} /></Field>
        <Field label="Enlace a un video (opcional)"><input value={form.video_url} placeholder="https://..." onChange={(e) => set("video_url", e.target.value)} /></Field>
        <Field label="Cómo se hace" wide><textarea rows={3} value={form.how_to} maxLength={3000} onChange={(e) => set("how_to", e.target.value)} /></Field>
        <label className="c2-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Disponible para armar rutinas</label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- rutinas
function Routines({ canEdit, role, fail, show }: { canEdit: boolean; role: string; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [list, setList] = useState<Routine[] | null>(null);
  const [edit, setEdit] = useState<Routine | "new" | null>(null);
  const [assign, setAssign] = useState<Routine | null>(null);
  const load = useCallback(() => { appApi<Routine[]>("/routines").then(setList).catch(fail); }, [fail]);
  useEffect(load, [load]);
  async function open(r: Routine) { try { setEdit(await appApi<Routine>(`/routines/${r.id}`)); } catch (e) { fail(e); } }
  async function dup(r: Routine) { try { await appApi(`/routines/${r.id}/duplicate`, { method: "POST" }); show("Rutina duplicada"); load(); } catch (e) { fail(e); } }
  async function archive(r: Routine) { if (!window.confirm(`¿Archivar «${r.name}»? Las asignadas a alumnos se conservan.`)) return; try { await appApi(`/routines/${r.id}`, { method: "DELETE" }); show("Rutina archivada"); load(); } catch (e) { fail(e); } }
  if (!list) return <Loading />;
  return (
    <>
      {canEdit && <div className="c2-toolbar"><button className="primary-button" onClick={() => setEdit("new")}>Nueva rutina</button></div>}
      {list.length === 0 ? <Empty title="Todavía no hay rutinas">Armalas desde cero o cargá las plantillas de tu rubro en la pestaña «Ejercicios».</Empty> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Rutina</th><th>Objetivo</th><th>Nivel</th><th>Días</th><th></th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id}><td><strong>{r.name}</strong>{!r.active && <small>Archivada</small>}</td><td>{r.goal || "-"}</td><td>{r.level || "-"}</td><td>{r.days_per_week || "-"}</td>
              <td style={{ textAlign: "right" }}><div className="c2-actions" style={{ justifyContent: "flex-end" }}>
                <button className="c2-link" onClick={() => open(r)}>{canEdit ? "Editar" : "Ver"}</button>
                {canEdit && r.active && <button className="c2-link" onClick={() => setAssign(r)}>Asignar</button>}
                {canEdit && <button className="c2-link" onClick={() => dup(r)}>Duplicar</button>}
                {canEdit && r.active && <button className="c2-link" onClick={() => archive(r)}>Archivar</button>}</div></td></tr>))}</tbody></table></div>)}
      {edit && <RoutineModal item={edit === "new" ? null : edit} readOnly={!canEdit} onClose={() => setEdit(null)} fail={fail} onSaved={() => { setEdit(null); load(); show("Rutina guardada"); }} />}
      {assign && <AssignModal routine={assign} role={role} onClose={() => setAssign(null)} fail={fail} onDone={() => { setAssign(null); show("Rutina asignada"); }} />}
    </>
  );
}

function RoutineModal({ item, readOnly, onClose, onSaved, fail }: { item: Routine | null; readOnly: boolean; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const [exs, setExs] = useState<Ex[]>([]);
  const [r, setR] = useState<Routine>(item || { id: 0, name: "", goal: "", level: "", days_per_week: 3, notes: "", active: true, days: [{ day_label: "Día A", exercises: [] }] });
  const [saving, setSaving] = useState(false);
  useEffect(() => { appApi<Ex[]>("/exercises").then(setExs).catch(fail); }, [fail]);
  const upd = (di: number, fn: (d: RDay) => RDay) => setR({ ...r, days: r.days.map((d, i) => (i === di ? fn(d) : d)) });
  async function save() {
    if (!r.name.trim()) { fail(new Error("Ponele un nombre a la rutina")); return; }
    if (r.days.some((d) => !d.day_label.trim())) { fail(new Error("Cada día necesita un nombre")); return; }
    setSaving(true);
    const body = { name: r.name.trim(), goal: (r.goal || "").trim() || null, level: (r.level || "").trim() || null, days_per_week: r.days_per_week || null, notes: (r.notes || "").trim() || null, active: r.active,
      days: r.days.map((d) => ({ day_label: d.day_label.trim(), exercises: d.exercises.map((x) => ({ exercise_id: x.exercise_id, sets: x.sets || null, reps: (x.reps || "").trim() || null, load_note: (x.load_note || "").trim() || null, rest_sec: x.rest_sec ?? null, notes: (x.notes || "").trim() || null })) })) };
    try { await appApi(item ? `/routines/${item.id}` : "/routines", { method: item ? "PUT" : "POST", body }); onSaved(); } catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="RUTINA" title={item ? item.name : "Nueva rutina"} size="xl" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>{readOnly ? "Cerrar" : "Cancelar"}</button>{!readOnly && <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>}</>}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="product-form c2-form-grid">
          <Field label="Nombre"><input value={r.name} maxLength={120} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
          <Field label="Objetivo"><input value={r.goal || ""} maxLength={120} onChange={(e) => setR({ ...r, goal: e.target.value })} /></Field>
          <Field label="Nivel"><input value={r.level || ""} maxLength={40} onChange={(e) => setR({ ...r, level: e.target.value })} placeholder="Principiante, intermedio..." /></Field>
          <Field label="Días por semana"><input type="number" min={1} max={7} value={r.days_per_week || ""} onChange={(e) => setR({ ...r, days_per_week: e.target.value ? Number(e.target.value) : null })} /></Field>
        </div>
        <div className="c2-stack" style={{ marginTop: 12 }}>
          {r.days.map((d, di) => (
            <div key={di} className="c2-rday">
              <div className="cb-row"><input value={d.day_label} maxLength={60} aria-label="Nombre del día" style={{ flex: 1, fontWeight: 700 }} onChange={(e) => upd(di, (x) => ({ ...x, day_label: e.target.value }))} />
                {!readOnly && r.days.length > 1 && <button type="button" className="c2-link" onClick={() => setR({ ...r, days: r.days.filter((_, i) => i !== di) })}>Quitar día</button>}</div>
              {d.exercises.map((x, xi) => (
                <div key={xi} className="c2-rrow">
                  <select value={x.exercise_id || ""} aria-label="Ejercicio" onChange={(e) => upd(di, (dd) => ({ ...dd, exercises: dd.exercises.map((y, i) => (i === xi ? { ...y, exercise_id: Number(e.target.value) } : y)) }))}>
                    <option value="">Elegí un ejercicio</option>{exs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    {x.exercise_id && !exs.some((e) => e.id === x.exercise_id) && <option value={x.exercise_id}>{x.exercise_name}</option>}</select>
                  <input type="number" min={1} max={50} placeholder="Series" aria-label="Series" value={x.sets || ""} onChange={(e) => upd(di, (dd) => ({ ...dd, exercises: dd.exercises.map((y, i) => (i === xi ? { ...y, sets: e.target.value ? Number(e.target.value) : null } : y)) }))} />
                  <input placeholder="Repes" aria-label="Repeticiones" maxLength={30} value={x.reps || ""} onChange={(e) => upd(di, (dd) => ({ ...dd, exercises: dd.exercises.map((y, i) => (i === xi ? { ...y, reps: e.target.value } : y)) }))} />
                  <input type="number" min={0} placeholder="Desc. (s)" aria-label="Descanso en segundos" value={x.rest_sec ?? ""} onChange={(e) => upd(di, (dd) => ({ ...dd, exercises: dd.exercises.map((y, i) => (i === xi ? { ...y, rest_sec: e.target.value === "" ? null : Number(e.target.value) } : y)) }))} />
                  {!readOnly && <button type="button" className="c2-link" onClick={() => upd(di, (dd) => ({ ...dd, exercises: dd.exercises.filter((_, i) => i !== xi) }))}>Quitar</button>}
                </div>))}
              {!readOnly && <button type="button" className="secondary-button c2-small-btn" style={{ marginTop: 8 }} onClick={() => upd(di, (dd) => ({ ...dd, exercises: [...dd.exercises, { exercise_id: 0, sets: 3, reps: "10", load_note: null, rest_sec: 60, notes: null }] }))}>Agregar ejercicio</button>}
            </div>))}
          {!readOnly && r.days.length < 14 && <button type="button" className="secondary-button" onClick={() => setR({ ...r, days: [...r.days, { day_label: `Día ${String.fromCharCode(65 + r.days.length)}`, exercises: [] }] })}>Agregar día</button>}
        </div>
        <Field label="Notas generales"><textarea rows={2} value={r.notes || ""} maxLength={3000} onChange={(e) => setR({ ...r, notes: e.target.value })} /></Field>
      </fieldset>
    </Modal>
  );
}

function AssignModal({ routine, role, onClose, onDone, fail }: { routine: Routine; role: string; onClose: () => void; onDone: () => void; fail: (e: unknown) => void }) {
  const [m, setM] = useState<PickedMember | null>(null);
  const [from, setFrom] = useState(dayKey(new Date()));
  const [to, setTo] = useState("");
  async function save() {
    if (!m) { fail(new Error("Elegí a quién se la asignás")); return; }
    try { await appApi(`/members/${m.id}/routines`, { method: "POST", body: { routine_id: routine.id, from_date: from || null, to_date: to || null } }); onDone(); } catch (e) { fail(e); }
  }
  return (
    <Modal eyebrow="ASIGNAR RUTINA" title={routine.name} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Asignar</button></>}>
      <div className="product-form">
        {m ? <div className="cb-note cb-note-info">Para <strong>{m.name}</strong> <button className="c2-link" onClick={() => setM(null)}>Cambiar</button></div> :
          <MemberPicker autoFocus endpoint={(q) => `/training/members?q=${encodeURIComponent(q)}`} map={(r) => ({ id: r.id, name: r.full_name, dni: r.dni })} onPick={setM} />}
        <div className="c2-form-grid"><Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Hasta (opcional)"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>
        <p className="cb-muted">Se guarda una copia: si después editás la rutina, lo asignado no cambia.{role === "INSTRUCTOR" ? "" : ""}</p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- seguimiento por persona
function Follow({ role, canEdit, fail, show, word }: { role: string; canEdit: boolean; fail: (e: unknown) => void; show: (s: string) => void; word: string }) {
  const [m, setM] = useState<PickedMember | null>(null);
  const [sub, setSub] = useState<"rutinas" | "medidas" | "marcas" | "grados">("rutinas");
  return (
    <div className="c2-stack">
      <div className="cb-card c2-stack">
        {m ? <div className="cb-row"><strong style={{ fontSize: 18 }}>{m.name}</strong><button className="c2-link" onClick={() => setM(null)}>Elegir a otra persona</button></div> :
          <><p className="cb-muted" style={{ margin: 0 }}>Buscá a un {word} para ver y cargar sus rutinas, medidas, marcas y grados.</p>
            <MemberPicker endpoint={(q) => `/training/members?q=${encodeURIComponent(q)}`} map={(r) => ({ id: r.id, name: r.full_name, dni: r.dni })} onPick={setM} /></>}
      </div>
      {m && (
        <>
          <Seg value={sub} onChange={setSub} options={role === "RECEPCION" ? [["rutinas", "Rutinas"], ["marcas", "Marcas"], ["grados", "Grados"]] : [["rutinas", "Rutinas"], ["medidas", "Medidas"], ["marcas", "Marcas"], ["grados", "Grados"]]} />
          {sub === "rutinas" ? <MemberRoutines id={m.id} canEdit={canEdit} fail={fail} show={show} /> :
            sub === "medidas" ? <Measures id={m.id} canEdit={canEdit} role={role} fail={fail} show={show} /> :
            sub === "marcas" ? <Marks id={m.id} canEdit={canEdit} fail={fail} show={show} /> :
            <MemberRanks id={m.id} canEdit={canEdit} fail={fail} show={show} />}
        </>)}
    </div>
  );
}

function MemberRoutines({ id, canEdit, fail, show }: { id: number; canEdit: boolean; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [list, setList] = useState<MR[] | null>(null);
  const [open, setOpen] = useState<MR | null>(null);
  const load = useCallback(() => { appApi<MR[]>(`/members/${id}/routines`).then(setList).catch(fail); }, [id, fail]);
  useEffect(load, [load]);
  async function finish(mr: MR) { try { await appApi(`/member-routines/${mr.id}/finish`, { method: "POST" }); show("Rutina finalizada"); load(); } catch (e) { fail(e); } }
  if (!list) return <Loading />;
  if (list.length === 0) return <Empty title="No tiene rutinas asignadas">Asignale una desde la pestaña «Rutinas».</Empty>;
  return (
    <>
      <div className="cb-table-wrap"><table className="cb-table">
        <thead><tr><th>Rutina</th><th>Desde</th><th>Hasta</th><th>Estado</th><th></th></tr></thead>
        <tbody>{list.map((mr) => (
          <tr key={mr.id}><td><strong>{mr.routine_name}</strong></td><td>{shortDate(mr.from_date)}</td><td>{mr.to_date ? shortDate(mr.to_date) : "-"}</td>
            <td><Pill tone={mr.status === "VIGENTE" ? "green" : "gray"}>{mr.status === "VIGENTE" ? "Vigente" : "Finalizada"}</Pill></td>
            <td style={{ textAlign: "right" }}><div className="c2-actions" style={{ justifyContent: "flex-end" }}><button className="c2-link" onClick={() => setOpen(mr)}>Ver</button>
              {canEdit && mr.status === "VIGENTE" && <button className="c2-link" onClick={() => finish(mr)}>Finalizar</button>}</div></td></tr>))}</tbody></table></div>
      {open?.snapshot && <RoutineModal item={open.snapshot} readOnly onClose={() => setOpen(null)} onSaved={() => undefined} fail={fail} />}
    </>
  );
}

function Measures({ id, canEdit, role, fail, show }: { id: number; canEdit: boolean; role: string; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [data, setData] = useState<{ member: { health_consent: boolean }; items: Meas[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    appApi(`/members/${id}/measurements`).then(setData).catch(fail);
  }, [id, fail]);
  useEffect(load, [load]);
  async function del(x: Meas) { if (!window.confirm("¿Borrar esta medición?")) return; try { await appApi(`/members/${id}/measurements/${x.id}`, { method: "DELETE" }); show("Medición borrada"); load(); } catch (e) { fail(e); } }
  if (!data) return <Loading />;
  const series = (f: keyof Meas) => (data.items.filter((x) => x[f] != null).map((x) => ({ date: x.measured_at, value: Number(x[f]) })));
  return (
    <>
      <div className="cb-note cb-note-info">Las medidas son datos de salud: se guardan con consentimiento y cada vez que se ven queda registrado.</div>
      {canEdit && <div className="c2-toolbar" style={{ marginTop: 12 }}><button className="primary-button" onClick={() => setAdding(true)}>Cargar medición</button></div>}
      {data.items.length === 0 ? <Empty title="Todavía no tiene mediciones" /> : (
        <>
          <div className="c2-two" style={{ marginBottom: 14 }}>
            <LineChart title="Peso" unit="kg" points={series("weight_kg")} />
            <LineChart title="Grasa corporal" unit="%" points={series("body_fat_pct")} />
            <LineChart title="Cintura" unit="cm" points={series("waist_cm")} />
            <LineChart title="Masa muscular" unit="kg" points={series("muscle_kg")} />
          </div>
          <div className="cb-table-wrap"><table className="cb-table">
            <thead><tr><th>Fecha</th><th className="num">Peso</th><th className="num">IMC</th><th className="num">Grasa</th><th className="num">Cintura</th><th></th></tr></thead>
            <tbody>{[...data.items].reverse().map((x) => (
              <tr key={x.id}><td>{shortDate(x.measured_at)}{x.note && <small>{x.note}</small>}</td><td className="num">{x.weight_kg ?? "-"}</td><td className="num">{x.bmi ?? "-"}</td><td className="num">{x.body_fat_pct ?? "-"}</td><td className="num">{x.waist_cm ?? "-"}</td>
                <td style={{ textAlign: "right" }}>{(role === "ADMINISTRADOR" || role === "ENCARGADO") && <button className="c2-link" onClick={() => del(x)}>Borrar</button>}</td></tr>))}</tbody></table></div>
        </>)}
      {adding && <MeasModal id={id} consent={data.member.health_consent} onClose={() => setAdding(false)} fail={fail} onSaved={() => { setAdding(false); show("Medición guardada"); load(); }} />}
    </>
  );
}

function MeasModal({ id, consent, onClose, onSaved, fail }: { id: number; consent: boolean; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const { form, set } = useForm<Record<string, any>>({ measured_at: dayKey(new Date()), note: "", consent: false });
  const [saving, setSaving] = useState(false);
  async function save() {
    const body: Record<string, any> = { measured_at: form.measured_at || null, note: (form.note || "").trim() || null, consent: form.consent };
    let any = false;
    MEAS.forEach(([k]) => { const v = form[k as string]; if (v !== undefined && v !== "") { body[k as string] = num(v); any = true; } });
    if (!any) { fail(new Error("Cargá al menos una medida")); return; }
    setSaving(true);
    try { await appApi(`/members/${id}/measurements`, { method: "POST", body }); onSaved(); } catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="MEDICIÓN" title="Nueva medición" size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>Guardar</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Fecha"><input type="date" max={dayKey(new Date())} value={form.measured_at} onChange={(e) => set("measured_at", e.target.value)} /></Field>
        {MEAS.map(([k, l, u]) => <Field key={k as string} label={`${l} (${u})`}><input inputMode="decimal" value={form[k as string] ?? ""} onChange={(e) => set(k as string, e.target.value)} /></Field>)}
        <Field label="Nota (opcional)" wide><input value={form.note} maxLength={300} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
      {!consent && <div className="c2-consent" style={{ marginTop: 12 }}><label className="c2-check"><input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
        <span>La persona (o su responsable, si es menor) aceptó que el club guarde sus datos de salud y medidas. Son datos sensibles.</span></label></div>}
    </Modal>
  );
}

function Marks({ id, canEdit, fail, show }: { id: number; canEdit: boolean; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [items, setItems] = useState<Perf[] | null>(null);
  const [prog, setProg] = useState<Progress | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    appApi<{ items: Perf[] }>(`/members/${id}/performance`).then((r) => setItems(r.items)).catch(fail);
    appApi<Progress>(`/members/${id}/progress`).then(setProg).catch(() => setProg(null));
  }, [id, fail]);
  useEffect(load, [load]);
  if (!items) return <Loading />;
  const charts = (prog?.performance || []).filter((p) => p.points.length >= 2).slice(0, 4);
  return (
    <>
      {canEdit && <div className="c2-toolbar"><button className="primary-button" onClick={() => setAdding(true)}>Cargar marca</button></div>}
      {items.length === 0 ? <Empty title="Todavía no tiene marcas">Cargá pesos levantados, tiempos o resultados de WOD para ver su evolución.</Empty> : (
        <>
          {charts.length > 0 && <div className="c2-two" style={{ marginBottom: 14 }}>{charts.map((c, i) => <LineChart key={i} title={c.name} unit={c.unit} points={c.points} />)}</div>}
          <div className="cb-table-wrap"><table className="cb-table">
            <thead><tr><th>Fecha</th><th>Marca</th><th className="num">Resultado</th><th></th></tr></thead>
            <tbody>{items.map((p) => (
              <tr key={p.id}><td>{shortDate(p.recorded_at)}</td><td><strong>{p.name}</strong><small>{PERF_KINDS.find((k) => k[0] === p.kind)?.[1]}{p.rx ? " · Rx" : ""}{p.note ? ` · ${p.note}` : ""}</small></td>
                <td className="num">{p.value ?? "-"} {p.unit || ""}</td><td>{p.is_best && <Pill tone="green">Mejor marca</Pill>}</td></tr>))}</tbody></table></div>
        </>)}
      {adding && <MarkModal id={id} onClose={() => setAdding(false)} fail={fail} onSaved={() => { setAdding(false); show("Marca guardada"); load(); }} />}
    </>
  );
}

function MarkModal({ id, onClose, onSaved, fail }: { id: number; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const { form, set } = useForm({ kind: "FUERZA", exercise_or_name: "", value_num: "", unit: "kg", rx: false, recorded_at: dayKey(new Date()), note: "" });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.exercise_or_name.trim()) { fail(new Error("Escribí qué ejercicio o WOD fue")); return; }
    setSaving(true);
    try { await appApi(`/members/${id}/performance`, { method: "POST", body: { kind: form.kind, exercise_or_name: form.exercise_or_name.trim(), value_num: form.value_num === "" ? null : num(form.value_num), unit: form.unit.trim() || null, rx: form.rx, recorded_at: form.recorded_at || null, note: form.note.trim() || null } }); onSaved(); }
    catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="MARCA" title="Nueva marca" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>Guardar</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Tipo"><select value={form.kind} onChange={(e) => { set("kind", e.target.value); set("unit", e.target.value === "FUERZA" ? "kg" : e.target.value === "TIEMPO" ? "min" : e.target.value === "DISTANCIA" ? "m" : ""); }}>{PERF_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Ejercicio o WOD"><input value={form.exercise_or_name} maxLength={120} onChange={(e) => set("exercise_or_name", e.target.value)} placeholder="Ej: Back squat, Fran" /></Field>
        <Field label="Resultado"><input inputMode="decimal" value={form.value_num} onChange={(e) => set("value_num", e.target.value)} /></Field>
        <Field label="Unidad"><input value={form.unit} maxLength={20} onChange={(e) => set("unit", e.target.value)} /></Field>
        <Field label="Fecha"><input type="date" max={dayKey(new Date())} value={form.recorded_at} onChange={(e) => set("recorded_at", e.target.value)} /></Field>
        <Field label="Nota"><input value={form.note} maxLength={300} onChange={(e) => set("note", e.target.value)} /></Field>
        {form.kind === "WOD" && <label className="c2-check"><input type="checkbox" checked={form.rx} onChange={(e) => set("rx", e.target.checked)} /> Lo hizo como está escrito (Rx)</label>}
      </div>
    </Modal>
  );
}

function MemberRanks({ id, canEdit, fail, show }: { id: number; canEdit: boolean; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [data, setData] = useState<{ items: MRank[]; current: MRank[] } | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [rankId, setRankId] = useState("");
  const [examiner, setExaminer] = useState("");
  const load = useCallback(() => { appApi(`/members/${id}/ranks`).then(setData).catch(fail); appApi<Rank[]>("/ranks").then(setRanks).catch(() => setRanks([])); }, [id, fail]);
  useEffect(load, [load]);
  async function award() {
    if (!rankId) { fail(new Error("Elegí el grado")); return; }
    try { await appApi(`/members/${id}/ranks`, { method: "POST", body: { rank_id: Number(rankId), examiner: examiner.trim() || null } }); show("Grado registrado"); setRankId(""); setExaminer(""); load(); } catch (e) { fail(e); }
  }
  if (!data) return <Loading />;
  return (
    <div className="c2-stack">
      {data.current.length > 0 && <div className="c2-grid-kpi">{data.current.map((c) => <Stat key={c.id} label={c.activity_name || "Grado actual"} value={c.rank_name} hint={`Desde ${shortDate(c.achieved_at)}`} />)}</div>}
      {canEdit && ranks.length > 0 && (
        <div className="cb-card c2-toolbar" style={{ marginBottom: 0 }}>
          <select value={rankId} onChange={(e) => setRankId(e.target.value)} aria-label="Grado"><option value="">Otorgar un grado...</option>{ranks.map((r) => <option key={r.id} value={r.id}>{r.activity_name ? `${r.activity_name}: ` : ""}{r.name}</option>)}</select>
          <input value={examiner} maxLength={120} onChange={(e) => setExaminer(e.target.value)} placeholder="Quién lo evaluó (opcional)" aria-label="Examinador" />
          <button className="primary-button" onClick={award}>Registrar</button>
        </div>)}
      {canEdit && ranks.length === 0 && <div className="cb-note cb-note-info">Todavía no hay grados definidos. Se crean en la pestaña «Grados».</div>}
      {data.items.length === 0 ? <Empty title="Todavía no tiene grados registrados" /> : (
        <ul className="c2-roster">{data.items.map((g) => <li key={g.id}><div><strong>{g.rank_name}</strong><small>{g.activity_name || ""}{g.examiner ? ` · evaluó ${g.examiner}` : ""}</small></div><span>{shortDate(g.achieved_at)}</span></li>)}</ul>)}
    </div>
  );
}

// ---------------------------------------------------------------- grados
function Ranks({ role, canEdit, fail, show }: { role: string; canEdit: boolean; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [ranks, setRanks] = useState<Rank[] | null>(null);
  const [edit, setEdit] = useState<Rank | "new" | null>(null);
  const [acts, setActs] = useState<{ id: number; name: string }[]>([]);
  const manager = role === "ADMINISTRADOR" || role === "ENCARGADO";
  const load = useCallback(() => {
    appApi<Overview>("/ranks/overview").then(setOv).catch(fail);
    appApi<Rank[]>("/ranks").then(setRanks).catch(fail);
    appApi("/activities").then(setActs).catch(() => setActs([]));
  }, [fail]);
  useEffect(load, [load]);
  if (!ov || !ranks) return <Loading />;
  return (
    <div className="c2-stack">
      <div className="cb-note cb-note-info">«Puede rendir» es un criterio orientativo: al menos {ov.min_months} meses en el grado actual y {ov.min_classes} clases desde que lo obtuvo. La decisión es del instructor.</div>
      {manager && <div className="c2-toolbar"><button className="primary-button" onClick={() => setEdit("new")}>Agregar grado</button></div>}
      {ranks.length === 0 ? <Empty title="No hay grados definidos">Si tu actividad usa cinturones, niveles o grados, definilos acá. Podés cargar los de tu rubro desde la configuración.</Empty> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Orden</th><th>Grado</th><th>Actividad</th></tr></thead>
          <tbody>{ranks.map((r) => <tr key={r.id} className={manager ? "is-click" : ""} onClick={() => manager && setEdit(r)}><td>{r.order}</td>
            <td><span className="c2-color-dot" style={{ ["--c2-color" as any]: r.color || undefined }} /><strong>{r.name}</strong></td><td>{r.activity_name || "Todas"}</td></tr>)}</tbody></table></div>)}
      {ov.activities.map((a) => (
        <div key={a.activity_id} className="cb-card c2-stack">
          <div className="cb-card-head"><div><h2>{a.activity_name}</h2><p>{a.members.filter((m) => m.can_take_exam).length} pueden rendir</p></div></div>
          {a.members.length === 0 ? <Empty title="Nadie entrena esta actividad todavía" /> : (
            <div className="cb-table-wrap"><table className="cb-table">
              <thead><tr><th>Persona</th><th>Grado</th><th className="num">Meses</th><th className="num">Clases</th><th>Próximo</th></tr></thead>
              <tbody>{a.members.map((m) => (
                <tr key={m.member_id}><td><strong>{m.name}</strong></td><td>{m.rank_name}</td><td className="num">{m.months ?? "-"}</td><td className="num">{m.classes}</td>
                  <td>{m.next_rank_name ? (m.can_take_exam ? <Pill tone="green">Puede rendir: {m.next_rank_name}</Pill> : m.next_rank_name) : "Último grado"}</td></tr>))}</tbody></table></div>)}
        </div>))}
      {edit && manager && <RankModal item={edit === "new" ? null : edit} acts={acts} onClose={() => setEdit(null)} fail={fail} onSaved={() => { setEdit(null); load(); show("Guardado"); }} />}
      {!canEdit && null}
    </div>
  );
}

function RankModal({ item, acts, onClose, onSaved, fail }: { item: Rank | null; acts: { id: number; name: string }[]; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const { form, set } = useForm({ name: item?.name || "", order: String(item?.order ?? 0), activity_id: String(item?.activity_id || ""), color: item?.color || "#1f2a5c" });
  async function save() {
    if (!form.name.trim()) { fail(new Error("Escribí el nombre del grado")); return; }
    try { await appApi(item ? `/ranks/${item.id}` : "/ranks", { method: item ? "PUT" : "POST", body: { name: form.name.trim(), order: num(form.order), activity_id: form.activity_id ? Number(form.activity_id) : null, color: form.color } }); onSaved(); } catch (e) { fail(e); }
  }
  async function del() { if (!item || !window.confirm("¿Borrar este grado?")) return; try { await appApi(`/ranks/${item.id}`, { method: "DELETE" }); onSaved(); } catch (e) { fail(e); } }
  return (
    <Modal eyebrow="GRADO" title={item ? item.name : "Nuevo grado"} onClose={onClose}
      footer={<>{item && <button className="cb-danger-button" onClick={del}>Borrar</button>}<button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Nombre"><input value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Orden" hint="Menor es más básico."><input type="number" min={0} value={form.order} onChange={(e) => set("order", e.target.value)} /></Field>
        <Field label="Actividad"><select value={form.activity_id} onChange={(e) => set("activity_id", e.target.value)}><option value="">Todas</option>{acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Color"><input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- pizarra
function Board({ canEdit, fail, show }: { canEdit: boolean; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [day, setDay] = useState(dayKey(new Date()));
  const [items, setItems] = useState<Wod[] | null>(null);
  const [edit, setEdit] = useState<Wod | "new" | null>(null);
  const [tv, setTv] = useState(false);
  const load = useCallback(() => { appApi<{ items: Wod[] }>(`/wod?date=${day}`).then((r) => setItems(r.items)).catch(fail); }, [day, fail]);
  useEffect(() => { setItems(null); load(); }, [load]);
  const board = (big: boolean) => (items || []).map((w) => (
    <div key={w.id} className={`c2-wod ${big ? "" : ""}`} style={big ? { border: 0, padding: 0, background: "transparent" } : undefined}>
      <h2 style={{ margin: 0, color: "var(--cb-ink)" }}>{w.title}</h2>{w.activity_name && <small className="cb-muted">{w.activity_name}</small>}
      {w.body && <pre>{w.body}</pre>}
      {!big && canEdit && <div className="c2-actions" style={{ marginTop: 10 }}><button className="c2-link" onClick={() => setEdit(w)}>Editar</button></div>}
    </div>));
  return (
    <>
      <div className="c2-toolbar">
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Día" />
        {canEdit && <button className="primary-button" onClick={() => setEdit("new")}>Cargar la pizarra</button>}
        {items && items.length > 0 && <button className="secondary-button" onClick={() => setTv(true)}>Modo pantalla (TV)</button>}
      </div>
      {!items ? <Loading /> : items.length === 0 ? <Empty title="No hay nada cargado para este día">La pizarra del día es lo que se entrena hoy (WOD, circuito o clase). Se puede mostrar en una pantalla del local.</Empty> : <div className="c2-stack">{board(false)}</div>}
      {tv && <div className="c2-wod is-tv" role="dialog" aria-label="Pizarra"><button className="secondary-button" style={{ position: "fixed", top: 14, right: 14 }} onClick={() => setTv(false)}>Cerrar</button>{board(true)}</div>}
      {edit && <WodModal item={edit === "new" ? null : edit} day={day} onClose={() => setEdit(null)} fail={fail} onSaved={() => { setEdit(null); load(); show("Pizarra guardada"); }} />}
    </>
  );
}

function WodModal({ item, day, onClose, onSaved, fail }: { item: Wod | null; day: string; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const { form, set } = useForm({ title: item?.title || "", body: item?.body || "" });
  async function save() {
    if (!form.title.trim()) { fail(new Error("Escribí un título")); return; }
    try { await appApi(item ? `/wod/${item.id}` : "/wod", { method: item ? "PUT" : "POST", body: { day: item?.day || day, title: form.title.trim(), body: form.body.trim() || null, activity_id: item?.activity_id ?? null } }); onSaved(); } catch (e) { fail(e); }
  }
  async function del() { if (!item || !window.confirm("¿Borrar esta pizarra?")) return; try { await appApi(`/wod/${item.id}`, { method: "DELETE" }); onSaved(); } catch (e) { fail(e); } }
  return (
    <Modal eyebrow="PIZARRA DEL DÍA" title={item ? item.title : "Nueva pizarra"} onClose={onClose}
      footer={<>{item && <button className="cb-danger-button" onClick={del}>Borrar</button>}<button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <Field label="Título"><input value={form.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="Ej: WOD del día" /></Field>
        <Field label="Contenido"><textarea rows={8} value={form.body} maxLength={4000} onChange={(e) => set("body", e.target.value)} placeholder={"21-15-9\nThrusters\nPull-ups"} /></Field>
      </div>
    </Modal>
  );
}

export default Index;
