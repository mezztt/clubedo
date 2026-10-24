import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PAYMENT_LABELS, appApi, dateTime, dayKey, money } from "../../../config";
import { Empty, Field, Loading, Modal, Pill, useFlash, useRefreshKey } from "../../../components/ui";

interface Row { id: number; number_text: string; member_id: number | null; member_name: string | null; amount: number; method: string; paid_at: string; status: string; refund_pending: boolean; cashier: string | null; lines: { description: string }[] }
interface Page { items: Row[]; total: number; page: number; pages: number; totals_by_method: Record<string, number>; total_ok: number }

export default function Pagos() {
  const today = dayKey(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [voiding, setVoiding] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const { show, fail, node: flash } = useFlash();
  const refresh = useRefreshKey();
  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), limit: "40" });
    if (from) p.set("date_from", from);
    if (to) p.set("date_to", to);
    if (method) p.set("method", method);
    if (q.trim()) p.set("q", q.trim());
    appApi<Page>(`/payments?${p}`).then(setData).catch(fail);
  }, [from, to, method, q, page, fail]);
  useEffect(() => { const h = window.setTimeout(load, q ? 250 : 0); return () => window.clearTimeout(h); }, [load, refresh, q]);
  useEffect(() => { setPage(1); }, [from, to, method, q]);
  const doVoid = async () => {
    if (!voiding) return;
    try { await appApi(`/payments/${voiding.id}/void`, { method: "POST", body: { reason: reason.trim() } }); setVoiding(null); setReason(""); show("Cobro anulado"); load(); } catch (e) { fail(e); }
  };
  return (
    <div className="cb-stack">
      <div className="cb-toolbar">
        <div className="cb-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, DNI o N° de recibo" aria-label="Buscar" /></div>
        <div className="cb-filters">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
          <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Medio"><option value="">Todos los medios</option>{Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
      </div>
      {!data ? <Loading /> : (
        <>
          <div className="cb-kpis">
            <div className="cb-kpi"><span>Cobrado</span><strong>{money(data.total_ok)}</strong></div>
            {Object.entries(data.totals_by_method).map(([k, v]) => <div key={k} className="cb-kpi"><span>{PAYMENT_LABELS[k] || k}</span><strong>{money(v)}</strong></div>)}
          </div>
          {data.items.length === 0 ? <Empty title="No hay cobros en ese período" /> : (
            <div className="cb-table-wrap"><table className="cb-table">
              <thead><tr><th>Recibo</th><th>Fecha</th><th>Persona</th><th>Detalle</th><th>Medio</th><th className="c1-num">Importe</th><th /></tr></thead>
              <tbody>{data.items.map((p) => (
                <tr key={p.id}>
                  <td>{p.number_text}</td><td>{dateTime(p.paid_at)}</td>
                  <td>{p.member_id ? <Link to={`/app/socios/${p.member_id}`}>{p.member_name}</Link> : "—"}</td>
                  <td>{p.lines.map((l) => l.description).join(", ") || "—"}</td><td>{PAYMENT_LABELS[p.method] || p.method}</td>
                  <td className="c1-num">{p.status === "OK" ? money(p.amount) : <Pill tone="gray">Anulado</Pill>} {p.refund_pending && <Pill tone="orange">A devolver</Pill>}</td>
                  <td className="c1-num"><a href={`/print/recibo/${p.id}`} target="_blank" rel="noreferrer">Recibo</a>
                    {p.status === "OK" && <> · <button type="button" className="cb-link-danger" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }} onClick={() => setVoiding(p)}>Anular</button></>}</td>
                </tr>))}</tbody></table></div>
          )}
          <div className="c1-pager"><span className="cb-muted">{data.total} cobros</span>
            <div className="cb-row"><button className="secondary-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {data.page} de {data.pages}</span>
              <button className="secondary-button" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
        </>
      )}
      {voiding && (
        <Modal title={`Anular recibo ${voiding.number_text}`} onClose={() => setVoiding(null)}
          footer={<><button className="secondary-button" onClick={() => setVoiding(null)}>Cancelar</button><button className="cb-danger-button" disabled={reason.trim().length < 3} onClick={doVoid}>Anular cobro</button></>}>
          <div className="product-form"><Field label="Motivo"><input value={reason} autoFocus onChange={(e) => setReason(e.target.value)} /></Field></div>
        </Modal>
      )}
      {flash}
    </div>
  );
}
