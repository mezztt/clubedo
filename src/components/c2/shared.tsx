// Piezas compartidas por los módulos acceso, clases, instructores, entrenamiento y salud
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { appApi } from "../../config";
import { Pill } from "../ui";

/** Estado del apto -> color y texto (siempre con texto: el color no es lo único que informa) */
export const APTO_TONE: Record<string, string> = { VIGENTE: "green", POR_VENCER: "orange", VENCIDO: "red", SIN_APTO: "gray" };
export const APTO_TEXT: Record<string, string> = { VIGENTE: "Vigente", POR_VENCER: "Por vencer", VENCIDO: "Vencido", SIN_APTO: "Sin apto" };
export function AptoPill({ state }: { state: string }) {
  return <Pill tone={APTO_TONE[state] || "gray"}>{APTO_TEXT[state] || state}</Pill>;
}

export const FEE_TONE: Record<string, string> = { AL_DIA: "green", POR_VENCER: "orange", EN_GRACIA: "orange", VENCIDA: "red", MOROSO: "red", SIN_PLAN: "gray", CONGELADA: "blue" };

export function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export interface PickedMember { id: number; name: string; dni?: string }

/** Buscador de personas por nombre o DNI. `endpoint` arma la URL; `map` convierte cada fila. */
export function MemberPicker({ endpoint, map, onPick, placeholder = "Buscá por nombre o DNI", autoFocus }: {
  endpoint: (q: string) => string; map: (row: any) => PickedMember; onPick: (m: PickedMember) => void; placeholder?: string; autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PickedMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const seq = useRef<number>(0);
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); setErr(""); return; }
    const my = (seq.current = (seq.current ?? 0) + 1);
    setBusy(true);
    const h = window.setTimeout(() => {
      appApi<any>(endpoint(q.trim())).then((r) => {
        if (my !== seq.current) return;
        const list = Array.isArray(r) ? r : (r.items || []);
        setRows(list.map(map)); setErr("");
      }).catch((e) => { if (my === seq.current) setErr(e instanceof Error ? e.message : "No se pudo buscar"); })
        .finally(() => { if (my === seq.current) setBusy(false); });
    }, 250);
    return () => window.clearTimeout(h);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="c2-picker">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} />
      {err && <div className="cb-note cb-note-error">{err}</div>}
      {q.trim().length >= 2 && !busy && !err && rows.length === 0 && <div className="cb-muted c2-picker-empty">No encontramos a nadie con ese dato.</div>}
      {rows.length > 0 && (
        <ul className="c2-picker-list">
          {rows.map((r) => (
            <li key={r.id}><button type="button" onClick={() => { onPick(r); setQ(""); setRows([]); }}>
              <strong>{r.name}</strong>{r.dni && <small>DNI {r.dni}</small>}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Hoja imprimible dentro de la página: un overlay que, al imprimir, es lo único visible (no usa rutas nuevas). */
export function PrintOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add("c2-printing");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("c2-printing"); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className="c2-print-overlay" role="dialog" aria-label={title}>
      <div className="cb-print-toolbar no-print">
        <button className="secondary-button" onClick={onClose}>Volver</button>
        <button className="primary-button" onClick={() => window.print()}>Imprimir</button>
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return <div className={`cb-kpi c2-stat ${tone ? "is-" + tone : ""}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}

/** Lee ?tab= y lo mantiene sincronizado sin depender del router (sirve en el preview) */
export function useTab<T extends string>(valid: T[], initial: T): [T, (t: T) => void] {
  const read = () => { const p = new URLSearchParams(window.location.search).get("tab") as T | null; return p && valid.includes(p) ? p : initial; };
  const [tab, setTab] = useState<T>(read);
  const set = (t: T) => {
    setTab(t);
    try { const u = new URL(window.location.href); u.searchParams.set("tab", t); window.history.replaceState(null, "", u.toString()); } catch { /* sin historial */ }
  };
  return [tab, set];
}

export function errText(e: unknown): string { return e instanceof Error ? e.message : "Ocurrió un error"; }
