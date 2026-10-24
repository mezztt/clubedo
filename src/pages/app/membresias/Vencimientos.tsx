import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi, money, shortDate } from "../../../config";
import { Empty, Loading, Seg, useFlash, useRefreshKey } from "../../../components/ui";
import FeeChip from "../../../components/c1/FeeChip";
import CobrarModal from "../../../components/c1/CobrarModal";

interface Row { membership_id: number; member_id: number; member_name: string; phone: string | null; plan_name: string; state: string; state_name: string; state_label: string; tone: string; expires_on: string | null; open_amount: number }
interface Page { items: Row[]; total: number; page: number; pages: number }
type Filter = "POR_VENCER,EN_GRACIA,MOROSA" | "POR_VENCER" | "EN_GRACIA" | "MOROSA";

export default function Vencimientos({ canCobranza }: { canCobranza: boolean }) {
  const [filter, setFilter] = useState<Filter>("POR_VENCER,EN_GRACIA,MOROSA");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [cobrar, setCobrar] = useState<number | null>(null);
  const { fail, node: flash } = useFlash();
  const refresh = useRefreshKey();
  const load = useCallback(() => {
    const p = new URLSearchParams({ state: filter, page: String(page), limit: "40" });
    if (q.trim()) p.set("q", q.trim());
    appApi<Page>(`/memberships?${p}`).then(setData).catch(fail);
  }, [filter, q, page, fail]);
  useEffect(() => { const h = window.setTimeout(load, q ? 250 : 0); return () => window.clearTimeout(h); }, [load, refresh, q]);
  useEffect(() => { setPage(1); }, [filter, q]);
  return (
    <div className="cb-stack">
      <div className="cb-toolbar">
        <div className="cb-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o DNI" aria-label="Buscar" /></div>
        <Seg<Filter> value={filter} onChange={setFilter} options={[["POR_VENCER,EN_GRACIA,MOROSA", "Todos"], ["POR_VENCER", "Por vencer"], ["EN_GRACIA", "En gracia"], ["MOROSA", "Morosos"]]} />
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title="No hay cuotas por vencer ni atrasadas" /> : (
        <>
          <div className="cb-table-wrap"><table className="cb-table">
            <thead><tr><th>Persona</th><th>Plan</th><th>Vence</th><th>Estado</th><th className="c1-num">Debe</th><th /></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.membership_id}>
                <td><Link to={`/app/socios/${r.member_id}`}><strong>{r.member_name}</strong></Link></td>
                <td>{r.plan_name}</td><td>{r.expires_on ? shortDate(r.expires_on) : "—"}</td>
                <td><FeeChip state={r.state} name={r.state_name} label={r.state_label} tone={r.tone} /></td>
                <td className="c1-num">{r.open_amount ? money(r.open_amount) : "—"}</td>
                <td className="c1-num"><button className="primary-button" style={{ padding: "6px 12px" }} onClick={() => setCobrar(r.member_id)}>Cobrar</button></td>
              </tr>))}</tbody></table></div>
          <div className="c1-pager"><span className="cb-muted">{data.total} en total{canCobranza ? " · los avisos por WhatsApp están en Cobranza" : ""}</span>
            <div className="cb-row"><button className="secondary-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {data.page} de {data.pages}</span>
              <button className="secondary-button" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>
        </>
      )}
      {cobrar && <CobrarModal memberId={cobrar} onClose={() => setCobrar(null)} onDone={load} />}
      {flash}
    </div>
  );
}
