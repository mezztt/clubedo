import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { appApi, appUpload, downloadFile, shortDate, useVocab } from "../../../config";
import { Empty, PageHeader, Pill, Switch, useFlash } from "../../../components/ui";

interface PRow { row: number; status: "OK" | "DUPLICADO" | "ERROR"; errors: string[]; warnings: string[]; existing: { id: number; name: string } | null;
  data: { first_name: string; last_name: string; dni: string; birth_date: string | null; plan_name: string | null; vence: string | null; phone: string | null } }
interface Preview { rows: PRow[]; summary: { total: number; ok: number; duplicates: number; errors: number; with_warnings: number }; missing_plans: { name: string; rows: number }[] }
interface Result { created: number; updated: number; skipped: number; plans_created: string[]; problems: { row: number; message: string }[] }
const TONE = { OK: "green", DUPLICADO: "orange", ERROR: "red" } as const;

/** Importar desde Excel/CSV en dos pasos: vista previa con errores por fila y recién después se guarda. */
export default function Importar() {
  const { t } = useVocab();
  const navigate = useNavigate();
  const { fail, node: flash } = useFlash();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [onDup, setOnDup] = useState<"OMITIR" | "ACTUALIZAR">("OMITIR");
  const [createPlans, setCreatePlans] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const analyze = async (file?: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file); else form.append("text", text);
      setPreview(await appUpload<Preview>("/members/import", form));
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const rows = preview.rows.filter((r) => r.status !== "ERROR").map((r) => ({ ...r.data, row: r.row }));
      setResult(await appApi<Result>("/members/import/commit", { method: "POST", body: { rows, on_duplicate: onDup, create_plans: createPlans } }));
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return (
    <section className="products-page">
      <PageHeader eyebrow="PERSONAS" title={`Importar ${t("members")}`} subtitle="Subí tu planilla en CSV. Primero ves cómo quedaría y recién después se guarda.">
        <Link className="secondary-button" to="/app/socios">Volver</Link>
      </PageHeader>

      {result ? (
        <div className="cb-stack">
          <div className="cb-kpis">
            <div className="cb-kpi"><span>Creados</span><strong>{result.created}</strong></div>
            <div className="cb-kpi"><span>Actualizados</span><strong>{result.updated}</strong></div>
            <div className="cb-kpi"><span>Omitidos</span><strong>{result.skipped}</strong></div>
          </div>
          {result.plans_created.length > 0 && <div className="cb-note cb-note-info">Planes nuevos creados con precio $0: {result.plans_created.join(", ")}. Cargales el precio en Membresías → Planes.</div>}
          {result.problems.length > 0 && <div className="cb-note cb-note-warn"><strong>No se pudieron cargar:</strong><ul>{result.problems.map((p) => <li key={p.row}>Fila {p.row}: {p.message}</li>)}</ul></div>}
          <div className="cb-note cb-note-info">Quedó pendiente registrar el consentimiento de cada persona (Ley 25.326). Lo ves en Pendientes.</div>
          <div><button className="primary-button" onClick={() => navigate("/app/socios")}>Ver {t("members")}</button></div>
        </div>
      ) : !preview ? (
        <div className="cb-stack">
          <div className="cb-card">
            <div className="cb-card-head"><h3>1. Elegí el archivo</h3></div>
            <p className="cb-muted">Columnas: nombre, apellido y DNI son obligatorias; también podés traer fecha de nacimiento, teléfono, email, plan, vencimiento y apto.</p>
            <div className="cb-row" style={{ flexWrap: "wrap" }}>
              <label className="primary-button" style={{ cursor: "pointer" }}>Elegir archivo .csv
                <input type="file" accept=".csv,.txt,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = ""; }} /></label>
              <button className="secondary-button" onClick={() => downloadFile("/members/import/template", "plantilla-importar-socios.csv").catch(fail)}>Descargar la plantilla</button>
            </div>
            <p className="cb-muted" style={{ marginTop: 10 }}>Si tu planilla es de Excel, guardala como «CSV» y subila. O pegá las filas acá abajo (con los títulos).</p>
            <textarea rows={5} value={text} placeholder={"nombre;apellido;dni\nLucía;Gómez;30123456"} onChange={(e) => setText(e.target.value)} style={{ width: "100%" }} aria-label="Pegar datos" />
            <div style={{ marginTop: 8 }}><button className="secondary-button" disabled={busy || !text.trim()} onClick={() => analyze()}>{busy ? "Leyendo..." : "Ver vista previa"}</button></div>
          </div>
        </div>
      ) : (
        <div className="cb-stack">
          <div className="cb-kpis">
            <div className="cb-kpi"><span>Filas</span><strong>{preview.summary.total}</strong></div>
            <div className="cb-kpi"><span>Listas para crear</span><strong>{preview.summary.ok}</strong></div>
            <div className="cb-kpi"><span>Ya existen</span><strong>{preview.summary.duplicates}</strong></div>
            <div className="cb-kpi"><span>Con error</span><strong>{preview.summary.errors}</strong></div>
          </div>
          {preview.summary.duplicates > 0 && (
            <div className="cb-card"><div className="cb-card-head"><h3>¿Qué hacemos con los DNI que ya existen?</h3></div>
              <div className="cb-inline-checks">
                <label><input type="radio" name="dup" checked={onDup === "OMITIR"} onChange={() => setOnDup("OMITIR")} /> Dejarlos como están</label>
                <label><input type="radio" name="dup" checked={onDup === "ACTUALIZAR"} onChange={() => setOnDup("ACTUALIZAR")} /> Completar sus datos con los de la planilla</label>
              </div></div>
          )}
          {preview.missing_plans.length > 0 && (
            <Switch on={createPlans} onChange={setCreatePlans} label={`Crear los planes que no existen (${preview.missing_plans.map((p) => p.name).join(", ")})`} hint="Se crean con precio $0 para que lo completes. Si no, esas personas se cargan sin plan." />
          )}
          {preview.rows.length === 0 ? <Empty title="No hay filas" /> : (
            <div className="cb-table-wrap"><table className="cb-table">
              <thead><tr><th>Fila</th><th>Persona</th><th>Plan / vence</th><th>Resultado</th></tr></thead>
              <tbody>{preview.rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td><strong>{r.data.last_name}, {r.data.first_name}</strong><small>DNI {r.data.dni}</small></td>
                  <td>{r.data.plan_name || "—"}{r.data.vence ? <small>vence {shortDate(r.data.vence)}</small> : null}</td>
                  <td><Pill tone={TONE[r.status]}>{r.status === "OK" ? "Se crea" : r.status === "DUPLICADO" ? `Ya existe (${r.existing?.name})` : "Error"}</Pill>
                    {[...r.errors, ...r.warnings].map((m, i) => <small key={i}>{m}</small>)}</td>
                </tr>))}</tbody></table></div>
          )}
          <div className="cb-row" style={{ flexWrap: "wrap" }}>
            <button className="secondary-button" onClick={() => setPreview(null)}>Elegir otro archivo</button>
            <button className="primary-button" disabled={busy || preview.summary.ok + (onDup === "ACTUALIZAR" ? preview.summary.duplicates : 0) === 0} onClick={commit}>
              {busy ? "Guardando..." : `Importar ${preview.summary.ok}${onDup === "ACTUALIZAR" && preview.summary.duplicates ? ` + actualizar ${preview.summary.duplicates}` : ""}`}</button>
          </div>
        </div>
      )}
      {flash}
    </section>
  );
}

