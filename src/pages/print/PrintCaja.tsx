import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { appApi, dateTime, money } from "../../config";
import { METHOD_LABEL } from "../../components/c3/common";
import { CATEGORY_LABEL } from "../app/caja/types";
import type { CashSess, Movement } from "../app/caja/types";

interface Detail extends CashSess { payments: { id: number; receipt_number: number; at: string; amount: number; method: string; status: string; concept: string; member_name: string | null }[]; movements: Movement[]; club: { name: string } }

/** Resumen de cierre de caja para imprimir y firmar. */
function PrintCaja() {
  const { id = "" } = useParams();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { appApi<Detail>(`/cash/sessions/${id}`).then(setD).catch((e) => setError(e.message)); }, [id]);
  if (error) return <div className="cb-print-page"><div className="cb-sheet"><p>{error}</p></div></div>;
  if (!d) return <div className="cb-print-page"><div className="cb-sheet"><p>Cargando...</p></div></div>;
  const t = d.totals;
  return (
    <div className="cb-print-page">
      <div className="cb-print-toolbar"><button className="secondary-button" onClick={() => window.close()}>Cerrar</button><button className="primary-button" onClick={() => window.print()}>Imprimir</button></div>
      <div className="cb-sheet">
        <div className="cb-sheet-head"><div><h1>Cierre de caja</h1><small>{d.club.name}</small></div><div style={{ textAlign: "right" }}><strong>{d.user_name}</strong><small>{d.status === "CERRADA" ? "Cerrada" : "Abierta"}</small></div></div>
        <div className="cb-sheet-meta"><div><small>Apertura</small>{dateTime(d.opened_at)}</div><div><small>Cierre</small>{d.closed_at ? dateTime(d.closed_at) : "Sin cerrar"}</div>
          <div><small>Efectivo inicial</small>{money(d.opening_amount)}</div><div><small>Efectivo esperado</small>{money(d.expected_cash)}</div>
          <div><small>Efectivo contado</small>{d.closing_counted !== null ? money(d.closing_counted) : "—"}</div><div><small>Diferencia</small>{d.difference !== null ? money(d.difference) : "—"}</div></div>
        {d.notes && <p><strong>Nota:</strong> {d.notes}</p>}
        <h2>Cobros por medio</h2>
        <table><tbody>{Object.entries(t?.by_method || {}).map(([k, v]) => <tr key={k}><td>{METHOD_LABEL[k] || k}</td><td className="num">{v.count}</td><td className="num">{money(v.total)}</td></tr>)}</tbody></table>
        <h2>Detalle de cobros</h2>
        <table><thead><tr><th>Recibo</th><th>Concepto</th><th>Medio</th><th className="num">Importe</th></tr></thead>
          <tbody>{d.payments.map((p) => <tr key={p.id}><td>#{p.receipt_number}</td><td>{p.concept}{p.member_name ? ` · ${p.member_name}` : ""}</td><td>{METHOD_LABEL[p.method] || p.method}</td><td className="num">{p.status === "ANULADO" ? "Anulado" : money(p.amount)}</td></tr>)}</tbody></table>
        {d.movements.length > 0 && (<><h2>Ingresos y gastos</h2>
          <table><tbody>{d.movements.map((m) => <tr key={m.id}><td>{m.concept}{m.category ? ` (${CATEGORY_LABEL[m.category] || m.category})` : ""}</td><td className="num">{m.kind === "EGRESO" ? "−" : "+"}{money(m.amount)}</td></tr>)}</tbody></table></>)}
        <p style={{ marginTop: 40 }}>Firma: ______________________________</p>
        <div className="cb-sheet-foot"><span>Documento interno. No válido como factura</span><span>Clubedo</span></div>
      </div>
    </div>
  );
}

export default PrintCaja;
