import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PAYMENT_LABELS, appApi, dateTime, money } from "../../config";
import "../../clubedo.css";
import "../../c1.css";

interface Receipt {
  number_text: string; status: string; voided_reason: string | null; refund_pending: boolean; paid_at: string; method: string; amount: number; external_invoice_number: string | null;
  notes: string | null; cashier: string | null; member: { name: string; dni: string } | null; lines: { description: string; period: string | null; amount: number }[]; credit: number;
  company: { name: string; cuit: string | null; address: string | null; city: string | null; phone: string | null; email: string | null }; footer: string | null; disclaimer: string;
}

/** Recibo interno imprimible. Siempre dice «Documento no válido como factura». */
export default function Recibo() {
  const { id } = useParams();
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { appApi<Receipt>(`/payments/${id}/receipt`).then(setR).catch((e) => setError(e.message)); }, [id]);
  if (error) return <div className="cb-print-page"><div className="cb-sheet">{error}</div></div>;
  if (!r) return <div className="cb-print-page"><div className="cb-sheet">Cargando...</div></div>;
  return (
    <div className="cb-print-page">
      <div className="cb-print-toolbar"><span /><button className="primary-button" onClick={() => window.print()}>Imprimir</button></div>
      <div className="cb-sheet">
        <div className="cb-sheet-head">
          <div><h1>{r.company.name}</h1>
            <small>{[r.company.address, r.company.city].filter(Boolean).join(", ")}</small>
            <small>{[r.company.cuit ? `CUIT ${r.company.cuit}` : "", r.company.phone, r.company.email].filter(Boolean).join(" · ")}</small></div>
          <div style={{ textAlign: "right" }}><h1>Recibo N° {r.number_text}</h1><small>{dateTime(r.paid_at)}</small>
            {r.status !== "OK" && <div className="c1-void">ANULADO</div>}</div>
        </div>
        <div className="cb-sheet-meta">
          <div><small>Recibí de</small><strong>{r.member?.name || "—"}</strong></div>
          <div><small>DNI</small><strong>{r.member?.dni || "—"}</strong></div>
          <div><small>Medio de pago</small><strong>{PAYMENT_LABELS[r.method] || r.method}</strong></div>
          <div><small>Cobró</small><strong>{r.cashier || "—"}</strong></div>
        </div>
        <table className="c1-receipt-lines">
          <thead><tr><th>Concepto</th><th>Importe</th></tr></thead>
          <tbody>
            {r.lines.map((l, i) => <tr key={i}><td>{l.description}{l.period ? ` · ${l.period}` : ""}</td><td className="num">{money(l.amount)}</td></tr>)}
            {r.credit > 0 && <tr><td>Saldo a favor</td><td className="num">{money(r.credit)}</td></tr>}
          </tbody>
        </table>
        <div className="cb-print-sum is-total"><span>Total cobrado</span><span>{money(r.amount)}</span></div>
        {r.external_invoice_number && <p>Factura externa N° {r.external_invoice_number}</p>}
        {r.notes && <p>{r.notes}</p>}
        {r.status !== "OK" && r.voided_reason && <p>Anulado: {r.voided_reason}</p>}
        <div className="cb-sheet-foot"><span>{r.footer || ""}</span><strong>{r.disclaimer}</strong></div>
      </div>
    </div>
  );
}
