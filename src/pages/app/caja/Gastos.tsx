import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime, downloadCsv, money } from "../../../config";
import { Empty, Loading, Pill, Seg, useFlash } from "../../../components/ui";
import { DateRange, METHOD_LABEL, monthStart, today } from "../../../components/c3/common";
import { CATEGORY_LABEL } from "./types";
import type { Movement } from "./types";

interface Res { items: Movement[]; total_out: number; total_in: number; by_category: { category: string; total: number }[] }

/** Gastos e ingresos manuales de todas las cajas del período, con el total por rubro. */
function Gastos() {
  const { fail, node: flash } = useFlash();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [kind, setKind] = useState<"" | "EGRESO" | "INGRESO">("");
  const [data, setData] = useState<Res | null>(null);
  const load = useCallback(() => {
    appApi<Res>(`/cash/movements?from=${from}&to=${to}${kind ? `&kind=${kind}` : ""}`).then(setData).catch(fail);
  }, [from, to, kind, fail]);
  useEffect(() => { setData(null); load(); }, [load]);
  const max = Math.max(...(data?.by_category.map((c) => c.total) || [1]), 1);
  return (
    <div className="cb-stack">
      <div className="cb-toolbar">
        <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); }} />
        <div className="cb-filters">
          <Seg value={kind} onChange={setKind} options={[["", "Todo"], ["EGRESO", "Gastos"], ["INGRESO", "Ingresos"]]} />
          {data && data.items.length > 0 && <button className="secondary-button" onClick={() => downloadCsv(`gastos-${from}-${to}.csv`, ["Fecha", "Tipo", "Concepto", "Rubro", "Medio", "Importe", "Registró"],
            data.items.map((m) => [dateTime(m.at), m.kind === "EGRESO" ? "Gasto" : "Ingreso", m.concept, m.category ? CATEGORY_LABEL[m.category] || m.category : "", METHOD_LABEL[m.method] || m.method, m.amount, m.user_name || ""]))}>Descargar para Excel</button>}
        </div>
      </div>
      {!data ? <Loading /> : (
        <>
          <div className="cb-kpis">
            <div className="cb-kpi"><span className="cb-muted">Gastos del período</span><strong className="c3-bignum">{money(data.total_out)}</strong></div>
            <div className="cb-kpi"><span className="cb-muted">Ingresos manuales</span><strong className="c3-bignum">{money(data.total_in)}</strong></div>
          </div>
          {data.by_category.length > 0 && (
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Gastos por rubro</h2>
              {data.by_category.map((c) => (
                <div className="c3-hbar" key={c.category}><span>{CATEGORY_LABEL[c.category] || c.category}</span><div className="cb-meter"><div className="c3-hbar-fill" style={{ width: `${(c.total / max) * 100}%` }} /></div><strong>{money(c.total)}</strong></div>))}
            </div>
          )}
          {data.items.length === 0 ? <Empty title="No hay movimientos en estas fechas">Los gastos se registran desde «Caja del día».</Empty> : (
            <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Rubro</th><th>Medio</th><th>Registró</th><th className="num">Importe</th></tr></thead>
              <tbody>{data.items.map((m) => <tr key={m.id}><td>{dateTime(m.at)}</td><td>{m.concept}</td><td>{m.category ? CATEGORY_LABEL[m.category] || m.category : "—"}</td><td>{METHOD_LABEL[m.method] || m.method}</td><td>{m.user_name}</td>
                <td className="num"><Pill tone={m.kind === "EGRESO" ? "red" : "green"}>{m.kind === "EGRESO" ? "−" : "+"}{money(m.amount)}</Pill></td></tr>)}</tbody></table></div>
          )}
        </>
      )}
      {flash}
    </div>
  );
}

export default Gastos;
