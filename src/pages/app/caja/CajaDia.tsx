import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime, money } from "../../../config";
import { Empty, Field, Loading, Modal, Pill, useFlash } from "../../../components/ui";
import { METHODS, METHOD_LABEL, isManager } from "../../../components/c3/common";
import { CATEGORY_LABEL } from "./types";
import type { CashSess, Movement } from "./types";

interface Current { session: CashSess | null; movements: Movement[]; others: CashSess[] }

/** Caja del día: apertura, cobros por medio, ingresos y gastos y cierre con arqueo (lo contado contra lo esperado). */
function CajaDia() {
  const { show, fail, node: flash } = useFlash();
  const [cur, setCur] = useState<Current | null>(null);
  const [history, setHistory] = useState<CashSess[]>([]);
  const [opening, setOpening] = useState("0");
  const [closing, setClosing] = useState<CashSess | null>(null);
  const [moving, setMoving] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const manager = isManager();

  const load = useCallback(() => {
    appApi<Current>("/cash/current").then(setCur).catch(fail);
    appApi<CashSess[]>("/cash/sessions").then(setHistory).catch(fail);
  }, [fail]);
  useEffect(load, [load]);

  async function open() {
    try { await appApi("/cash/open", { method: "POST", body: { opening_amount: Number(opening.replace(",", ".")) || 0 } }); show("Caja abierta"); load(); } catch (e) { fail(e); }
  }
  async function openDetail(id: number) { try { setDetail(await appApi(`/cash/sessions/${id}`)); } catch (e) { fail(e); } }

  if (!cur) return <Loading />;
  const s = cur.session;
  const t = s?.totals;
  return (
    <div className="cb-stack">
      {s?.from_previous_day && <div className="cb-note cb-note-warn">Esta caja se abrió el {dateTime(s.opened_at)} y sigue abierta. Cerrala con el arqueo para que los números cierren.</div>}
      {!s ? (
        <div className="cb-card" style={{ maxWidth: 460 }}>
          <h2 style={{ marginTop: 0 }}>No tenés una caja abierta</h2>
          <p className="cb-muted">Abrila con el efectivo que dejás para dar vuelto. Todo lo que cobres queda en tu caja hasta que la cierres.</p>
          <Field label="Efectivo inicial ($)"><input inputMode="decimal" className="c3-bigin" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
          <button className="primary-button" style={{ marginTop: 12 }} onClick={open}>Abrir caja</button>
        </div>
      ) : (
        <>
          <div className="cb-kpis">
            <div className="cb-kpi"><span className="cb-muted">Efectivo esperado</span><strong className="c3-bignum">{money(t?.expected_cash)}</strong><small className="cb-muted">Inicial {money(s.opening_amount)} + cobros en efectivo y movimientos</small></div>
            <div className="cb-kpi"><span className="cb-muted">Cobrado en total</span><strong className="c3-bignum">{money(t?.total_collected)}</strong><small className="cb-muted">{t?.sales_count || 0} ventas de productos</small></div>
            <div className="cb-kpi"><span className="cb-muted">Gastos de caja</span><strong className="c3-bignum">{money(t?.movements_out)}</strong><small className="cb-muted">Ingresos manuales {money(t?.movements_in)}</small></div>
            <div className="cb-kpi"><span className="cb-muted">Anulados</span><strong className="c3-bignum">{money(t?.voided_total)}</strong><small className="cb-muted">{t?.voided_count || 0} cobros</small></div>
          </div>
          <div className="cb-card">
            <div className="cb-card-head"><div><h2 style={{ margin: 0, fontSize: 17 }}>Cobros por medio</h2><span className="cb-muted">Abierta desde {dateTime(s.opened_at)}</span></div>
              <div className="cb-row"><button className="secondary-button" onClick={() => setMoving(true)}>Registrar ingreso o gasto</button><button className="primary-button" onClick={() => setClosing(s)}>Cerrar caja</button></div></div>
            {Object.keys(t?.by_method || {}).length === 0 ? <p className="cb-muted">Todavía no cobraste nada en esta caja.</p> : (
              <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Medio</th><th className="num">Cobros</th><th className="num">Total</th></tr></thead>
                <tbody>{Object.entries(t!.by_method).map(([k, v]) => <tr key={k}><td>{METHOD_LABEL[k] || k}</td><td className="num">{v.count}</td><td className="num">{money(v.total)}</td></tr>)}</tbody></table></div>
            )}
          </div>
          <div className="cb-card">
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Ingresos y gastos de esta caja</h2>
            {cur.movements.length === 0 ? <p className="cb-muted">Sin movimientos manuales.</p> : (
              <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Hora</th><th>Concepto</th><th>Rubro</th><th>Medio</th><th className="num">Importe</th></tr></thead>
                <tbody>{cur.movements.map((m) => <tr key={m.id}><td>{dateTime(m.at)}</td><td>{m.concept}</td><td>{m.category ? CATEGORY_LABEL[m.category] || m.category : "—"}</td><td>{METHOD_LABEL[m.method] || m.method}</td>
                  <td className="num"><Pill tone={m.kind === "EGRESO" ? "red" : "green"}>{m.kind === "EGRESO" ? "−" : "+"}{money(m.amount)}</Pill></td></tr>)}</tbody></table></div>
            )}
          </div>
        </>
      )}

      {manager && cur.others.length > 0 && (
        <div className="cb-card">
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Otras cajas abiertas</h2>
          <ul className="cb-list">{cur.others.map((o) => (
            <li key={o.id} className="cb-spread" style={{ padding: "8px 0" }}>
              <span><strong>{o.user_name}</strong><small className="cb-muted" style={{ display: "block" }}>Desde {dateTime(o.opened_at)} · esperado {money(o.totals?.expected_cash)}</small></span>
              <span className="cb-row">{o.from_previous_day && <Pill tone="orange">De un día anterior</Pill>}<button className="secondary-button" onClick={() => setClosing(o)}>Cerrar</button></span>
            </li>))}</ul>
        </div>
      )}

      <div className="cb-card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Cajas de los últimos 30 días</h2>
        {history.length === 0 ? <Empty title="Todavía no hay cajas" /> : (
          <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Apertura</th><th>Responsable</th><th>Estado</th><th className="num">Esperado</th><th className="num">Contado</th><th className="num">Diferencia</th></tr></thead>
            <tbody>{history.map((h) => (
              <tr key={h.id} className="is-click" onClick={() => openDetail(h.id)}>
                <td>{dateTime(h.opened_at)}</td><td>{h.user_name}</td><td><Pill tone={h.status === "ABIERTA" ? "orange" : "gray"}>{h.status === "ABIERTA" ? "Abierta" : "Cerrada"}</Pill></td>
                <td className="num">{h.expected_cash !== null ? money(h.expected_cash) : "—"}</td><td className="num">{h.closing_counted !== null ? money(h.closing_counted) : "—"}</td>
                <td className="num">{h.difference === null ? "—" : <Pill tone={h.difference === 0 ? "green" : "red"}>{h.difference > 0 ? "+" : ""}{money(h.difference)}</Pill>}</td></tr>))}</tbody></table></div>
        )}
      </div>

      {closing && <CloseModal sess={closing} onClose={() => setClosing(null)} onFail={fail} onDone={(r) => { setClosing(null); load(); show("Caja cerrada"); setDetail(null); window.open(`/print/caja/${r.id}`, "_blank"); }} own={closing.id === cur.session?.id} />}
      {moving && <MovementModal onClose={() => setMoving(false)} onFail={fail} onDone={() => { setMoving(false); load(); show("Movimiento registrado"); }} />}
      {detail && (
        <Modal eyebrow="CAJA" title={`Caja de ${detail.user_name}`} size="wide" onClose={() => setDetail(null)}
          footer={<><button className="secondary-button" onClick={() => window.open(`/print/caja/${detail.id}`, "_blank")}>Imprimir resumen</button><button className="primary-button" onClick={() => setDetail(null)}>Cerrar</button></>}>
          <div className="cb-detail-grid">
            <div><small>Apertura</small><strong>{dateTime(detail.opened_at)}</strong></div><div><small>Cierre</small><strong>{detail.closed_at ? dateTime(detail.closed_at) : "Abierta"}</strong></div>
            <div><small>Esperado</small><strong>{money(detail.expected_cash)}</strong></div><div><small>Contado</small><strong>{detail.closing_counted !== null ? money(detail.closing_counted) : "—"}</strong></div>
          </div>
          {detail.notes && <div className="cb-note cb-note-info"><strong>Nota:</strong> {detail.notes}</div>}
          <h3 className="cb-form-title">Cobros</h3>
          <div className="cb-table-wrap"><table className="cb-table"><tbody>{detail.payments.map((p: any) => <tr key={p.id}><td>#{p.receipt_number}</td><td>{p.concept}<small>{p.member_name || ""}</small></td><td>{METHOD_LABEL[p.method] || p.method}</td><td className="num">{p.status === "ANULADO" ? <Pill tone="gray">Anulado</Pill> : money(p.amount)}</td></tr>)}
            {detail.payments.length === 0 && <tr><td>Sin cobros</td></tr>}</tbody></table></div>
        </Modal>
      )}
      {flash}
    </div>
  );
}

function CloseModal({ sess, own, onClose, onDone, onFail }: { sess: CashSess; own: boolean; onClose: () => void; onDone: (s: CashSess) => void; onFail: (e: unknown) => void }) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const expected = sess.totals?.expected_cash ?? sess.expected_cash ?? 0;
  const c = counted === "" ? null : Number(counted.replace(",", "."));
  const diff = c === null || Number.isNaN(c) ? null : Math.round((c - expected) * 100) / 100;
  async function save() {
    setSaving(true);
    try { onDone(await appApi<CashSess>("/cash/close", { method: "POST", body: { counted: c, notes: notes.trim() || null, session_id: own ? null : sess.id } })); } catch (e) { onFail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="ARQUEO" title={own ? "Cerrar mi caja" : `Cerrar la caja de ${sess.user_name}`} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={diff === null || saving || (diff !== 0 && !notes.trim())} onClick={save}>{saving ? "Cerrando..." : "Cerrar caja"}</button></>}>
      <div className="product-form">
        <div className="cb-sum-row"><span>Efectivo esperado</span><strong>{money(expected)}</strong></div>
        <Field label="Efectivo contado en el cajón ($)"><input inputMode="decimal" autoFocus className="c3-bigin" value={counted} onChange={(e) => setCounted(e.target.value)} /></Field>
        {diff !== null && <div className={`c3-diff ${diff === 0 ? "is-ok" : "is-bad"}`}>{diff === 0 ? "Cierra justo" : diff > 0 ? `Sobran ${money(diff)}` : `Faltan ${money(-diff)}`}</div>}
        <Field label={diff !== null && diff !== 0 ? "Nota (obligatoria si hay diferencia)" : "Nota (opcional)"}><textarea rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <p className="cb-muted" style={{ margin: 0 }}>Después de cerrar, la caja no se puede modificar.</p>
      </div>
    </Modal>
  );
}

function MovementModal({ onClose, onDone, onFail }: { onClose: () => void; onDone: () => void; onFail: (e: unknown) => void }) {
  const [kind, setKind] = useState<"EGRESO" | "INGRESO">("EGRESO");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [category, setCategory] = useState("OTRO");
  const manager = isManager();
  async function save() {
    try { await appApi("/cash/movements", { method: "POST", body: { kind, concept, amount: Number(amount.replace(",", ".")), method, category: kind === "EGRESO" ? category : null } }); onDone(); } catch (e) { onFail(e); }
  }
  return (
    <Modal eyebrow="CAJA" title="Registrar ingreso o gasto" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={concept.trim().length < 2 || !(Number(amount.replace(",", ".")) > 0)} onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <div className="cb-seg">{(["EGRESO", "INGRESO"] as const).map((k) => <button key={k} type="button" className={kind === k ? "is-on" : ""} onClick={() => setKind(k)}>{k === "EGRESO" ? "Gasto (sale plata)" : "Ingreso (entra plata)"}</button>)}</div>
        <Field label="Concepto"><input value={concept} maxLength={160} onChange={(e) => setConcept(e.target.value)} placeholder={kind === "EGRESO" ? "Ej.: productos de limpieza" : "Ej.: aporte para cambio"} /></Field>
        <div className="form-row">
          <Field label="Importe ($)"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Medio"><select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        {kind === "EGRESO" && <Field label="Rubro"><select value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(CATEGORY_LABEL).filter(([k]) => manager || (k !== "RETIRO" && k !== "ANULACION")).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
        <small className="cb-hint">El efectivo esperado de tu caja se actualiza solo con los movimientos en efectivo.</small>
      </div>
    </Modal>
  );
}

export default CajaDia;
