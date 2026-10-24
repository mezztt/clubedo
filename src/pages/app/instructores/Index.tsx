import { useCallback, useEffect, useState } from "react";
import { appApi, currentPeriod, getSessionUser, money, PAYMENT_LABELS, PAYMENT_METHODS, periodLabel, shiftPeriod, shortDate, useVocab, WEEKDAYS } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, useFlash, useForm } from "../../../components/ui";
import { PrintOverlay, Stat, num, useTab } from "../../../components/c2/shared";
import SettlementSheet from "../../print/Liquidacion";
import type { SettlementPrint } from "../../print/Liquidacion";
import "../../../c2.css";

interface Instr {
  id: number; first_name: string; last_name: string; name: string; dni: string | null; phone: string | null; email: string | null;
  license_number: string | null; employment: string; bio: string | null; active: boolean; photo_data?: string | null;
  schedule?: { id: number; weekday: number; start_time: string; duration_min: number; activity_name: string | null }[]; month?: { period: string; classes_taught: number };
}
interface Rule {
  id: number; instructor_id: number | null; instructor_name: string; kind: string; kind_label: string; activity_id: number | null; activity_name: string | null;
  amount_or_pct: number; is_pct: boolean; min_attendees: number | null; valid_from: string | null; valid_to: string | null; active: boolean;
}
interface Entry { id: number; instructor_id: number; instructor_name: string; kind_label: string; description: string; base_amount: number; commission_amount: number; status: string }
interface Comm { period: string; items: Entry[]; totals: { instructor_id: number; instructor_name: string; pending: number; settled: number; paid: number; total: number; count: number }[] }
interface Settl { id: number; instructor_id: number; instructor_name: string; period: string; total: number; status: string; entries: number; paid_at: string | null; paid_method: string | null }

const EMPLOYMENT: [string, string][] = [["MONOTRIBUTO", "Monotributo"], ["RELACION_DEPENDENCIA", "Relación de dependencia"], ["HONORARIOS", "Honorarios"], ["OTRO", "Otro"]];
const RULE_KINDS: [string, string, boolean][] = [
  ["POR_CLASE", "Monto fijo por clase dictada", false], ["POR_ASISTENTE", "Monto por cada asistente", false], ["POR_ALTA", "Monto fijo por cada alta que vende", false],
  ["PORC_PRIMER_PAGO", "% del primer pago del alta", true], ["PORC_VENTA_PRODUCTO", "% de lo que vende en productos", true], ["PORC_PLAN_PERSONALIZADO", "% de las cuotas de planes personalizados", true],
];
const S_TEXT: Record<string, [string, string]> = { BORRADOR: ["Borrador", "gray"], CONFIRMADA: ["Confirmada", "orange"], PAGADA: ["Pagada", "green"] };

type TabKey = "equipo" | "comisiones" | "reglas" | "liquidaciones";

function Index() {
  const { t } = useVocab();
  const user = getSessionUser();
  const role = user?.role || "";
  const isAdmin = role === "ADMINISTRADOR";
  const isInstructor = role === "INSTRUCTOR";
  const [tab, setTab] = useTab<TabKey>(["equipo", "comisiones", "reglas", "liquidaciones"], "equipo");
  const { show, fail, node: flash } = useFlash();
  const opts: [TabKey, string][] = [["equipo", isInstructor ? "Mi perfil" : `${t("instructor", true)}s`], ["comisiones", "Comisiones"]];
  if (!isInstructor) opts.push(["reglas", "Reglas"]);
  opts.push(["liquidaciones", "Liquidaciones"]);
  return (
    <section className="products-page">
      <PageHeader eyebrow="EQUIPO" title={`${t("instructor", true)}s y comisiones`}
        subtitle="Perfiles, horarios, reglas de comisión y la liquidación mensual. La liquidación es un control interno: no es recibo de sueldo ni factura." />
      <Tabs value={tab} onChange={setTab} options={opts} />
      {tab === "equipo" ? <Team role={role} fail={fail} show={show} word={t("instructor")} /> :
        tab === "comisiones" ? <Commissions role={role} fail={fail} /> :
        tab === "reglas" ? <Rules isAdmin={isAdmin} fail={fail} show={show} /> :
        <Settlements role={role} fail={fail} show={show} />}
      {flash}
    </section>
  );
}

// ---------------------------------------------------------------- equipo
function Team({ role, fail, show, word }: { role: string; fail: (e: unknown) => void; show: (s: string) => void; word: string }) {
  const [list, setList] = useState<Instr[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [edit, setEdit] = useState<Instr | "new" | null>(null);
  const [inactive, setInactive] = useState(false);
  const managers = role !== "INSTRUCTOR";
  const load = useCallback(() => { appApi<Instr[]>("/instructors").then(setList).catch(fail); }, [fail]);
  useEffect(load, [load]);
  if (!list) return <Loading />;
  const shown = list.filter((i) => inactive || i.active);
  return (
    <>
      {managers && <div className="c2-toolbar">
        <button className="primary-button" onClick={() => setEdit("new")}>Agregar {word}</button>
        <label className="c2-check"><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Mostrar inactivos</label>
      </div>}
      {shown.length === 0 ? <Empty title={`Todavía no cargaste ${word}s`}>Cargalos para asignarles clases y calcular sus comisiones.</Empty> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Nombre</th><th>Contacto</th><th>Matrícula</th><th>Situación</th></tr></thead>
          <tbody>{shown.map((i) => (
            <tr key={i.id} className="is-click" onClick={() => setOpen(i.id)}>
              <td><strong>{i.name}</strong>{!i.active && <small>Inactivo</small>}</td><td>{i.phone || i.email || "-"}</td><td>{i.license_number || "-"}</td>
              <td>{EMPLOYMENT.find((e) => e[0] === i.employment)?.[1]}</td></tr>))}</tbody></table></div>)}
      {open && <Profile id={open} managers={managers} onClose={() => setOpen(null)} onEdit={(i) => { setOpen(null); setEdit(i); }} fail={fail} />}
      {edit && <EditInstr item={edit === "new" ? null : edit} onClose={() => setEdit(null)} fail={fail} onSaved={() => { setEdit(null); load(); show("Guardado"); }} />}
    </>
  );
}

function Profile({ id, managers, onClose, onEdit, fail }: { id: number; managers: boolean; onClose: () => void; onEdit: (i: Instr) => void; fail: (e: unknown) => void }) {
  const [d, setD] = useState<Instr | null>(null);
  useEffect(() => { appApi<Instr>(`/instructors/${id}`).then(setD).catch(fail); }, [id, fail]);
  if (!d) return <Modal title="Cargando..." onClose={onClose}><Loading /></Modal>;
  return (
    <Modal eyebrow="PERFIL" title={d.name} size="wide" onClose={onClose}
      footer={<>{managers && <button className="secondary-button" onClick={() => onEdit(d)}>Editar</button>}<button className="primary-button" onClick={onClose}>Cerrar</button></>}>
      <div className="cb-detail-grid">
        {d.photo_data && <div><img src={d.photo_data} alt={`Foto de ${d.name}`} style={{ width: 84, height: 84, borderRadius: 16, objectFit: "cover" }} /></div>}
        <div><small>DNI</small><strong>{d.dni || "-"}</strong></div><div><small>Teléfono</small><strong>{d.phone || "-"}</strong></div>
        <div><small>Email</small><strong>{d.email || "-"}</strong></div><div><small>Matrícula</small><strong>{d.license_number || "-"}</strong></div>
        <div><small>Clases dictadas este mes</small><strong>{d.month?.classes_taught ?? 0}</strong></div>
      </div>
      {d.bio && <p>{d.bio}</p>}
      <h3 className="cb-form-title">Horarios fijos</h3>
      {!d.schedule || d.schedule.length === 0 ? <Empty title="No tiene clases fijas en la grilla" /> : (
        <ul className="c2-roster">{d.schedule.map((s) => <li key={s.id}><div><strong>{WEEKDAYS[s.weekday]} {s.start_time}</strong><small>{s.activity_name} · {s.duration_min} min</small></div></li>)}</ul>)}
    </Modal>
  );
}

function EditInstr({ item, onClose, onSaved, fail }: { item: Instr | null; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const { form, set } = useForm({
    first_name: item?.first_name || "", last_name: item?.last_name || "", dni: item?.dni || "", phone: item?.phone || "", email: item?.email || "",
    license_number: item?.license_number || "", employment: item?.employment || "MONOTRIBUTO", bio: item?.bio || "", active: item ? item.active : true,
  });
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 150_000) { fail(new Error("La foto pesa mucho: usá una de menos de 150 KB")); return; }
    const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(f);
  }
  async function save() {
    if (!form.first_name.trim() || !form.last_name.trim()) { fail(new Error("Completá nombre y apellido")); return; }
    setSaving(true);
    const clean = (v: string) => v.trim() || null;
    const body: any = { ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), dni: clean(form.dni), phone: clean(form.phone), email: clean(form.email), license_number: clean(form.license_number), bio: clean(form.bio) };
    if (photo !== undefined) body.photo_data = photo || "";
    try { await appApi(item ? `/instructors/${item.id}` : "/instructors", { method: item ? "PUT" : "POST", body }); onSaved(); } catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="PERFIL" title={item ? `Editar a ${item.name}` : "Nuevo"} size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Nombre"><input value={form.first_name} maxLength={80} onChange={(e) => set("first_name", e.target.value)} /></Field>
        <Field label="Apellido"><input value={form.last_name} maxLength={80} onChange={(e) => set("last_name", e.target.value)} /></Field>
        <Field label="DNI"><input inputMode="numeric" value={form.dni} onChange={(e) => set("dni", e.target.value)} /></Field>
        <Field label="Teléfono"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Matrícula profesional"><input value={form.license_number} maxLength={40} onChange={(e) => set("license_number", e.target.value)} /></Field>
        <Field label="Situación"><select value={form.employment} onChange={(e) => set("employment", e.target.value)}>{EMPLOYMENT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Foto (opcional)"><input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} /></Field>
        <Field label="Presentación" wide hint="Se puede mostrar en la web del club."><textarea rows={3} value={form.bio} maxLength={2000} onChange={(e) => set("bio", e.target.value)} /></Field>
        <label className="c2-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activo</label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- comisiones
function PeriodBar({ period, setPeriod }: { period: string; setPeriod: (p: string) => void }) {
  return (
    <div className="c2-toolbar">
      <button className="secondary-button c2-small-btn" onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label="Mes anterior">‹</button>
      <strong>{periodLabel(period)}</strong>
      <button className="secondary-button c2-small-btn" onClick={() => setPeriod(shiftPeriod(period, 1))} aria-label="Mes siguiente">›</button>
    </div>
  );
}

function Commissions({ role, fail }: { role: string; fail: (e: unknown) => void }) {
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState<Comm | null>(null);
  const [who, setWho] = useState<number | null>(null);
  useEffect(() => { setData(null); appApi<Comm>(`/commissions?period=${period}`).then(setData).catch(fail); }, [period, fail]);
  const rows = data ? data.items.filter((e) => !who || e.instructor_id === who) : [];
  const total = data ? data.totals.reduce((a, t) => a + t.total, 0) : 0;
  return (
    <>
      <PeriodBar period={period} setPeriod={setPeriod} />
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title="No hay comisiones en este mes">Se calculan solas con las clases dictadas, las altas y las ventas, según las reglas que definas.</Empty> : (
        <>
          <div className="c2-grid-kpi">
            <Stat label="Total del mes" value={money(total)} />
            {data.totals.map((t) => (
              <button key={t.instructor_id} className="cb-kpi c2-stat" style={{ textAlign: "left", cursor: role === "INSTRUCTOR" ? "default" : "pointer", outline: who === t.instructor_id ? "2px solid var(--cb-brand-c)" : undefined }}
                onClick={() => role !== "INSTRUCTOR" && setWho(who === t.instructor_id ? null : t.instructor_id)}>
                <span>{t.instructor_name}</span><strong>{money(t.total)}</strong><small>{money(t.pending)} sin liquidar</small></button>))}
          </div>
          <div className="cb-table-wrap"><table className="cb-table">
            <thead><tr><th>Detalle</th><th>Regla</th><th className="num">Base</th><th className="num">Comisión</th><th>Estado</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id}><td><strong>{e.description}</strong>{role !== "INSTRUCTOR" && <small>{e.instructor_name}</small>}</td><td>{e.kind_label}</td>
                <td className="num">{money(e.base_amount)}</td><td className="num"><strong>{money(e.commission_amount)}</strong></td>
                <td><Pill tone={e.status === "PAGADA" ? "green" : e.status === "PENDIENTE" ? "gray" : "orange"}>{e.status === "PENDIENTE" ? "Sin liquidar" : e.status === "PAGADA" ? "Pagada" : "Liquidada"}</Pill></td></tr>))}</tbody></table></div>
        </>)}
    </>
  );
}

// ---------------------------------------------------------------- reglas
function Rules({ isAdmin, fail, show }: { isAdmin: boolean; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [edit, setEdit] = useState<Rule | "new" | null>(null);
  const load = useCallback(() => { appApi<Rule[]>("/commission-rules?all=true").then(setRules).catch(fail); }, [fail]);
  useEffect(load, [load]);
  if (!rules) return <Loading />;
  return (
    <>
      {isAdmin ? <div className="c2-toolbar"><button className="primary-button" onClick={() => setEdit("new")}>Agregar regla</button></div> :
        <div className="cb-note cb-note-info" style={{ marginBottom: 12 }}>Las reglas las define la administración. Acá podés verlas.</div>}
      <div className="cb-note cb-note-info" style={{ marginBottom: 12 }}>Si hay varias reglas, gana la más específica: instructor y actividad, después solo instructor, después la general (para todos).</div>
      {rules.length === 0 ? <Empty title="Todavía no hay reglas de comisión">Sin reglas, el sistema no calcula comisiones.</Empty> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Para</th><th>Regla</th><th className="num">Valor</th><th>Vigencia</th><th></th></tr></thead>
          <tbody>{rules.map((r) => (
            <tr key={r.id} className={isAdmin ? "is-click" : ""} onClick={() => isAdmin && setEdit(r)}>
              <td><strong>{r.instructor_name}</strong>{r.activity_name && <small>{r.activity_name}</small>}</td>
              <td>{r.kind_label}{r.min_attendees ? <small>Desde {r.min_attendees} asistentes</small> : null}</td>
              <td className="num"><strong>{r.is_pct ? `${r.amount_or_pct}%` : money(r.amount_or_pct)}</strong></td>
              <td>{r.valid_from || r.valid_to ? `${r.valid_from ? shortDate(r.valid_from) : "siempre"} a ${r.valid_to ? shortDate(r.valid_to) : "sin fin"}` : "Siempre"}</td>
              <td>{!r.active && <Pill>Pausada</Pill>}</td></tr>))}</tbody></table></div>)}
      {edit && <RuleModal item={edit === "new" ? null : edit} onClose={() => setEdit(null)} fail={fail} onSaved={() => { setEdit(null); load(); show("Regla guardada"); }} />}
    </>
  );
}

function RuleModal({ item, onClose, onSaved, fail }: { item: Rule | null; onClose: () => void; onSaved: () => void; fail: (e: unknown) => void }) {
  const [instrs, setInstrs] = useState<Instr[]>([]);
  const [acts, setActs] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { appApi<Instr[]>("/instructors?active=true").then(setInstrs).catch(fail); appApi("/activities").then(setActs).catch(() => setActs([])); }, [fail]);
  const { form, set } = useForm({
    instructor_id: String(item?.instructor_id || ""), kind: item?.kind || "POR_CLASE", activity_id: String(item?.activity_id || ""),
    amount_or_pct: String(item?.amount_or_pct ?? ""), min_attendees: String(item?.min_attendees || ""), valid_from: item?.valid_from || "", valid_to: item?.valid_to || "", active: item ? item.active : true,
  });
  const [saving, setSaving] = useState(false);
  const pct = RULE_KINDS.find((k) => k[0] === form.kind)?.[2];
  async function save() {
    if (form.amount_or_pct === "" || num(form.amount_or_pct) < 0) { fail(new Error("Escribí el monto o el porcentaje")); return; }
    setSaving(true);
    const body = { instructor_id: form.instructor_id ? Number(form.instructor_id) : null, kind: form.kind, activity_id: form.kind.startsWith("POR_C") || form.kind === "POR_ASISTENTE" ? (form.activity_id ? Number(form.activity_id) : null) : null,
      amount_or_pct: num(form.amount_or_pct), min_attendees: form.kind === "POR_ASISTENTE" && form.min_attendees ? Number(form.min_attendees) : null,
      valid_from: form.valid_from || null, valid_to: form.valid_to || null, active: form.active };
    try { await appApi(item ? `/commission-rules/${item.id}` : "/commission-rules", { method: item ? "PUT" : "POST", body }); onSaved(); } catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="REGLA DE COMISIÓN" title={item ? "Editar regla" : "Nueva regla"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>Guardar</button></>}>
      <div className="product-form c2-form-grid">
        <Field label="Para quién"><select value={form.instructor_id} onChange={(e) => set("instructor_id", e.target.value)}><option value="">Todos (regla general)</option>{instrs.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
        <Field label="Qué se paga"><select value={form.kind} onChange={(e) => set("kind", e.target.value)}>{RULE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label={pct ? "Porcentaje (%)" : "Monto ($)"}><input inputMode="decimal" value={form.amount_or_pct} onChange={(e) => set("amount_or_pct", e.target.value)} /></Field>
        {(form.kind === "POR_CLASE" || form.kind === "POR_ASISTENTE") && <Field label="Solo para la actividad"><select value={form.activity_id} onChange={(e) => set("activity_id", e.target.value)}><option value="">Todas</option>{acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
        {form.kind === "POR_ASISTENTE" && <Field label="Mínimo de asistentes" hint="Opcional: solo cuenta desde esa cantidad."><input type="number" min={1} value={form.min_attendees} onChange={(e) => set("min_attendees", e.target.value)} /></Field>}
        <Field label="Vigente desde"><input type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} /></Field>
        <Field label="Vigente hasta"><input type="date" value={form.valid_to} onChange={(e) => set("valid_to", e.target.value)} /></Field>
        <label className="c2-check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activa</label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- liquidaciones
function Settlements({ role, fail, show }: { role: string; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [period, setPeriod] = useState(shiftPeriod(currentPeriod(), -1));
  const [list, setList] = useState<Settl[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState<SettlementPrint | null>(null);
  const [paying, setPaying] = useState<Settl | null>(null);
  const isAdmin = role === "ADMINISTRADOR";
  const canDraft = role !== "INSTRUCTOR";
  const load = useCallback(() => { appApi<Settl[]>(`/settlements?period=${period}`).then(setList).catch(fail); }, [period, fail]);
  useEffect(() => { setList(null); load(); }, [load]);
  async function act(path: string, ok: string, method = "POST", body?: unknown) {
    setBusy(true);
    try { await appApi(path, { method, body }); show(ok); load(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function print(s: Settl) { try { setPrinting(await appApi<SettlementPrint>(`/settlements/${s.id}/print`)); } catch (e) { fail(e); } }
  return (
    <>
      <PeriodBar period={period} setPeriod={setPeriod} />
      {canDraft && <div className="c2-toolbar"><button className="primary-button" disabled={busy} onClick={() => act(`/settlements/draft?period=${period}`, "Borradores armados")}>Armar borradores del mes</button>
        <span className="cb-muted">Junta las comisiones sin liquidar de cada persona. Las ya confirmadas no se tocan.</span></div>}
      {!list ? <Loading /> : list.length === 0 ? <Empty title="No hay liquidaciones en este mes">{canDraft ? "Armá los borradores para revisarlos antes de confirmar." : "Cuando la administración confirme tu liquidación, la ves acá."}</Empty> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Persona</th><th className="num">Total</th><th>Conceptos</th><th>Estado</th><th></th></tr></thead>
          <tbody>{list.map((s) => (
            <tr key={s.id}>
              <td><strong>{s.instructor_name}</strong></td><td className="num"><strong>{money(s.total)}</strong></td><td>{s.entries}</td>
              <td><Pill tone={S_TEXT[s.status]?.[1]}>{S_TEXT[s.status]?.[0] || s.status}</Pill>{s.paid_at && <small>{s.paid_method ? PAYMENT_LABELS[s.paid_method] || s.paid_method : ""}</small>}</td>
              <td style={{ textAlign: "right" }}><div className="c2-actions" style={{ justifyContent: "flex-end" }}>
                <button className="secondary-button c2-small-btn" onClick={() => print(s)}>Ver / imprimir</button>
                {isAdmin && s.status === "BORRADOR" && <button className="primary-button c2-small-btn" disabled={busy} onClick={() => act(`/settlements/${s.id}/confirm`, "Liquidación confirmada")}>Confirmar</button>}
                {isAdmin && s.status === "BORRADOR" && <button className="secondary-button c2-small-btn" disabled={busy} onClick={() => act(`/settlements/${s.id}/discard`, "Borrador descartado")}>Descartar</button>}
                {isAdmin && s.status === "CONFIRMADA" && <button className="primary-button c2-small-btn" onClick={() => setPaying(s)}>Marcar pagada</button>}
              </div></td></tr>))}</tbody></table></div>)}
      {!isAdmin && canDraft && <p className="cb-muted">Confirmar y pagar lo hace la administración.</p>}
      {paying && <PayModal s={paying} onClose={() => setPaying(null)} onPay={(method, notes) => { setPaying(null); act(`/settlements/${paying.id}/pay`, "Pago registrado", "POST", { method, notes }); }} />}
      {printing && <PrintOverlay title="Liquidación" onClose={() => setPrinting(null)}><SettlementSheet data={printing} /></PrintOverlay>}
    </>
  );
}

function PayModal({ s, onClose, onPay }: { s: Settl; onClose: () => void; onPay: (method: string, notes: string | null) => void }) {
  const [method, setMethod] = useState("EFECTIVO");
  const [notes, setNotes] = useState("");
  return (
    <Modal eyebrow="PAGO" title={`${s.instructor_name} · ${money(s.total)}`} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={() => onPay(method, notes.trim() || null)}>Registrar pago</button></>}>
      <div className="product-form">
        <Field label="Forma de pago"><select value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m] || m}</option>)}</select></Field>
        <Field label="Nota (opcional)"><input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="cb-note cb-note-info">Esto solo deja constancia en el sistema: el pago real lo hacés vos por fuera.</div>
      </div>
    </Modal>
  );
}

export default Index;
