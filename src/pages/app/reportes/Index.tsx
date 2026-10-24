import { useCallback, useEffect, useState } from "react";
import { appApi, downloadFile, money, shortDate, useVocab } from "../../../config";
import { Empty, Loading, Pill, Seg, Switch, useFlash } from "../../../components/ui";
import { DateRange, daysAgo, monthStart, num, today, useSub } from "../../../components/c3/common";
import { BarChart, Heatmap, HBars, LineChart } from "../../../components/reportes/charts";

const BASE = "/app/reportes";

interface IndexItem { key: string; title: string; text: string; available: boolean; reason: string | null }
const ROUTE: Record<string, string> = { churn: "desercion", riesgo: "riesgo", ingresos: "ingresos", asistencia: "asistencia", socios: "socios", caja: "caja", instructores: "instructores" };
const TITLE: Record<string, string> = { desercion: "Deserción y retención", riesgo: "Socios en riesgo", ingresos: "Cobrado vs esperado y mora", asistencia: "Ocupación y asistencia", socios: "Altas, bajas y composición", caja: "Caja y ventas", instructores: "Instructores" };

/** Reportes: siete pantallas con gráficos y exportación a Excel (CSV). Las definiciones se muestran en pantalla. */
function Index() {
  const [sub, go] = useSub(BASE, "");
  const [idx, setIdx] = useState<{ items: IndexItem[]; encargado_sees_income: boolean; role: string } | null>(null);
  const { fail, show, node: flash } = useFlash();
  useEffect(() => { appApi("/reports/index").then(setIdx).catch(fail); }, [fail]);

  async function toggleIncome(v: boolean) {
    try { await appApi("/reports/settings", { method: "PUT", body: { encargado_sees_income: v } }); setIdx((i) => i && { ...i, encargado_sees_income: v }); show(v ? "Los encargados ya ven los ingresos" : "Los ingresos quedan solo para administración"); } catch (e) { fail(e); }
  }

  return (
    <section className="products-page">
      <div className="products-header">
        <div><span className="dashboard-eyebrow">REPORTES</span><h1>{sub && TITLE[sub] ? TITLE[sub] : "Reportes"}</h1>
          <p>{sub && TITLE[sub] ? <button className="cb-link" onClick={() => go("")}>← Todos los reportes</button> : "Mirá quién se está yendo antes de que se vaya, cuánto entra y cómo se llenan las clases."}</p></div>
      </div>
      {!idx ? <Loading /> : !sub || !TITLE[sub] ? (
        <>
          <div className="c3-report-cards">
            {idx.items.map((it) => (
              <button key={it.key} className="c3-report-card" disabled={!it.available} style={it.available ? undefined : { opacity: 0.6, cursor: "not-allowed" }} onClick={() => go(ROUTE[it.key])}>
                <strong>{it.title}</strong><span>{it.available ? it.text : it.reason}</span>
              </button>))}
          </div>
          {idx.role === "ADMINISTRADOR" && (
            <div className="cb-card" style={{ marginTop: 18, maxWidth: 560 }}>
              <Switch on={idx.encargado_sees_income} onChange={toggleIncome} label="Los encargados pueden ver ingresos" hint="Por defecto el reporte de cobrado y mora lo ve solo el administrador." />
            </div>)}
        </>
      ) : sub === "desercion" ? <Churn /> : sub === "riesgo" ? <Risk /> : sub === "ingresos" ? <Income /> : sub === "asistencia" ? <Attendance /> : sub === "socios" ? <Members /> : sub === "caja" ? <CashReport /> : <Instructors />}
      {flash}
    </section>
  );
}

function Unavailable({ reason }: { reason?: string }) { return <Empty title="Este reporte no está disponible">{reason && <p className="cb-muted">{reason}</p>}</Empty>; }

function Definition({ text }: { text?: string }) { return text ? <p className="c3-def"><strong>Cómo se calcula: </strong>{text}</p> : null; }

function Export({ path, name }: { path: string; name: string }) {
  const { fail, node } = useFlash();
  return <><button className="secondary-button" onClick={() => downloadFile(path + (path.includes("?") ? "&" : "?") + "format=csv", name).catch(fail)}>Descargar para Excel</button>{node}</>;
}

/** Carga un reporte con rango de fechas */
function useReport<T>(path: string, initialFrom: string) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today());
  const [data, setData] = useState<T | null>(null);
  const { fail, node } = useFlash();
  const url = `${path}${path.includes("?") ? "&" : "?"}from=${from}&to=${to}`;
  useEffect(() => { setData(null); appApi<T>(url).then(setData).catch(fail); }, [url, fail]);
  return { from, to, setRange: (a: string, b: string) => { setFrom(a); setTo(b); }, data, url, node };
}

// ---------------------------------------------------------------- 1 · deserción
function Churn() {
  const { t } = useVocab();
  const r = useReport<any>("/reports/churn", (() => { const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; })());
  const [tab, setTab] = useState<"mensual" | "cohortes" | "motivos" | "perdidos">("mensual");
  const d = r.data;
  return (
    <div className="cb-stack">
      <div className="cb-toolbar"><DateRange from={r.from} to={r.to} onChange={r.setRange} />
        <div className="cb-filters"><Seg value={tab} onChange={setTab} options={[["mensual", "Mes a mes"], ["cohortes", "Cohortes"], ["motivos", "Motivos"], ["perdidos", "Quiénes se fueron"]]} />
          <Export path={`/reports/churn?from=${r.from}&to=${r.to}&section=${tab === "perdidos" ? "mensual" : tab}`} name={`desercion-${tab}.csv`} /></div></div>
      {!d ? <Loading /> : (
        <>
          <div className="cb-kpis">
            <div className="cb-kpi"><span className="cb-muted">Deserción promedio</span><strong className="c3-bignum">{d.average_churn_pct ?? "—"}{d.average_churn_pct !== null ? " %" : ""}</strong><small className="cb-muted">Meses completos del período</small></div>
            <div className="cb-kpi"><span className="cb-muted">Último mes completo</span><strong className="c3-bignum">{d.last ? `${d.last.churn_pct} %` : "—"}</strong><small className="cb-muted">{d.last ? `${d.last.lost} de ${d.last.start_active} activos (${d.last.label})` : ""}</small></div>
            <div className="cb-kpi"><span className="cb-muted">Retención último mes</span><strong className="c3-bignum">{d.last?.retention_pct ?? "—"}{d.last?.retention_pct != null ? " %" : ""}</strong></div>
          </div>
          {tab === "mensual" && (
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Deserción por mes</h2>
              {d.series.length === 0 ? <Empty title="Sin datos para estas fechas" /> : <LineChart name="Deserción por mes" data={d.series.map((s: any) => ({ label: s.label, value: s.churn_pct }))} />}
              <div className="cb-table-wrap" style={{ marginTop: 12 }}><table className="cb-table"><thead><tr><th>Mes</th><th className="num">Activos el día 1</th><th className="num">Se fueron</th><th className="num">Entraron</th><th className="num">Deserción</th><th className="num">Retención</th></tr></thead>
                <tbody>{d.series.map((s: any) => <tr key={s.month}><td>{s.label}{s.partial && <Pill tone="gray">En curso</Pill>}</td><td className="num">{s.start_active}</td><td className="num">{s.lost}</td><td className="num">{s.new}</td><td className="num">{s.churn_pct} %</td><td className="num">{s.retention_pct ?? "—"}{s.retention_pct != null ? " %" : ""}</td></tr>)}</tbody></table></div>
              <Definition text={d.definitions?.churn} />
            </div>)}
          {tab === "cohortes" && (
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Cuántos siguen después de entrar</h2>
              {d.cohorts.length === 0 ? <Empty title="Todavía no hay cohortes en este período" /> : (
                <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Mes de alta</th><th className="num">Personas</th><th className="num">A 1 mes</th><th className="num">A 3 meses</th><th className="num">A 6 meses</th><th className="num">A 12 meses</th></tr></thead>
                  <tbody>{d.cohorts.map((c: any) => <tr key={c.month}><td>{c.label}</td><td className="num">{c.size}</td>{["1", "3", "6", "12"].map((k) => <td className="num" key={k}>{c.retention[k] == null ? "—" : `${c.retention[k]} %`}</td>)}</tr>)}</tbody></table></div>)}
              <Definition text={d.definitions?.cohort} />
            </div>)}
          {tab === "motivos" && (
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Por qué se fueron</h2>
              <HBars rows={d.reasons.map((x: any) => ({ name: x.reason, value: x.count }))} empty="Nadie se dio de baja en este período" format={(v) => String(v)} />
              <p className="cb-muted">Cargá el motivo al dar de baja a {t("member")} para que acá se vea claro.</p></div>)}
          {tab === "perdidos" && (
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Quiénes se fueron el último mes</h2>
              {d.lost.length === 0 ? <p className="cb-muted">Nadie en el último mes completo.</p> : (
                <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Persona</th><th>Plan</th><th>Motivo</th><th /></tr></thead>
                  <tbody>{d.lost.map((m: any) => <tr key={m.member_id}><td><strong>{m.name}</strong><small>{m.phone || "Sin teléfono"}</small></td><td>{m.plan_name || "—"}</td><td>{m.left_reason || "Sin motivo cargado"}</td>
                    <td className="num">{m.wa_url ? <a className="secondary-button" href={m.wa_url} target="_blank" rel="noreferrer">Escribirle por WhatsApp</a> : <span className="cb-muted">Sin teléfono</span>}</td></tr>)}</tbody></table></div>)}
            </div>)}
        </>)}
      {r.node}
    </div>
  );
}

// ---------------------------------------------------------------- 2 · riesgo
function Risk() {
  const { show, fail, node } = useFlash();
  const [d, setD] = useState<any>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [score, setScore] = useState<"0" | "3" | "2" | "1">("0");
  const load = useCallback(() => { appApi("/reports/at-risk").then(setD).catch(fail); }, [fail]);
  useEffect(load, [load]);
  if (!d) return <><Loading />{node}</>;
  if (!d.available) return <Unavailable reason={d.reason} />;
  const items = d.items.filter((i: any) => score === "0" || i.score === Number(score));
  async function queue() {
    try { const res = await appApi("/reports/queue", { method: "POST", body: { member_ids: sel, template_key: "REACTIVAR" } }); show(`Quedaron ${res.created} mensajes en la cola${res.skipped ? ` (${res.skipped} ya estaban)` : ""}`); setSel([]); } catch (e) { fail(e); }
  }
  return (
    <div className="cb-stack">
      <div className="cb-toolbar"><div className="cb-filters"><Seg value={score} onChange={setScore} options={[["0", `Todos (${d.total})`], ["3", `3 señales (${d.by_score["3"]})`], ["2", `2 señales (${d.by_score["2"]})`], ["1", `1 señal (${d.by_score["1"]})`]]} /></div>
        <div className="cb-filters">{d.queue_enabled && <button className="primary-button" disabled={!sel.length} onClick={queue}>Mandar mensaje a los elegidos ({sel.length})</button>}<Export path="/reports/at-risk" name="socios-en-riesgo.csv" /></div></div>
      {items.length === 0 ? <Empty title="Nadie está en riesgo ahora" /> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr>{d.queue_enabled && <th><input type="checkbox" aria-label="Elegir todos" checked={sel.length === items.length} onChange={(e) => setSel(e.target.checked ? items.map((i: any) => i.member_id) : [])} /></th>}<th>Persona</th><th>Por qué</th><th>Última visita</th><th>Vence</th><th /></tr></thead>
          <tbody>{items.map((i: any) => (
            <tr key={i.member_id}>
              {d.queue_enabled && <td><input type="checkbox" aria-label={`Elegir a ${i.name}`} checked={sel.includes(i.member_id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, i.member_id] : s.filter((x) => x !== i.member_id))} /></td>}
              <td><strong>{i.name}</strong><small>{i.plan_name || ""}</small></td>
              <td><Pill tone={i.score >= 3 ? "red" : i.score === 2 ? "orange" : "gray"}>{i.score} {i.score === 1 ? "señal" : "señales"}</Pill><small>{i.reasons.join(" · ")}</small></td>
              <td>{i.last_visit ? `${shortDate(i.last_visit)} (hace ${i.days_since} días)` : "Nunca vino"}</td><td>{i.expires_on ? shortDate(i.expires_on) : "—"}</td>
              <td className="num">{i.wa_url ? <a className="secondary-button" href={i.wa_url} target="_blank" rel="noreferrer">WhatsApp</a> : <span className="cb-muted">Sin teléfono</span>}</td></tr>))}</tbody></table></div>)}
      <Definition text={d.definition} />
      {node}
    </div>
  );
}

// ---------------------------------------------------------------- 3 · ingresos
function Income() {
  const r = useReport<any>("/reports/income", monthStart());
  const [grp, setGrp] = useState<"month" | "method" | "plan" | "mora">("month");
  const d = r.data;
  if (d && !d.available) return <Unavailable reason={d.reason} />;
  return (
    <div className="cb-stack">
      <div className="cb-toolbar"><DateRange from={r.from} to={r.to} onChange={r.setRange} /><Export path={`/reports/income?from=${r.from}&to=${r.to}&group=${grp}`} name={`ingresos-${grp}.csv`} /></div>
      {!d ? <Loading /> : (
        <>
          <div className="cb-kpis">
            <div className="cb-kpi"><span className="cb-muted">Cobrado en el período</span><strong className="c3-bignum">{money(d.collected)}</strong></div>
            <div className="cb-kpi"><span className="cb-muted">Esperado</span><strong className="c3-bignum">{money(d.expected)}</strong><small className="cb-muted">{d.collection_pct != null ? `Cobrado ${d.collection_pct} % de lo que vencía` : ""}</small></div>
            <div className="cb-kpi"><span className="cb-muted">Deuda vencida</span><strong className="c3-bignum">{money(d.mora_total)}</strong><small className="cb-muted">{d.mora_members} personas</small></div>
          </div>
          <Seg value={grp} onChange={setGrp} options={[["month", "Por mes"], ["method", "Por medio"], ["plan", "Por plan"], ["mora", "Mora"]]} />
          <div className="cb-card">
            {grp === "month" && <BarChart names={["Cobrado", "Esperado"]} data={d.by_month.map((m: any) => ({ label: m.label, value: m.paid, value2: m.expected }))} format={(v) => money(v)} />}
            {grp === "method" && <HBars rows={d.by_method.map((m: any) => ({ name: m.method, value: m.total }))} format={(v) => money(v)} />}
            {grp === "plan" && <HBars rows={d.by_plan.map((m: any) => ({ name: m.plan, value: m.total }))} format={(v) => money(v)} />}
            {grp === "mora" && (d.mora_total === 0 ? <p className="cb-muted">No hay deuda vencida.</p> : (
              <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Antigüedad de la deuda</th><th className="num">Cargos</th><th className="num">Personas</th><th className="num">Total</th></tr></thead>
                <tbody>{d.mora.map((b: any) => <tr key={b.label}><td>{b.label}</td><td className="num">{b.count}</td><td className="num">{b.members}</td><td className="num">{money(b.total)}</td></tr>)}</tbody></table></div>))}
          </div>
          <p className="c3-def">{d.note}</p>
        </>)}
      {r.node}
    </div>
  );
}

// ---------------------------------------------------------------- 4 · asistencia
function Attendance() {
  const r = useReport<any>("/reports/attendance", daysAgo(29));
  const d = r.data;
  if (d && !d.available) return <Unavailable reason={d.reason} />;
  return (
    <div className="cb-stack">
      <div className="cb-toolbar"><DateRange from={r.from} to={r.to} onChange={r.setRange} /><Export path={`/reports/attendance?from=${r.from}&to=${r.to}`} name="asistencia.csv" /></div>
      {!d ? <Loading /> : (
        <>
          {d.totals?.sessions !== undefined && <div className="cb-kpis">
            <div className="cb-kpi"><span className="cb-muted">Clases dadas</span><strong className="c3-bignum">{d.totals.sessions}</strong></div>
            <div className="cb-kpi"><span className="cb-muted">Ocupación</span><strong className="c3-bignum">{d.totals.occupancy_pct} %</strong><small className="cb-muted">Reservas sobre cupo</small></div>
            <div className="cb-kpi"><span className="cb-muted">Asistencias</span><strong className="c3-bignum">{d.totals.attended}</strong></div>
          </div>}
          {d.heatmap.length > 0 && <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Ocupación por día y hora (%)</h2><Heatmap unit=" %" cells={d.heatmap.map((h: any) => ({ weekday: h.weekday, hour: h.hour, value: h.pct }))} /></div>}
          {d.access_heatmap.length > 0 && <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Ingresos por día y hora</h2><Heatmap unit=" ingresos" cells={d.access_heatmap.map((h: any) => ({ weekday: h.weekday, hour: h.hour, value: h.count }))} /></div>}
          {d.classes.length > 0 && <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Clases más y menos llenas</h2>
            <HBars rows={[...d.classes].sort((a: any, b: any) => b.occupancy_pct - a.occupancy_pct).slice(0, 15).map((c: any) => ({ name: c.label, value: c.occupancy_pct }))} format={(v) => `${v} %`} /></div>}
          {d.low.length > 0 && <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Horarios casi vacíos</h2><ul className="cb-list">{d.low.map((c: any, i: number) => <li key={i} style={{ padding: "6px 0" }}>{c.label} <Pill tone="orange">{c.occupancy_pct} %</Pill></li>)}</ul></div>}
          {d.waitlist.length > 0 && <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Con lista de espera</h2><ul className="cb-list">{d.waitlist.map((c: any, i: number) => <li key={i} style={{ padding: "6px 0" }}>{c.label} <Pill tone="blue">{c.with_waitlist} {c.with_waitlist === 1 ? "clase" : "clases"}</Pill></li>)}</ul><p className="cb-muted">Si siempre hay espera, quizás convenga sumar otro horario.</p></div>}
          {!d.heatmap.length && !d.access_heatmap.length && <Empty title="Sin datos en este período" />}
        </>)}
      {r.node}
    </div>
  );
}

// ---------------------------------------------------------------- 5 · socios
function Members() {
  const { t } = useVocab();
  const r = useReport<any>("/reports/members", (() => { const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; })());
  const d = r.data;
  if (d && !d.available) return <Unavailable reason={d.reason} />;
  const rows = (x: any[]) => (x || []).map((i: any) => ({ name: i.name, value: i.count }));
  return (
    <div className="cb-stack">
      <div className="cb-toolbar"><DateRange from={r.from} to={r.to} onChange={r.setRange} /><Export path={`/reports/members?from=${r.from}&to=${r.to}`} name="altas-y-bajas.csv" /></div>
      {!d ? <Loading /> : (
        <>
          <div className="cb-kpis">
            <div className="cb-kpi"><span className="cb-muted">{t("members", true)} activos hoy</span><strong className="c3-bignum">{d.active_now}</strong></div>
            <div className="cb-kpi"><span className="cb-muted">Altas del período</span><strong className="c3-bignum">{d.altas_total}</strong></div>
            <div className="cb-kpi"><span className="cb-muted">Bajas del período</span><strong className="c3-bignum">{d.bajas_total}</strong></div>
          </div>
          <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Altas y bajas por mes</h2><BarChart names={["Altas", "Bajas"]} data={d.monthly.map((m: any) => ({ label: m.label, value: m.altas, value2: m.bajas }))} format={(v) => String(v)} /></div>
          <div className="c3-grid-cards">
            {([["Por plan", d.by_plan], ["Por actividad", d.by_activity], ["Por categoría", d.by_category], ["Por edad", d.by_age], ["Cómo nos conocieron", d.by_source]] as [string, any[]][]).map(([title, list]) => (
              <div className="cb-card" key={title}><h2 style={{ marginTop: 0, fontSize: 16 }}>{title}</h2><HBars rows={rows(list)} format={(v) => String(v)} /></div>))}
          </div>
        </>)}
      {r.node}
    </div>
  );
}

// ---------------------------------------------------------------- 6 · caja
function CashReport() {
  const r = useReport<any>("/reports/cash", monthStart());
  const d = r.data;
  if (d && !d.available) return <Unavailable reason={d.reason} />;
  return (
    <div className="cb-stack">
      <div className="cb-toolbar"><DateRange from={r.from} to={r.to} onChange={r.setRange} /><Export path={`/reports/cash?from=${r.from}&to=${r.to}`} name="caja.csv" /></div>
      {!d ? <Loading /> : (
        <>
          <div className="cb-kpis">
            <div className="cb-kpi"><span className="cb-muted">Cobrado en caja</span><strong className="c3-bignum">{money(d.collected)}</strong></div>
            <div className="cb-kpi"><span className="cb-muted">Ventas de productos</span><strong className="c3-bignum">{money(d.sales.total)}</strong><small className="cb-muted">{d.sales.count} ventas · {d.sales.voided} anuladas</small></div>
            <div className="cb-kpi"><span className="cb-muted">Gastos</span><strong className="c3-bignum">{money(d.expenses_total)}</strong></div>
            <div className="cb-kpi"><span className="cb-muted">Diferencias de arqueo</span><strong className="c3-bignum">{money(d.diff_total)}</strong><small className="cb-muted">{d.diff_count} cierres con diferencia</small></div>
          </div>
          <div className="c3-grid-cards">
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 16 }}>Más vendido</h2><HBars rows={d.products.slice(0, 10).map((p: any) => ({ name: `${p.name} (${p.qty})`, value: p.total }))} format={(v) => money(v)} /></div>
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 16 }}>Gastos por rubro</h2><HBars rows={d.expenses.map((p: any) => ({ name: p.category, value: p.total }))} format={(v) => money(v)} /></div>
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 16 }}>Por medio de pago</h2><HBars rows={d.by_method.map((p: any) => ({ name: p.method, value: p.total }))} format={(v) => money(v)} /></div>
            <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 16 }}>Por quién cobró</h2><HBars rows={d.by_user.map((p: any) => ({ name: p.user || "—", value: p.total }))} format={(v) => money(v)} /></div>
          </div>
          <div className="cb-card"><h2 style={{ marginTop: 0, fontSize: 17 }}>Turnos</h2>
            {d.turnos.length === 0 ? <p className="cb-muted">No hubo cajas en el período.</p> : (
              <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Responsable</th><th>Apertura</th><th className="num">Esperado</th><th className="num">Contado</th><th className="num">Diferencia</th></tr></thead>
                <tbody>{d.turnos.map((s: any) => <tr key={s.id}><td>{s.user}</td><td>{shortDate(s.opened_at)}</td><td className="num">{s.expected !== null ? money(s.expected) : "—"}</td><td className="num">{s.counted !== null ? money(s.counted) : "—"}</td>
                  <td className="num">{s.difference === null ? <Pill tone="orange">Abierta</Pill> : <Pill tone={s.difference === 0 ? "green" : "red"}>{money(s.difference)}</Pill>}</td></tr>)}</tbody></table></div>)}
          </div>
          {d.low_stock != null && <p className="c3-def">Productos con stock bajo ahora: {Array.isArray(d.low_stock) ? d.low_stock.length : d.low_stock}.</p>}
        </>)}
      {r.node}
    </div>
  );
}

// ---------------------------------------------------------------- 7 · instructores
function Instructors() {
  const { t } = useVocab();
  const r = useReport<any>("/reports/instructors", daysAgo(29));
  const d = r.data;
  if (d && !d.available) return <Unavailable reason={d.reason} />;
  return (
    <div className="cb-stack">
      <div className="cb-toolbar"><DateRange from={r.from} to={r.to} onChange={r.setRange} /><Export path={`/reports/instructors?from=${r.from}&to=${r.to}`} name="instructores.csv" /></div>
      {!d ? <Loading /> : d.items.length === 0 ? <Empty title="No hay datos para estas fechas" /> : (
        <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>{t("instructor", true)}</th><th className="num">Clases</th><th className="num">Reservas</th><th className="num">Asistentes</th><th className="num">Promedio</th><th className="num">Canceladas</th><th className="num">Suplencias</th>{d.commissions_enabled && <><th className="num">Comisión</th><th className="num">Sin liquidar</th></>}</tr></thead>
          <tbody>{d.items.map((i: any) => <tr key={i.instructor_id}><td><strong>{i.name}</strong></td><td className="num">{i.classes}</td><td className="num">{i.booked}</td><td className="num">{i.attended}</td><td className="num">{num(i.avg_attended, 1)}</td><td className="num">{i.cancelled}</td><td className="num">{i.substituted}</td>
            {d.commissions_enabled && <><td className="num">{money(i.commission)}</td><td className="num">{money(i.commission_pending)}</td></>}</tr>)}</tbody></table></div>)}
      {r.node}
    </div>
  );
}

export default Index;
