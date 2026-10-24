import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime, downloadFile, getSessionUser, money, publicSiteUrl, useVocab } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, useFlash } from "../../../components/ui";
import { METHODS, MemberPicker, isManager, useSub, useSubId } from "../../../components/c3/common";
import type { MemberHit } from "../../../components/c3/common";
import { moduleHint, moduleLabel } from "../../../config";
import { useNavigate } from "react-router-dom";

const BASE = "/app/eventos";
const KINDS: [string, string][] = [["TORNEO", "Torneo"], ["EXAMEN", "Examen"], ["FESTIVAL", "Festival"], ["SALIDA", "Salida"], ["OTRO", "Otro"]];
const KIND_LABEL = Object.fromEntries(KINDS);

interface Ev {
  id: number; name: string; kind: string; activity_id: number | null; activity_name: string | null; starts_at: string | null; ends_at: string | null; place: string | null;
  capacity: number | null; taken: number; spots_left: number | null; registration_until: string | null; public: boolean; notes: string | null; past: boolean; registration_open: boolean;
  price?: number; paid?: number; unpaid?: number; collected?: number; pending?: number;
}
interface Entry {
  id: number; member_id: number; member_name: string; dni: string; phone: string | null; status: string; result_note: string | null; rank_id_awarded: number | null; rank_name: string | null;
  charge_id?: number | null; amount?: number; paid?: number; outstanding?: number; pay_status?: string;
}

/** Eventos: torneos, exámenes, festivales y salidas con inscripción, cobro y resultados. */
function Index() {
  const [sub] = useSub(BASE, "lista");
  return (
    <section className="products-page">
      {sub === "detalle" ? <Detail /> : <List />}
    </section>
  );
}

function toLocalInput(v: string | null): string { return v ? v.slice(0, 16) : ""; }
function when(e: Ev): string { return e.starts_at ? dateTime(e.starts_at) : "Fecha a definir"; }

function List() {
  const { show, fail, node } = useFlash();
  const nav = useNavigate();
  const manager = isManager();
  const [when_, setWhen] = useState<"upcoming" | "past">("upcoming");
  const [items, setItems] = useState<Ev[] | null>(null);
  const [edit, setEdit] = useState<Partial<Ev> | null>(null);
  const load = useCallback(() => { appApi<{ items: Ev[] }>(`/events?when=${when_}`).then((r) => setItems(r.items)).catch(fail); }, [when_, fail]);
  useEffect(() => { setItems(null); load(); }, [load]);
  return (
    <>
      <PageHeader eyebrow="MÓDULO" title={moduleLabel("eventos")} subtitle={moduleHint("eventos")}>
        <Seg value={when_} onChange={setWhen} options={[["upcoming", "Próximos"], ["past", "Pasados"]]} />
        {manager && <button className="primary-button" onClick={() => setEdit({ kind: "TORNEO", price: 0, public: false })}>Nuevo evento</button>}
      </PageHeader>
      {!items ? <Loading /> : items.length === 0 ? <Empty title={when_ === "upcoming" ? "No hay eventos próximos" : "Todavía no hay eventos pasados"}>{manager && when_ === "upcoming" && <p className="cb-muted">Creá un torneo, un examen o una salida para empezar a anotar gente.</p>}</Empty> : (
        <div className="c3-grid-cards">
          {items.map((e) => (
            <button key={e.id} className="c3-report-card" onClick={() => nav(`${BASE}/detalle/${e.id}`)}>
              <span className="cb-row"><Pill tone="teal">{KIND_LABEL[e.kind] || e.kind}</Pill>{e.public && <Pill tone="blue">En la web</Pill>}{!e.past && !e.registration_open && <Pill tone="gray">Inscripción cerrada</Pill>}</span>
              <strong>{e.name}</strong>
              <span>{when(e)}{e.place ? ` · ${e.place}` : ""}</span>
              <span>{e.taken} {e.taken === 1 ? "inscripto" : "inscriptos"}{e.capacity ? ` de ${e.capacity}` : ""}{e.price ? ` · ${money(e.price)}` : e.price === 0 ? " · Gratis" : ""}</span>
            </button>))}
        </div>)}
      {edit && <EventModal init={edit} onClose={() => setEdit(null)} onFail={fail} onDone={(id) => { setEdit(null); show("Evento guardado"); if (id) nav(`${BASE}/detalle/${id}`); else load(); }} />}
      {node}
    </>
  );
}

function EventModal({ init, onClose, onDone, onFail }: { init: Partial<Ev>; onClose: () => void; onDone: (id?: number) => void; onFail: (e: unknown) => void }) {
  const [acts, setActs] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { appApi("/activities").then((r) => setActs(r.items || r)).catch(() => undefined); }, []);
  const [f, setF] = useState({ name: init.name || "", kind: init.kind || "TORNEO", activity_id: String(init.activity_id || ""), starts_at: toLocalInput(init.starts_at ?? null), ends_at: toLocalInput(init.ends_at ?? null),
    place: init.place || "", price: String(init.price ?? 0), capacity: String(init.capacity || ""), registration_until: toLocalInput(init.registration_until ?? null), public: !!init.public, notes: init.notes || "" });
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    const body: any = { name: f.name.trim(), kind: f.kind, price: Number(f.price.replace(",", ".")) || 0, public: f.public, notes: f.notes.trim() || null };
    const clear: string[] = [];
    const opt = (k: string, v: any) => { if (v === "" || v === null) { if (init.id) clear.push(k); } else body[k] = v; };
    opt("activity_id", f.activity_id ? Number(f.activity_id) : null);
    opt("starts_at", f.starts_at); opt("ends_at", f.ends_at); opt("place", f.place.trim()); opt("registration_until", f.registration_until);
    opt("capacity", f.capacity ? Math.round(Number(f.capacity)) : null);
    if (init.id) body.clear = clear;
    try { const r = await appApi(init.id ? `/events/${init.id}` : "/events", { method: init.id ? "PUT" : "POST", body }); onDone(init.id ? undefined : r.id); } catch (e) { onFail(e); }
  }
  return (
    <Modal eyebrow="EVENTOS" title={init.id ? "Editar evento" : "Nuevo evento"} size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={f.name.trim().length < 2} onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <div className="form-row"><Field label="Nombre"><input value={f.name} maxLength={150} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Tipo"><select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field></div>
        <div className="form-row"><Field label="Empieza"><input type="datetime-local" value={f.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
          <Field label="Termina"><input type="datetime-local" value={f.ends_at} min={f.starts_at} onChange={(e) => set("ends_at", e.target.value)} /></Field></div>
        <div className="form-row"><Field label="Lugar"><input value={f.place} maxLength={160} onChange={(e) => set("place", e.target.value)} /></Field>
          <Field label="Actividad (opcional)"><select value={f.activity_id} onChange={(e) => set("activity_id", e.target.value)}><option value="">Ninguna</option>{acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
        <div className="form-row"><Field label="Precio de inscripción ($)" hint="0 si es gratis"><input inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Cupo" hint="Vacío = sin límite"><input inputMode="numeric" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field></div>
        <Field label="Inscripción abierta hasta"><input type="datetime-local" value={f.registration_until} onChange={(e) => set("registration_until", e.target.value)} /></Field>
        <Field label="Notas"><textarea rows={3} maxLength={3000} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <div className="cb-inline-checks"><label><input type="checkbox" checked={f.public} onChange={(e) => set("public", e.target.checked)} /> Mostrarlo en la web del club para que se anoten solos</label></div>
      </div>
    </Modal>
  );
}

function Detail() {
  const { t } = useVocab();
  const id = useSubId(BASE);
  const nav = useNavigate();
  const { show, fail, node } = useFlash();
  const manager = isManager();
  const user = getSessionUser();
  const instructor = user?.role === "INSTRUCTOR";
  const [d, setD] = useState<{ event: Ev; entries: Entry[]; ranks: { id: number; name: string }[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<Entry | null>(null);
  const [result, setResult] = useState<Entry | null>(null);
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => { appApi(`/events/${id}`).then(setD).catch(fail); }, [id, fail]);
  useEffect(load, [load]);
  if (!d) return <Loading />;
  const e = d.event;
  const active = d.entries.filter((x) => x.status !== "CANCELADO");

  async function cancel(en: Entry) {
    const reason = window.prompt("¿Por qué se cancela la inscripción? (opcional)");
    if (reason === null) return;
    try { const r = await appApi(`/event-entries/${en.id}/cancel`, { method: "POST", body: { reason: reason || null } }); show(r.refund_needed ? "Cancelada. Ya había pagado: definí la devolución desde Caja" : "Inscripción cancelada"); load(); } catch (x) { fail(x); }
  }
  async function remove() {
    if (!window.confirm("¿Borrar este evento?")) return;
    try { await appApi(`/events/${e.id}`, { method: "DELETE" }); nav(BASE); } catch (x) { fail(x); }
  }
  const payTone: Record<string, string> = { PAGADO: "green", PARCIAL: "orange", DEBE: "red", SIN_COSTO: "gray", ANULADO: "gray" };
  const payLabel: Record<string, string> = { PAGADO: "Pagado", PARCIAL: "Pagó una parte", DEBE: "Debe", SIN_COSTO: "Sin costo", ANULADO: "Anulado" };
  return (
    <>
      <PageHeader eyebrow={KIND_LABEL[e.kind]?.toUpperCase() || "EVENTO"} title={e.name} subtitle={<button className="cb-link" onClick={() => nav(BASE)}>← Todos los eventos</button>}>
        {manager && <><button className="secondary-button" onClick={() => setEditing(true)}>Editar</button><button className="cb-danger-button" onClick={remove}>Borrar</button></>}
        {!instructor && <button className="secondary-button" onClick={() => downloadFile(`/events/${e.id}/export.csv`, `inscriptos-${e.id}.csv`).catch(fail)}>Descargar para Excel</button>}
        {!instructor && e.registration_open && <button className="primary-button" onClick={() => setAdding(true)}>Inscribir a alguien</button>}
      </PageHeader>
      <div className="cb-kpis">
        <div className="cb-kpi"><span className="cb-muted">Cuándo</span><strong>{when(e)}</strong><small className="cb-muted">{e.place || "Lugar a definir"}</small></div>
        <div className="cb-kpi"><span className="cb-muted">Inscriptos</span><strong className="c3-bignum">{e.taken}{e.capacity ? ` / ${e.capacity}` : ""}</strong><small className="cb-muted">{e.registration_open ? (e.registration_until ? `Abierta hasta ${dateTime(e.registration_until)}` : "Inscripción abierta") : "Inscripción cerrada"}</small></div>
        {e.collected !== undefined && <div className="cb-kpi"><span className="cb-muted">Cobrado</span><strong className="c3-bignum">{money(e.collected)}</strong><small className="cb-muted">Falta cobrar {money(e.pending)} · {e.unpaid} {e.unpaid === 1 ? "persona" : "personas"}</small></div>}
      </div>
      {e.public && <div className="cb-note cb-note-info" style={{ marginBottom: 12 }}>Visible en la web del club{getSessionUser()?.company_slug ? `: ${publicSiteUrl(getSessionUser()?.company_slug)}` : ""}</div>}
      {d.entries.length === 0 ? <Empty title="Todavía no hay inscriptos" /> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Persona</th><th>DNI</th><th>Estado</th>{!instructor && <th>Pago</th>}<th>Resultado</th><th /></tr></thead>
          <tbody>{d.entries.map((en) => (
            <tr key={en.id} >
              <td><strong>{en.member_name}</strong>{en.phone && <small>{en.phone}</small>}</td><td>{en.dni}</td>
              <td><Pill tone={en.status === "CONFIRMADO" ? "green" : en.status === "CANCELADO" ? "gray" : "blue"}>{en.status === "CONFIRMADO" ? "Confirmado" : en.status === "CANCELADO" ? "Cancelado" : "Inscripto"}</Pill></td>
              {!instructor && <td>{en.status === "CANCELADO" ? "—" : <><Pill tone={payTone[en.pay_status || ""] || "gray"}>{payLabel[en.pay_status || ""] || "—"}</Pill>{(en.outstanding || 0) > 0 && <small>Falta {money(en.outstanding)}</small>}</>}</td>}
              <td>{en.result_note || "—"}{en.rank_name && <small>Grado: {en.rank_name}</small>}</td>
              <td className="num"><div className="cb-row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                {!instructor && en.status !== "CANCELADO" && (en.outstanding || 0) > 0 && <button className="cb-link" onClick={() => setPaying(en)}>Cobrar</button>}
                {en.status !== "CANCELADO" && <button className="cb-link" onClick={() => setResult(en)}>Resultado</button>}
                {!instructor && en.status !== "CANCELADO" && <button className="cb-link cb-link-danger" onClick={() => cancel(en)}>Cancelar</button>}</div></td>
            </tr>))}</tbody></table></div>)}
      <p className="cb-muted">{active.length} {t("members")} activos en la lista. Los cobros de eventos se hacen desde acá y quedan en tu caja si son en efectivo.</p>
      {adding && <AddModal event={e} onClose={() => setAdding(false)} onFail={fail} onDone={() => { setAdding(false); load(); show("Inscripción registrada"); }} />}
      {paying && <PayModal en={paying} onClose={() => setPaying(null)} onFail={fail} onDone={(n) => { setPaying(null); load(); show(`Cobro registrado · recibo #${n}`); }} />}
      {result && <ResultModal en={result} ranks={d.ranks} isExam={e.kind === "EXAMEN"} onClose={() => setResult(null)} onFail={fail} onDone={() => { setResult(null); load(); show("Resultado guardado"); }} />}
      {editing && <EventModal init={e} onClose={() => setEditing(false)} onFail={fail} onDone={() => { setEditing(false); load(); show("Evento guardado"); }} />}
      {node}
    </>
  );
}

function AddModal({ event, onClose, onDone, onFail }: { event: Ev; onClose: () => void; onDone: () => void; onFail: (e: unknown) => void }) {
  const [m, setM] = useState<MemberHit | null>(null);
  async function save() { try { await appApi(`/events/${event.id}/entries`, { method: "POST", body: { member_id: m!.id } }); onDone(); } catch (e) { onFail(e); } }
  return (
    <Modal eyebrow="INSCRIPCIÓN" title={event.name} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!m} onClick={save}>Inscribir</button></>}>
      <div className="product-form"><MemberPicker value={m} onPick={setM} />{event.price ? <p className="cb-muted" style={{ margin: 0 }}>Se genera un cargo de {money(event.price)} que cobrás desde la lista.</p> : null}</div>
    </Modal>
  );
}

function PayModal({ en, onClose, onDone, onFail }: { en: Entry; onClose: () => void; onDone: (n: number) => void; onFail: (e: unknown) => void }) {
  const [method, setMethod] = useState("EFECTIVO");
  const [amount, setAmount] = useState(String(en.outstanding || ""));
  async function save() { try { const r = await appApi(`/event-entries/${en.id}/pay`, { method: "POST", body: { method, amount: Number(amount.replace(",", ".")) || null } }); onDone(r.receipt_number); } catch (e) { onFail(e); } }
  return (
    <Modal eyebrow="COBRAR INSCRIPCIÓN" title={en.member_name} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Cobrar</button></>}>
      <div className="product-form">
        <p className="cb-muted" style={{ margin: 0 }}>Falta cobrar {money(en.outstanding)}.</p>
        <Field label="Importe ($)"><input inputMode="decimal" className="c3-bigin" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Medio de pago"><select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

function ResultModal({ en, ranks, isExam, onClose, onDone, onFail }: { en: Entry; ranks: { id: number; name: string }[]; isExam: boolean; onClose: () => void; onDone: () => void; onFail: (e: unknown) => void }) {
  const [note, setNote] = useState(en.result_note || "");
  const [rank, setRank] = useState(String(en.rank_id_awarded || ""));
  async function save() { try { await appApi(`/event-entries/${en.id}/result`, { method: "POST", body: { result_note: note.trim() || null, rank_id_awarded: rank ? Number(rank) : null } }); onDone(); } catch (e) { onFail(e); } }
  return (
    <Modal eyebrow="RESULTADO" title={en.member_name} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <Field label="Resultado o nota"><input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: 2.º puesto, aprobado..." /></Field>
        {isExam && ranks.length > 0 && <Field label="Grado otorgado"><select value={rank} onChange={(e) => setRank(e.target.value)}><option value="">Ninguno</option>{ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>}
      </div>
    </Modal>
  );
}

export default Index;
