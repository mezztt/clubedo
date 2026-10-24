import { useMemo, useState } from "react";
import { appApi } from "../config";
import { Modal } from "./ui";

/** Campo al que se puede mandar una columna del Excel */
export interface ImportField { key: string; label: string; synonyms: string[] }
interface ImportResult { created: number; updated: number; skipped: number; errors: { row: number; message: string }[]; total: number }

const MAX_ROWS = 5000;
const FILLER = new Set(["de", "del", "la", "el", "nro", "n", "no", "num", "numero"]);

/** minúsculas, sin acentos ni signos: "N° de Afiliado" → "n de afiliado" */
function norm(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
/** además saca palabras de relleno: "n de afiliado" → "afiliado" */
function compact(text: string): string {
  const words = norm(text).split(" ").filter((w) => w && !FILLER.has(w));
  return words.join(" ");
}

function detectSeparator(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  if (first.includes("\t")) return "\t";
  const semi = (first.match(/;/g) || []).length;
  const comma = (first.match(/,/g) || []).length;
  return semi >= comma && semi > 0 ? ";" : comma > 0 ? "," : "\t";
}

/** CSV / texto pegado de Excel → filas de celdas (respeta comillas) */
function parseTable(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

function matchField(header: string, fields: ImportField[]): string {
  const a = norm(header);
  const b = compact(header);
  if (!a) return "";
  const hit = fields.find((f) => f.synonyms.some((s) => norm(s) === a)) || fields.find((f) => f.synonyms.some((s) => compact(s) === b && b !== ""));
  return hit ? hit.key : "";
}

/** "Juan Carlos Gómez" → apellido = última palabra; con coma se toma "Apellido, Nombre" */
function splitNameFirst(value: string): { last_name: string; first_name: string } {
  const t = value.trim().replace(/\s+/g, " ");
  if (t.includes(",")) {
    const [last, ...rest] = t.split(",");
    return { last_name: last.trim(), first_name: rest.join(",").trim() };
  }
  const parts = t.split(" ");
  if (parts.length < 2) return { last_name: t, first_name: "" };
  return { last_name: parts[parts.length - 1], first_name: parts.slice(0, -1).join(" ") };
}

async function readFile(file: File): Promise<string> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer); // CSV guardado desde Excel
  }
}

/**
 * Importar desde Excel: se pega lo copiado (o se elige un .csv), se revisa a qué campo va
 * cada columna y el servidor crea / actualiza. Se usa para importar socios.
 */
export default function ImportModal({ title, what, fields, endpoint, matchHint, onClose, onDone }: {
  title: string; what: string; fields: ImportField[]; endpoint: string; matchHint: string;
  onClose: () => void; onDone: (summary: string) => void;
}) {
  const [text, setText] = useState("");
  const [table, setTable] = useState<string[][] | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function analyze(source: string) {
    setError("");
    const rows = parseTable(source, detectSeparator(source));
    if (rows.length === 0) { setError("No encontramos datos. Copiá las celdas desde Excel (con los títulos de las columnas) y pegalas acá."); return; }
    const cols = Math.max(...rows.map((r) => r.length));
    const guess = Array.from({ length: cols }, (_, i) => matchField(rows[0][i] || "", fields));
    const header = guess.some((g) => g !== "");
    // cada campo se usa una sola vez (la primera columna que coincide)
    const seen = new Set<string>();
    const map = guess.map((g) => { if (!g || seen.has(g)) return ""; seen.add(g); return g; });
    setHasHeader(header);
    setMapping(header ? map : Array.from({ length: cols }, () => ""));
    setTable(rows);
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setError("Ese archivo es de Excel (.xlsx). Abrilo, seleccioná las celdas, copiá y pegá acá; o guardalo como CSV.");
      return;
    }
    try {
      const content = await readFile(file);
      setText(content);
      analyze(content);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el archivo"); }
  }

  const dataRows = useMemo(() => (table ? (hasHeader ? table.slice(1) : table) : []), [table, hasHeader]);
  const used = mapping.filter(Boolean);
  const hasName = used.includes("full_name") || used.includes("name_full") || used.includes("last_name");
  const problem = !table ? "" : dataRows.length === 0 ? "Solo está la fila de títulos: no hay datos para importar."
    : dataRows.length > MAX_ROWS ? `Son ${dataRows.length} filas: importá de a ${MAX_ROWS} como máximo.`
    : !hasName ? "Indicá qué columna tiene el apellido y el nombre." : "";

  function setColumn(index: number, key: string) {
    // un campo no puede estar en dos columnas: se saca de la anterior
    setMapping(mapping.map((m, i) => (i === index ? key : key && m === key ? "" : m)));
  }

  async function doImport() {
    setError("");
    setSaving(true);
    try {
      const rows = dataRows.map((r) => {
        const obj: Record<string, string> = {};
        mapping.forEach((key, i) => {
          const value = (r[i] || "").trim();
          if (!key || !value) return;
          if (key === "name_full") Object.assign(obj, splitNameFirst(value));
          else obj[key] = value;
        });
        return obj;
      });
      setResult(await appApi<ImportResult>(endpoint, { method: "POST", body: { rows } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setSaving(false);
    }
  }

  // ---------- 3) resultado ----------
  if (result) {
    const summary = `${result.created} ${what} nuevos, ${result.updated} actualizados`;
    return (
      <Modal eyebrow="IMPORTAR DESDE EXCEL" title="Importación terminada" onClose={() => onDone(summary)} size="wide"
        footer={<button className="primary-button" onClick={() => onDone(summary)}>Listo</button>}>
        <div className="product-form">
          <div className="cb-kpis" style={{ marginBottom: 0 }}>
            <div className="cb-kpi"><span>Nuevos</span><strong>{result.created}</strong><small>se crearon</small></div>
            <div className="cb-kpi"><span>Actualizados</span><strong>{result.updated}</strong><small>ya existían</small></div>
            <div className="cb-kpi"><span>Salteados</span><strong>{result.skipped}</strong><small>sin cambios o repetidos</small></div>
            <div className={`cb-kpi ${result.errors.length ? "is-warn" : ""}`}><span>Con avisos</span><strong>{result.errors.length}</strong><small>filas para revisar</small></div>
          </div>
          {result.errors.length > 0 && (
            <div className="cb-table-wrap">
              <table className="cb-table">
                <thead><tr><th>Fila</th><th>Qué pasó</th></tr></thead>
                <tbody>{result.errors.map((e, i) => <tr key={i}><td>{e.row + (hasHeader ? 1 : 0)}</td><td>{e.message}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {result.errors.length > 0 && <small className="cb-hint">El número de fila es el de tu planilla{hasHeader ? " (contando los títulos)" : ""}. Se muestran hasta 50 avisos.</small>}
        </div>
      </Modal>
    );
  }

  // ---------- 2) vista previa y mapeo ----------
  if (table) {
    const cols = mapping.length;
    const head = hasHeader ? table[0] : [];
    return (
      <Modal eyebrow="IMPORTAR DESDE EXCEL" title="Revisá las columnas" onClose={onClose} size="xl"
        footer={<>
          <button className="secondary-button" onClick={() => { setTable(null); setError(""); }}>‹ Volver</button>
          <button className="primary-button" onClick={doImport} disabled={saving || !!problem}>{saving ? "Importando..." : `Importar ${dataRows.length} ${what}`}</button>
        </>}>
        <div className="product-form">
          <p className="cb-muted" style={{ marginTop: 0 }}>
            Arriba de cada columna elegí a qué dato corresponde. Las que queden en “No importar” se ignoran. {matchHint}
          </p>
          <div className="cb-inline-checks">
            <label><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> La primera fila tiene los títulos de las columnas</label>
          </div>
          <div className="cb-table-wrap cb-import-preview">
            <table className="cb-table">
              <thead>
                <tr>
                  {Array.from({ length: cols }, (_, i) => (
                    <th key={i}>
                      <select className="cb-select" value={mapping[i]} onChange={(e) => setColumn(i, e.target.value)} aria-label={`Dato de la columna ${i + 1}`}>
                        <option value="">No importar</option>
                        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                      <small>{head[i] || `Columna ${i + 1}`}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, 8).map((r, n) => (
                  <tr key={n}>{Array.from({ length: cols }, (_, i) => <td key={i} className={mapping[i] ? "" : "is-off"}>{r[i] || ""}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="cb-hint">Vista previa de las primeras {Math.min(8, dataRows.length)} filas de {dataRows.length}.</small>
          {problem && <div className="cb-note cb-note-warn">{problem}</div>}
          {error && <div className="cb-note cb-note-error">{error}</div>}
        </div>
      </Modal>
    );
  }

  // ---------- 1) pegar o elegir archivo ----------
  return (
    <Modal eyebrow="IMPORTAR DESDE EXCEL" title={title} onClose={onClose} size="wide"
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={() => analyze(text)} disabled={!text.trim()}>Ver vista previa</button>
      </>}>
      <div className="product-form">
        <p className="cb-muted" style={{ marginTop: 0 }}>
          En Excel seleccioná las celdas <strong>con los títulos de las columnas</strong>, copiá (Ctrl + C) y pegá acá (Ctrl + V).
          También podés elegir un archivo .csv.
        </p>
        <div className="form-group">
          <label>Datos copiados de Excel</label>
          <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Apellido\tNombre\tDNI\t…\nGómez\tJuan\t30123456\t…"}
            style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12, whiteSpace: "pre" }} autoFocus />
        </div>
        <div className="form-group">
          <label>O elegí un archivo .csv</label>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
        <small className="cb-hint">Columnas que reconoce: {fields.map((f) => f.label).join(", ")}.</small>
        {error && <div className="cb-note cb-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

/** Columnas que reconoce la importación de socios (el módulo «socios» define el endpoint que las recibe) */
export const MEMBER_IMPORT_FIELDS: ImportField[] = [
  { key: "last_name", label: "Apellido", synonyms: ["apellido", "apellidos"] },
  { key: "first_name", label: "Nombre", synonyms: ["nombre", "nombres"] },
  { key: "full_name", label: "Apellido y nombre (juntos)", synonyms: ["apellido y nombre", "apellido y nombres", "apellidos y nombres", "apellido nombre", "socio", "alumno", "nombre completo", "socios", "alumnos"] },
  { key: "name_full", label: "Nombre y apellido (juntos)", synonyms: ["nombre y apellido", "nombres y apellidos", "nombre apellido"] },
  { key: "dni", label: "DNI", synonyms: ["dni", "documento", "doc", "nro documento", "numero de documento", "nro doc", "d n i"] },
  { key: "birth_date", label: "Fecha de nacimiento", synonyms: ["fecha de nacimiento", "nacimiento", "fecha nacimiento", "fecha nac", "fec nac", "f nac", "fnac", "f nacimiento"] },
  { key: "phone", label: "Teléfono", synonyms: ["telefono", "celular", "tel", "movil", "whatsapp", "telefono celular", "cel", "telefonos", "tel celular"] },
  { key: "email", label: "Email", synonyms: ["email", "mail", "e mail", "correo", "correo electronico"] },
  { key: "address", label: "Domicilio", synonyms: ["domicilio", "direccion", "calle", "dir"] },
  { key: "city", label: "Localidad", synonyms: ["localidad", "ciudad"] },
  { key: "plan", label: "Plan o cuota", synonyms: ["plan", "cuota", "abono", "membresia", "categoria", "plan actual"] },
  { key: "emergency_contact", label: "Contacto de emergencia", synonyms: ["emergencia", "contacto de emergencia", "contacto emergencia", "en caso de emergencia"] },
];
