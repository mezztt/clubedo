import { dateTime, money, periodLabel } from "../../config";

export interface SettlementPrint {
  id: number; instructor_name: string; period: string; total: number; status: string; notes: string | null; legend: string; generated_at: string;
  paid_at: string | null; club: { name: string; cuit: string | null; address: string | null; city: string | null };
  instructor: { name: string; dni: string | null; license_number: string | null; employment: string | null };
  items: { id: number; kind_label: string; description: string; base_amount: number; commission_amount: number }[];
}

/** Liquidación interna de comisiones. Documento de control: no es factura ni recibo de sueldo. */
export default function SettlementSheet({ data }: { data: SettlementPrint }) {
  return (
    <div className="cb-sheet">
      <div className="cb-sheet-head">
        <div><h1>Liquidación de comisiones</h1><small>{data.club.name}{data.club.cuit ? ` · CUIT ${data.club.cuit}` : ""}</small><small>{[data.club.address, data.club.city].filter(Boolean).join(", ")}</small></div>
        <div style={{ textAlign: "right" }}><strong>{periodLabel(data.period)}</strong><small>N.º {data.id}</small><small>{data.status === "BORRADOR" ? "BORRADOR" : data.status === "PAGADA" ? "Pagada" : "Confirmada"}</small></div>
      </div>
      <div className="cb-sheet-meta">
        <div><small>Persona</small><strong>{data.instructor.name}</strong></div>
        <div><small>DNI</small><strong>{data.instructor.dni || "-"}</strong></div>
        <div><small>Matrícula</small><strong>{data.instructor.license_number || "-"}</strong></div>
        <div><small>Situación</small><strong>{(data.instructor.employment || "-").replace(/_/g, " ").toLowerCase()}</strong></div>
      </div>
      <table>
        <thead><tr><th>Concepto</th><th>Regla</th><th className="num">Base</th><th className="num">Comisión</th></tr></thead>
        <tbody>{data.items.map((i) => <tr key={i.id}><td>{i.description}</td><td>{i.kind_label}</td><td className="num">{money(i.base_amount)}</td><td className="num">{money(i.commission_amount)}</td></tr>)}</tbody>
      </table>
      <div className="cb-print-sum is-total"><span>Total</span><span>{money(data.total)}</span></div>
      {data.paid_at && <p>Pagada el {dateTime(data.paid_at)}.</p>}
      <div className="cb-signature-line"><div>Firma de conformidad</div></div>
      <div className="cb-sheet-foot"><span>{data.legend}</span><span>Emitida {dateTime(data.generated_at)}</span></div>
    </div>
  );
}
