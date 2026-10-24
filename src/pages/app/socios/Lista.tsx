import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, downloadFile, getSessionUser, money, useVocab } from "../../../config";
import { Empty, Loading, PageHeader, Pill, useFlash, useRefreshKey } from "../../../components/ui";
import FeeChip from "../../../components/c1/FeeChip";
import AltaModal from "./AltaModal";

interface Row {
  id: number; full_name: string; dni: string; phone: string | null; status: string; plan_name: string | null; state: string; state_name: string;
  state_label: string; state_tone: string; expires_on: string | null; apto: string | null; debt: number | null; minor: boolean; consent: boolean; category: string | null;
}
interface Page { items: Row[]; total: number; page: number; pages: number }
const APTO_TONE: Record<string, string> = { VIGENTE: "green", POR_VENCER: "orange", VENCIDO: "red", SIN_APTO: "gray" };
const APTO_LABEL: Record<string, string> = { VIGENTE: "Apto vigente", POR_VENCER: "Apto por vencer", VENCIDO: "Apto vencido", SIN_APTO: "Sin apto" };

function Lista() {
  const { t } = useVocab();
  const navigate = useNavigate();
  const user = getSessionUser();
  const boss = user?.role === "ADMINISTRADOR" || user?.role === "ENCARGADO";
  const instructor = user?.role === "INSTRUCTOR";
  const { show, fail, node: flash } = useFlash();
  const refresh = useRefreshKey();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ACTIVO");
  const [due, setDue] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), limit: "25" });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (due) p.set("due", due);
    appApi<Page>(`/members?${p}`).then(setData).catch(fail);
  }, [page, q, status, due, fail]);
  useEffect(() => { const h = window.setTimeout(load, q ? 250 : 0); return () => window.clearTimeout(h); }, [load, refresh, q]);
  useEffect(() => { setPage(1); }, [q, status, due]);

  const togglePick = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="products-page">
      <PageHeader eyebrow="PERSONAS" title={t("members", true)} subtitle={`Alta en 30 segundos, estado de cuota a la vista y ficha completa de cada ${t("member")}.`}>
        {!instructor && <button className="primary-button" data-tour="alta" onClick={() => setAdding(true)}>Nueva persona</button>}
        {boss && <button className="secondary-button" onClick={() => navigate("/app/socios/importar")}>Importar desde Excel</button>}
        {boss && <button className="secondary-button" onClick={() => downloadFile("/members/export.csv", "socios.csv").catch(fail)}>Exportar</button>}
        {!instructor && <button className="secondary-button" disabled={!picked.size && status !== "ACTIVO"} onClick={() =>
          window.open(picked.size ? `/print/carnets?ids=${[...picked].join(",")}` : "/print/carnets?all=1", "_blank", "noopener")}>
          {picked.size ? `Carnets (${picked.size})` : "Carnets"}</button>}
      </PageHeader>
      <div className="cb-toolbar">
        <div className="cb-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o DNI" aria-label="Buscar" /></div>
        <div className="cb-filters">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
            <option value="ACTIVO">Activos</option><option value="PROSPECTO">Prospectos</option><option value="INACTIVO">Inactivos</option><option value="BAJA">Bajas</option><option value="">Todos</option>
          </select>
          {!instructor && (
            <select value={due} onChange={(e) => setDue(e.target.value)} aria-label="Cuota">
              <option value="">Toda cuota</option><option value="POR_VENCER">Por vencer</option><option value="EN_GRACIA">En gracia</option><option value="MOROSA">Morosos</option>
              <option value="CONGELADA">Congelados</option><option value="SIN_PLAN">Sin plan</option>
            </select>
          )}
        </div>
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title={q ? "No encontramos a nadie con ese dato" : `Todavía no cargaste ${t("members")}`}>
        {!q && !instructor && <button className="primary-button" onClick={() => setAdding(true)}>Cargar la primera persona</button>}</Empty> : (
        <>
          <div className="cb-table-wrap">
            <table className="cb-table">
              <thead><tr>{!instructor && <th style={{ width: 28 }} />}<th>Persona</th><th>{t("plan", true)}</th><th>Cuota</th>{!instructor && <th>Apto</th>}{!instructor && <th className="c1-num">Deuda</th>}</tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className="is-click" onClick={() => navigate(`/app/socios/${r.id}`)}>
                    {!instructor && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Elegir a ${r.full_name}`} checked={picked.has(r.id)} onChange={() => togglePick(r.id)} /></td>}
                    <td><strong>{r.full_name}</strong><small>DNI {r.dni}{r.minor ? " · menor" : ""}{r.status !== "ACTIVO" ? ` · ${r.status.toLowerCase()}` : ""}</small></td>
                    <td>{r.plan_name || "—"}</td>
                    <td><FeeChip state={r.state} name={r.state_name} label={r.state_label} tone={r.state_tone} /></td>
                    {!instructor && <td>{r.apto ? <Pill tone={APTO_TONE[r.apto] || "gray"}>{APTO_LABEL[r.apto] || r.apto}</Pill> : "—"}</td>}
                    {!instructor && <td className="c1-num">{r.debt ? <strong>{money(r.debt)}</strong> : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="c1-pager">
            <span className="cb-muted">{data.total} {data.total === 1 ? "persona" : "personas"}</span>
            <div className="cb-row">
              <button className="secondary-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Página {data.page} de {data.pages}</span>
              <button className="secondary-button" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          </div>
        </>
      )}
      {adding && <AltaModal onClose={() => setAdding(false)} onCreated={(id, warn) => { setAdding(false); if (warn) fail(new Error(warn)); else show("Persona creada"); navigate(`/app/socios/${id}`); }} />}
      {flash}
    </section>
  );
}

export default Lista;
