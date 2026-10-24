import { useCallback, useEffect, useState } from "react";
import { appApi, dayKey, getSessionUser, shortDate, useVocab } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, Tabs, useFlash, useForm } from "../../../components/ui";
import { AptoPill, PrintOverlay, Stat, useTab } from "../../../components/c2/shared";
import InspectionSheet from "../../print/Inspeccion";
import type { InspectionData } from "../../print/Inspeccion";
import "../../../c2.css";

interface Row { member_id: number; name: string; dni: string; apto: { state: string; label: string; valid_until: string | null }; pool: { state: string; label: string } | null; consent: boolean }
interface List { items: Row[]; total: number; page: number; limit: number; counts: Record<string, number>; required_mode: string; validity_days: number }
interface Rec {
  id: number; kind: string; kind_label: string; issued_at: string | null; valid_until: string | null; state?: { state: string; label: string };
  doctor_name?: string | null; doctor_license?: string | null; note?: string | null; restrictions?: string | null; positive?: boolean;
}
interface Ficha {
  member: { id: number; name: string; dni: string }; apto: { state: string; label: string }; pool: { state: string; label: string } | null;
  consent: { given: boolean; at: string | null }; can_load: boolean; can_read_notes: boolean; can_delete: boolean; items: Rec[];
}
interface Comp {
  id: number; owner_type: string; owner_id: number | null; owner_name: string; kind: string; kind_label: string; label: string; number: string | null;
  issued_at: string | null; valid_until: string | null; note: string | null; active: boolean; state: string; days: number | null; state_label: string;
}
interface CompList { items: Comp[]; missing: { kind: string; label: string }[]; kinds: { kind: string; label: string }[]; staff_kinds: string[]; counts: Record<string, number> }

const C_TONE: Record<string, string> = { VIGENTE: "green", POR_VENCER: "orange", VENCIDO: "red", SIN_VENCIMIENTO: "gray" };
const STATES: [string, string][] = [["", "Todos"], ["VENCIDO", "Vencidos"], ["POR_VENCER", "Por vencer"], ["SIN_APTO", "Sin apto"], ["VIGENTE", "Vigentes"]];
type TabKey = "aptos" | "legajo" | "planilla";

function Index() {
  const { t } = useVocab();
  const role = getSessionUser()?.role || "";
  const isManager = role === "ADMINISTRADOR" || role === "ENCARGADO";
  const [tab, setTab] = useTab<TabKey>(["aptos", "legajo", "planilla"], "aptos");
  const { show, fail, node: flash } = useFlash();
  const opts: [TabKey, string][] = [["aptos", "Aptos médicos"]];
  if (isManager) opts.push(["legajo", "Legajo del local"], ["planilla", "Planilla de inspección"]);
  return (
    <section className="products-page">
      <PageHeader eyebrow="SALUD Y CUMPLIMIENTO" title="Salud" subtitle={`Aptos médicos de tus ${t("member")}s y documentación del local. Los datos de salud son sensibles: se cargan con consentimiento y cada lectura queda registrada.`} />
      {opts.length > 1 && <Tabs value={tab} onChange={setTab} options={opts} />}
      {tab === "aptos" || !isManager ? <Aptos role={role} fail={fail} show={show} word={t("member")} /> : tab === "legajo" ? <Legajo fail={fail} show={show} /> : <Planilla fail={fail} />}
      {flash}
    </section>
  );
}

function Aptos({ role, fail, show, word }: { role: string; fail: (e: unknown) => void; show: (s: string) => void; word: string }) {
  const initial = new URLSearchParams(window.location.search).get("estado") || "";
  const [status, setStatus] = useState(STATES.some((s) => s[0] === initial) ? initial : "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<List | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(() => {
    appApi<List>(`/health/members?page=${page}&limit=30${status ? `&status=${status}` : ""}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`).then(setData).catch(fail);
  }, [status, q, page, fail]);
  useEffect(() => { const h = window.setTimeout(load, 200); return () => window.clearTimeout(h); }, [load]);
  useEffect(() => { setPage(1); }, [status, q]);
  return (
    <>
      {data && (
        <div className="c2-grid-kpi">
          <Stat label="Vencidos" value={data.counts.VENCIDO} tone={data.counts.VENCIDO ? "red" : undefined} />
          <Stat label="Por vencer (30 días)" value={data.counts.POR_VENCER} tone={data.counts.POR_VENCER ? "orange" : undefined} />
          <Stat label="Sin apto" value={data.counts.SIN_APTO} />
          <Stat label="Vigentes" value={data.counts.VIGENTE} tone="green" />
        </div>)}
      {data?.required_mode === "NO" && <div className="cb-note cb-note-info" style={{ marginBottom: 12 }}>Tu club no exige apto médico: igual podés llevar el control acá.</div>}
      <div className="c2-toolbar">
        <input type="search" className="c2-grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${word} por nombre o DNI`} aria-label="Buscar" />
        <Seg value={status} onChange={setStatus} options={STATES} />
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title={q || status ? "No hay nadie con ese filtro" : `Todavía no hay ${word}s activos`} /> : (
        <>
          <div className="cb-table-wrap"><table className="cb-table">
            <thead><tr><th>Persona</th><th>Apto médico</th><th>Vence</th><th>Pileta</th><th>Consentimiento</th></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.member_id} className="is-click" onClick={() => setOpen(r.member_id)}>
                <td><strong>{r.name}</strong><small>DNI {r.dni}</small></td>
                <td><AptoPill state={r.apto.state} /><small>{r.apto.label}</small></td>
                <td>{r.apto.valid_until ? shortDate(r.apto.valid_until) : "-"}</td>
                <td>{r.pool ? <AptoPill state={r.pool.state} /> : "-"}</td>
                <td>{r.consent ? <Pill tone="green">Dado</Pill> : <Pill tone="gray">Pendiente</Pill>}</td></tr>))}</tbody></table></div>
          {data.total > data.limit && (
            <div className="c2-toolbar" style={{ marginTop: 12 }}>
              <button className="secondary-button c2-small-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Anterior</button>
              <span className="cb-muted">Página {page} de {Math.ceil(data.total / data.limit)}</span>
              <button className="secondary-button c2-small-btn" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Siguiente ›</button>
            </div>)}
        </>)}
      {open && <FichaModal id={open} role={role} onClose={() => setOpen(null)} onChanged={load} fail={fail} show={show} />}
    </>
  );
}

function FichaModal({ id, role, onClose, onChanged, fail, show }: { id: number; role: string; onClose: () => void; onChanged: () => void; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [f, setF] = useState<Ficha | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { appApi<Ficha>(`/members/${id}/health`).then(setF).catch(fail); }, [id, fail]);
  useEffect(() => { load(); }, [load]);
  async function remove(r: Rec) {
    const reason = window.prompt(`¿Borrar «${r.kind_label}»? Escribí el motivo (queda registrado).`);
    if (!reason || !reason.trim()) return;
    try { await appApi(`/health/${r.id}?reason=${encodeURIComponent(reason.trim())}`, { method: "DELETE" }); show("Registro borrado"); load(); onChanged(); } catch (e) { fail(e); }
  }
  async function revoke() {
    const reason = window.prompt("Motivo de la revocación del consentimiento:");
    if (!reason || !reason.trim()) return;
    try { await appApi(`/members/${id}/health-consent`, { method: "POST", body: { accepted: false, reason: reason.trim() } }); show("Consentimiento revocado"); load(); onChanged(); } catch (e) { fail(e); }
  }
  if (!f) return <Modal title="Cargando..." onClose={onClose}><Loading /></Modal>;
  return (
    <Modal eyebrow="FICHA DE SALUD" title={f.member.name} size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cerrar</button>{f.can_load && !adding && <button className="primary-button" onClick={() => setAdding(true)}>Cargar apto o dato</button>}</>}>
      <div className="cb-detail-grid">
        <div><small>DNI</small><strong>{f.member.dni}</strong></div>
        <div><small>Apto médico</small><AptoPill state={f.apto.state} /><small>{f.apto.label}</small></div>
        {f.pool && <div><small>Apto de pileta</small><AptoPill state={f.pool.state} /><small>{f.pool.label}</small></div>}
        <div><small>Consentimiento</small><strong>{f.consent.given ? `Dado el ${shortDate((f.consent.at || "").slice(0, 10))}` : "Todavía no"}</strong>
          {f.consent.given && role !== "RECEPCION" && f.can_delete && <button className="c2-link" onClick={revoke}>Revocar</button>}</div>
      </div>
      {!f.can_read_notes && <div className="cb-note cb-note-info" style={{ marginTop: 10 }}>Desde recepción ves solo el estado y el vencimiento de los aptos.</div>}
      {adding && <AddForm id={id} f={f} role={role} fail={fail} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); show("Guardado"); load(); onChanged(); }} />}
      <h3 className="cb-form-title">Historial</h3>
      {f.items.length === 0 ? <Empty title="No hay registros cargados" /> : (
        <ul className="c2-roster">{f.items.map((r) => (
          <li key={r.id}>
            <div><strong>{r.kind_label}</strong>
              <small>{r.issued_at ? `Emitido ${shortDate(r.issued_at)}` : ""}{r.valid_until ? ` · vence ${shortDate(r.valid_until)}` : ""}{r.doctor_name ? ` · Dr/a. ${r.doctor_name}` : ""}{r.doctor_license ? ` (M.P. ${r.doctor_license})` : ""}</small>
              {r.kind === "PARQ" && <small>{r.positive ? "Alguna respuesta afirmativa: consultar al médico antes de entrenar" : "Sin respuestas afirmativas"}</small>}
              {r.restrictions && <small>Restricciones: {r.restrictions}</small>}{r.note && <small>{r.note}</small>}</div>
            <div className="cb-row">{r.state && <AptoPill state={r.state.state} />}{f.can_delete && <button className="c2-link" onClick={() => remove(r)}>Borrar</button>}</div>
          </li>))}</ul>)}
    </Modal>
  );
}

function AddForm({ id, f, role, fail, onCancel, onSaved }: { id: number; f: Ficha; role: string; fail: (e: unknown) => void; onCancel: () => void; onSaved: () => void }) {
  const { form, set } = useForm({ kind: "APTO_MEDICO", issued_at: dayKey(new Date()), valid_until: "", doctor_name: "", doctor_license: "", note: "", restrictions: "", positive: false, consent: false });
  const [saving, setSaving] = useState(false);
  const isApto = form.kind.startsWith("APTO");
  const kinds: [string, string][] = role === "RECEPCION" ? [["APTO_MEDICO", "Apto médico"], ["APTO_PILETA", "Apto de pileta"]]
    : [["APTO_MEDICO", "Apto médico"], ["APTO_PILETA", "Apto de pileta"], ["PARQ", "Declaración de salud (PAR-Q)"], ["LESION", "Lesión o limitación"]];
  async function save() {
    setSaving(true);
    const c = (v: string) => v.trim() || null;
    try {
      await appApi(`/members/${id}/health`, { method: "POST", body: { kind: form.kind, issued_at: isApto ? form.issued_at || null : null, valid_until: isApto ? c(form.valid_until) : null,
        doctor_name: isApto ? c(form.doctor_name) : null, doctor_license: isApto ? c(form.doctor_license) : null, note: c(form.note), restrictions: form.kind === "LESION" ? c(form.restrictions) : null,
        positive: form.kind === "PARQ" ? form.positive : false, consent: form.consent } });
      onSaved();
    } catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <div className="cb-card c2-stack" style={{ marginTop: 12 }}>
      <div className="product-form c2-form-grid">
        <Field label="Qué cargás"><select value={form.kind} onChange={(e) => set("kind", e.target.value)}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {isApto && <Field label="Fecha de emisión"><input type="date" max={dayKey(new Date())} value={form.issued_at} onChange={(e) => set("issued_at", e.target.value)} /></Field>}
        {isApto && <Field label="Vence el (opcional)" hint="Si lo dejás vacío, se usa la validez que configuró el club."><input type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></Field>}
        {isApto && <Field label="Médico (opcional)"><input value={form.doctor_name} maxLength={120} onChange={(e) => set("doctor_name", e.target.value)} /></Field>}
        {isApto && <Field label="Matrícula (opcional)"><input value={form.doctor_license} maxLength={40} onChange={(e) => set("doctor_license", e.target.value)} /></Field>}
        {form.kind === "PARQ" && <label className="c2-check"><input type="checkbox" checked={form.positive} onChange={(e) => set("positive", e.target.checked)} /> Marcó alguna respuesta afirmativa</label>}
        {form.kind === "LESION" && <Field label="Restricción para entrenar"><input value={form.restrictions} maxLength={300} onChange={(e) => set("restrictions", e.target.value)} placeholder="Ej: evitar saltos" /></Field>}
        <Field label="Observación breve (opcional)" hint="Sin diagnósticos ni imágenes del certificado." wide><input value={form.note} maxLength={200} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
      {!f.consent.given && (
        <div className="c2-consent">
          <label className="c2-check"><input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
            <span>La persona (o su responsable, si es menor) aceptó que el club guarde sus datos de salud para controlar su aptitud para entrenar. Son datos sensibles, solo los ve el equipo autorizado y puede pedir que se borren.</span></label>
        </div>)}
      <div className="c2-actions"><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button><button className="secondary-button" onClick={onCancel}>Cancelar</button></div>
    </div>
  );
}

// ---------------------------------------------------------------- legajo
function Legajo({ fail, show }: { fail: (e: unknown) => void; show: (s: string) => void }) {
  const [data, setData] = useState<CompList | null>(null);
  const [edit, setEdit] = useState<Comp | { kind?: string } | null>(null);
  const load = useCallback(() => { appApi<CompList>("/compliance").then(setData).catch(fail); }, [fail]);
  useEffect(load, [load]);
  if (!data) return <Loading />;
  return (
    <>
      <div className="c2-grid-kpi">
        <Stat label="Vencidos" value={data.counts.VENCIDO} tone={data.counts.VENCIDO ? "red" : undefined} />
        <Stat label="Por vencer (30 días)" value={data.counts.POR_VENCER} tone={data.counts.POR_VENCER ? "orange" : undefined} />
        <Stat label="Vigentes" value={data.counts.VIGENTE} tone="green" />
      </div>
      <div className="c2-toolbar"><button className="primary-button" onClick={() => setEdit({})}>Agregar documento</button></div>
      {data.missing.length > 0 && (
        <div className="cb-note cb-note-info" style={{ marginBottom: 12 }}>
          <strong>Sugerido para tener cargado en el local:</strong>{" "}
          {data.missing.map((m) => <button key={m.kind} className="c2-link" style={{ marginRight: 10 }} onClick={() => setEdit({ kind: m.kind })}>{m.label}</button>)}
          <div className="cb-muted">Es una sugerencia general: confirmá con tu municipio qué te exigen.</div>
        </div>)}
      {data.items.length === 0 ? <Empty title="Todavía no cargaste documentación">Habilitación, seguro, DEA, matrículas: el sistema te avisa 30 días antes de que venzan.</Empty> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Documento</th><th>De quién</th><th>Número</th><th>Vence</th><th>Estado</th></tr></thead>
          <tbody>{data.items.map((c) => (
            <tr key={c.id} className="is-click" onClick={() => setEdit(c)}>
              <td><strong>{c.label}</strong><small>{c.kind_label}</small></td><td>{c.owner_name}</td><td>{c.number || "-"}</td>
              <td>{c.valid_until ? shortDate(c.valid_until) : "-"}</td><td><Pill tone={C_TONE[c.state]}>{c.state_label}</Pill></td></tr>))}</tbody></table></div>)}
      {edit && <CompModal item={edit} kinds={data.kinds} onClose={() => setEdit(null)} fail={fail} onSaved={() => { setEdit(null); load(); show("Guardado"); }} />}
    </>
  );
}

function CompModal({ item, kinds, onClose, onSaved, fail }: { item: Comp | { kind?: string }; kinds: { kind: string; label: string }[]; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const cur = "id" in item ? (item as Comp) : null;
  const [people, setPeople] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { appApi<any[]>("/instructors?active=true").then((r) => setPeople(r.map((i) => ({ id: i.id, name: i.name || `${i.first_name} ${i.last_name}` })))).catch(() => setPeople([])); }, []);
  const { form, set } = useForm({ owner: cur ? (cur.owner_type === "LOCAL" ? "LOCAL" : String(cur.owner_id)) : "LOCAL", kind: cur?.kind || (item as any).kind || "HABILITACION_MUNICIPAL",
    label: cur?.label || "", number: cur?.number || "", issued_at: cur?.issued_at || "", valid_until: cur?.valid_until || "", note: cur?.note || "", active: cur ? cur.active : true });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const c = (v: string) => v.trim() || null;
    const body = { owner_type: form.owner === "LOCAL" ? "LOCAL" : "INSTRUCTOR", owner_id: form.owner === "LOCAL" ? null : Number(form.owner), kind: form.kind, label: c(form.label),
      number: c(form.number), issued_at: form.issued_at || null, valid_until: form.valid_until || null, note: c(form.note), active: form.active };
    try { await appApi(cur ? `/compliance/${cur.id}` : "/compliance", { method: cur ? "PUT" : "POST", body }); onSaved(); } catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="LEGAJO" title={cur ? cur.label : "Nuevo documento"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>Guardar</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="De quién"><select value={form.owner} onChange={(e) => set("owner", e.target.value)}><option value="LOCAL">Del local</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Tipo"><select value={form.kind} onChange={(e) => set("kind", e.target.value)}>{kinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select></Field>
        <Field label="Nombre (opcional)" hint="Si lo dejás vacío se usa el tipo."><input value={form.label} maxLength={160} onChange={(e) => set("label", e.target.value)} /></Field>
        <Field label="Número o póliza"><input value={form.number} maxLength={60} onChange={(e) => set("number", e.target.value)} /></Field>
        <Field label="Emitido el"><input type="date" value={form.issued_at} onChange={(e) => set("issued_at", e.target.value)} /></Field>
        <Field label="Vence el"><input type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></Field>
        <Field label="Nota" wide><input value={form.note} maxLength={300} onChange={(e) => set("note", e.target.value)} /></Field>
        <label className="c2-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Vigente en el legajo</label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- planilla
function Planilla({ fail }: { fail: (e: unknown) => void }) {
  const [data, setData] = useState<InspectionData | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => { appApi<InspectionData>("/compliance/inspection-sheet").then(setData).catch(fail); }, [fail]);
  if (!data) return <Loading />;
  return (
    <div className="c2-stack">
      <div className="cb-note cb-note-info">Esta planilla junta la documentación del local y del equipo, y un resumen de aptos, para mostrar en una inspección. No incluye datos personales de los {`socios`}.</div>
      <div className="c2-actions"><button className="primary-button" onClick={() => setShow(true)}>Ver e imprimir la planilla</button></div>
      <div className="cb-card"><InspectionSheet data={data} /></div>
      {show && <PrintOverlay title="Planilla de inspección" onClose={() => setShow(false)}><InspectionSheet data={data} /></PrintOverlay>}
    </div>
  );
}

export default Index;
