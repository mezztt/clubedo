import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime, money } from "../../../config";
import { Empty, Field, Loading, Modal, Pill, useFlash } from "../../../components/ui";
import { DateRange, METHOD_LABEL, daysAgo, today } from "../../../components/c3/common";
import type { SaleDetail, SaleRow } from "./types";

/** Historial de ventas de productos: detalle, ticket para imprimir y anulación con motivo. */
function Ventas() {
  const { show, fail, node: flash } = useFlash();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: SaleRow[]; total: number; count: number } | null>(null);
  const [open, setOpen] = useState<SaleDetail | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(() => {
    appApi(`/sales?from=${from}&to=${to}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`).then(setData).catch(fail);
  }, [from, to, q, fail]);
  useEffect(() => { const h = window.setTimeout(load, 200); return () => window.clearTimeout(h); }, [load]);

  async function openSale(id: number) { try { setReason(""); setOpen(await appApi<SaleDetail>(`/sales/${id}`)); } catch (e) { fail(e); } }
  async function voidSale() {
    if (!open) return;
    try { setOpen(await appApi<SaleDetail>(`/sales/${open.id}/void`, { method: "POST", body: { reason: reason.trim() } })); show("Venta anulada"); load(); } catch (e) { fail(e); }
  }
  return (
    <div className="cb-stack">
      <div className="cb-toolbar">
        <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); }} />
        <input className="c3-input cb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="N.º de venta" inputMode="numeric" aria-label="Buscar por número" />
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title="No hay ventas en estas fechas" /> : (
        <>
          <p className="cb-muted" style={{ margin: 0 }}>{data.count} ventas · {money(data.total)}</p>
          <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Medio</th><th>Vendió</th><th className="num">Total</th><th>Estado</th></tr></thead>
            <tbody>{data.items.map((s) => (
              <tr key={s.id} className="is-click" onClick={() => openSale(s.id)}>
                <td><span className="cb-code-sm">#{s.number}</span></td><td>{dateTime(s.at)}</td><td>{s.member_name || "Mostrador"}</td>
                <td>{s.on_account ? "A cuenta" : METHOD_LABEL[s.method || ""] || s.method}</td><td>{s.user_name}</td><td className="num">{money(s.total)}</td>
                <td><Pill tone={s.status === "ANULADA" ? "gray" : s.on_account && s.charge_status !== "PAGADA" ? "orange" : "green"}>{s.status === "ANULADA" ? "Anulada" : s.on_account && s.charge_status !== "PAGADA" ? "A cobrar" : "Cobrada"}</Pill></td></tr>))}</tbody></table></div>
        </>
      )}
      {open && (
        <Modal eyebrow="VENTA" title={`Venta #${open.number}`} onClose={() => setOpen(null)}
          footer={<><button className="secondary-button" onClick={() => window.open(`/print/venta/${open.id}`, "_blank")}>Imprimir ticket</button><button className="primary-button" onClick={() => setOpen(null)}>Cerrar</button></>}>
          <div className="cb-detail-grid">
            <div><small>Fecha</small><strong>{dateTime(open.at)}</strong></div><div><small>Cliente</small><strong>{open.member_name || "Mostrador"}</strong></div>
            <div><small>Medio</small><strong>{open.on_account ? "A cuenta" : METHOD_LABEL[open.method || ""] || open.method}</strong></div><div><small>Atendió</small><strong>{open.user_name}</strong></div>
          </div>
          <div className="cb-table-wrap"><table className="cb-table"><tbody>
            {open.items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="num">{i.qty} × {money(i.unit_price)}</td><td className="num">{money(i.subtotal)}</td></tr>)}
            {open.discount_amount > 0 && <tr><td colSpan={2}>Descuento</td><td className="num">−{money(open.discount_amount)}</td></tr>}</tbody>
            <tfoot><tr><td colSpan={2}>Total</td><td className="num">{money(open.total)}</td></tr></tfoot></table></div>
          {open.status === "ANULADA" ? <div className="cb-note cb-note-warn" style={{ marginTop: 10 }}>Anulada{open.voided_reason ? `: ${open.voided_reason}` : ""}. El stock volvió a su lugar.</div> : (
            <div className="product-form" style={{ marginTop: 14 }}>
              <Field label="Anular esta venta" hint="Repone el stock y anula el cobro. Queda registrado quién y por qué."><input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (obligatorio)" /></Field>
              <div><button className="cb-danger-button" disabled={reason.trim().length < 3} onClick={voidSale}>Anular venta</button></div>
            </div>)}
        </Modal>
      )}
      {flash}
    </div>
  );
}

export default Ventas;
