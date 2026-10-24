import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { appApi, dateTime, money } from "../../config";
import type { SaleDetail } from "../app/caja/types";
import { METHOD_LABEL } from "../../components/c3/common";

/** Ticket de venta (se imprime en hoja o ticketera). Documento interno: no es una factura. */
function PrintVenta() {
  const { id = "" } = useParams();
  const [s, setS] = useState<SaleDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { appApi<SaleDetail>(`/sales/${id}`).then(setS).catch((e) => setError(e.message)); }, [id]);
  if (error) return <div className="cb-print-page"><div className="cb-sheet"><p>{error}</p></div></div>;
  if (!s) return <div className="cb-print-page"><div className="cb-sheet"><p>Cargando...</p></div></div>;
  return (
    <div className="cb-print-page">
      <div className="cb-print-toolbar"><button className="secondary-button" onClick={() => window.close()}>Cerrar</button><button className="primary-button" onClick={() => window.print()}>Imprimir</button></div>
      <div className="cb-sheet" style={{ maxWidth: 420 }}>
        <div className="cb-sheet-head"><div><h1>{s.club.name}</h1><small>{[s.club.address, s.club.city].filter(Boolean).join(", ")}</small>{s.club.cuit && <small>CUIT {s.club.cuit}</small>}</div><div style={{ textAlign: "right" }}><strong>Ticket #{s.number}</strong><small>{dateTime(s.at)}</small></div></div>
        {s.member_name && <p style={{ margin: "0 0 8px" }}>Cliente: <strong>{s.member_name}</strong></p>}
        <table><thead><tr><th>Detalle</th><th className="num">Cant.</th><th className="num">Importe</th></tr></thead>
          <tbody>{s.items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="num">{i.qty}</td><td className="num">{money(i.subtotal)}</td></tr>)}</tbody></table>
        {s.discount_amount > 0 && <div className="cb-print-sum"><span>Descuento</span><span>−{money(s.discount_amount)}</span></div>}
        <div className="cb-print-sum is-total"><span>Total</span><span>{money(s.total)}</span></div>
        <p style={{ margin: "8px 0 0" }}>{s.on_account ? "A cuenta (pendiente de cobro)" : `Pagado con ${METHOD_LABEL[s.method || ""] || s.method}`}{s.receipt_number ? ` · Recibo #${s.receipt_number}` : ""}</p>
        {s.status === "ANULADA" && <p><strong>VENTA ANULADA</strong></p>}
        {s.footer && <p style={{ textAlign: "center" }}>{s.footer}</p>}
        <div className="cb-sheet-foot"><span>Documento no válido como factura</span><span>Clubedo</span></div>
      </div>
    </div>
  );
}

export default PrintVenta;
