import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi, canAccess, dayKey, downloadFile, getSessionUser, money, shortDate } from "../../../config";
import { Empty, Field, Loading, Modal, Pill, useFlash, useRefreshKey } from "../../../components/ui";
import CobrarModal from "../../../components/c1/CobrarModal";

interface Row { member_id: number; full_name: string; dni: string; phone: string | null; plan_name: string | null; total: number; overdue: number; oldest_due: string; days: number; bucket: string; charges: number; first_charge_id: number | null; valid_phone: boolean }
interface Res { items: Row[]; total: number; total_overdue: number }
interface Summary { buckets: { key: string; count: number; amount: number }[]; count: number; amount: number }
const BUCKET_TONE: Record<string, string> = { "1-10": "orange", "11-30": "orange", "31-60": "red", "+60": "red" };

export default function Deudores() {
  const user = getSessionUser();
  const mp = canAccess(user, "cobranza");
  const [bucket, setBucket] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [sum, setSum] = useState<Summary | null>(null);
  const [cobrar, setCobrar] = useState<number | null>(null);
  const [plan, setPlan] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ text: string; wa_url: string | null; mailto: string | null } | null>(null);
  const { show, fail, node: flash } = useFlash();
  const refresh = useRefreshKey();
  const load = useCallback(() => {
    appApi<Res>(`/debtors${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`).then(setRes).catch(fail);
    appApi<Summary>("/debtors/summary").then(setSum).catch(() => setSum(null));
  }, [q, fail]);
  useEffect(() => { const h = window.setTimeout(load, q ? 250 : 0); return () => window.clearTimeout(h); }, [load, refresh, q]);

  const message = async (r: Row) => {
    try { setMsg(await appApi(`/collections/members/${r.member_id}/message`, { method: "POST", body: {} })); } catch (e) { fail(e); }
  };
  const link = async (r: Row) => {
    if (!r.first_charge_id) return;
    try {
      const l = await appApi<{ url: string }>(`/charges/${r.first_charge_id}/payment-link`, { method: "POST" });
      await navigator.clipboard?.writeText(l.url).catch(() => undefined);
      show("Link de pago copiado");
    } catch (e) { fail(e); }
  };
  if (!res) return <Loading />;
  const rows = bucket ? res.items.filter((r) => r.bucket === bucket) : res.items;
  return (
    <div className="cb-stack">
      {sum && (
        <div className="cb-kpis">
          <button type="button" className="cb-kpi" onClick={() => setBucket("")} style={{ textAlign: "left", cursor: "pointer" }}><span>Total vencido</span><strong>{money(sum.amount)}</strong><small>{sum.count} personas</small></button>
          {sum.buckets.map((b) => (
            <button type="button" key={b.key} className="cb-kpi" onClick={() => setBucket(bucket === b.key ? "" : b.key)} style={{ textAlign: "left", cursor: "pointer", outline: bucket === b.key ? "2px solid var(--cb-brand, #1f2a5c)" : undefined }}>
              <span>{b.key} días</span><strong>{money(b.amount)}</strong><small>{b.count} personas</small></button>))}
        </div>
      )}
      <div className="cb-toolbar">
        <div className="cb-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o DNI" aria-label="Buscar" /></div>
        <button className="secondary-button" onClick={() => downloadFile("/collections/export.csv", `deudores-${dayKey(new Date())}.csv`).catch(fail)}>Exportar</button>
      </div>
      {rows.length === 0 ? <Empty title={res.items.length ? "Nadie en ese tramo" : "No hay deudores. Todo al día."} /> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Persona</th><th>Plan</th><th>Desde</th><th className="c1-num">Debe</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.member_id}>
              <td><Link to={`/app/socios/${r.member_id}`}><strong>{r.full_name}</strong></Link><small>DNI {r.dni}</small></td>
              <td>{r.plan_name || "—"}</td>
              <td>{shortDate(r.oldest_due)} <Pill tone={BUCKET_TONE[r.bucket] || "gray"}>{r.days} días</Pill></td>
              <td className="c1-num"><strong>{money(r.overdue)}</strong>{r.total !== r.overdue && <small>{money(r.total)} con lo que vence</small>}</td>
              <td className="c1-num"><div className="cb-row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="primary-button" style={{ padding: "6px 12px" }} onClick={() => setCobrar(r.member_id)}>Cobrar</button>
                <button className="secondary-button" disabled={!r.valid_phone} title={r.valid_phone ? "" : "No tiene un teléfono válido"} onClick={() => message(r)}>Mensaje</button>
                {mp && <button className="secondary-button" onClick={() => link(r)}>Link de pago</button>}
                <button className="secondary-button" onClick={() => setPlan(r)}>Plan de pagos</button></div></td>
            </tr>))}</tbody></table></div>
      )}
      {cobrar && <CobrarModal memberId={cobrar} onClose={() => setCobrar(null)} onDone={load} />}
      {plan && <PlanModal row={plan} onClose={() => setPlan(null)} onDone={() => { setPlan(null); show("Plan de pagos creado"); load(); }} />}
      {msg && (
        <Modal title="Mensaje listo" onClose={() => setMsg(null)} footer={<><button className="secondary-button" onClick={() => setMsg(null)}>Cerrar</button>
          {msg.wa_url && <a className="primary-button" href={msg.wa_url} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}</>}>
          <div className="c1-msg">{msg.text}</div>
        </Modal>
      )}
      {flash}
    </div>
  );
}

function PlanModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const [n, setN] = useState("3");
  const [first, setFirst] = useState(dayKey(new Date()));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const total = row.overdue;
  const k = Number(n);
  const go = async () => {
    try { await appApi("/payment-plans", { method: "POST", body: { member_id: row.member_id, installments: k, first_due: first, notes: notes.trim() || null } }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo"); }
  };
  return (
    <Modal title={`Plan de pagos · ${row.full_name}`} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!(k >= 2 && k <= 24)} onClick={go}>Crear plan</button></>}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <p>Se refinancia la deuda vencida de <strong>{money(total)}</strong>{k >= 2 ? ` en ${k} cuotas de unos ${money(total / k)}` : ""}.</p>
        <div className="form-row">
          <Field label="Cantidad de cuotas"><input inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <Field label="Primer vencimiento"><input type="date" value={first} min={dayKey(new Date())} onChange={(e) => setFirst(e.target.value)} /></Field>
        </div>
        <Field label="Nota (opcional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
