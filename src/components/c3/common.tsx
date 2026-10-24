// Piezas compartidas por las pantallas del grupo c3 (caja, reportes, avisos, eventos, webs)
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PAYMENT_LABELS, PAYMENT_METHODS, appApi, getSessionUser } from "../../config";
import { Tabs } from "../ui";
import "../../c3.css";

/** Subpantalla activa según el último tramo de la URL: /app/caja/gastos -> "gastos" */
export function useSub(base: string, fallback: string): [string, (sub: string) => void] {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+|\/+$/g, "") : "";
  const sub = rest.split("/")[0] || fallback;
  return [sub, (s: string) => nav(s === fallback ? base : `${base}/${s}`)];
}

/** Segundo tramo de la URL (por ejemplo el id de un evento): /app/eventos/detalle/5 -> "5" */
export function useSubId(base: string): string {
  const { pathname } = useLocation();
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+|\/+$/g, "") : "";
  return rest.split("/")[1] || "";
}

export function SubTabs({ base, fallback, options }: { base: string; fallback: string; options: [string, ReactNode][] }) {
  const [sub, go] = useSub(base, fallback);
  return <Tabs value={sub} options={options} onChange={go} />;
}

export function isManager(): boolean {
  const u = getSessionUser();
  return u?.role === "ADMINISTRADOR" || u?.role === "ENCARGADO";
}

export interface MemberHit { id: number; full_name: string; dni: string; phone?: string | null; state?: string; state_label?: string; plan_name?: string | null }

/** Buscador de personas (por nombre, apellido o DNI) */
export function MemberPicker({ value, onPick, placeholder = "Buscar por nombre o DNI" }: {
  value: MemberHit | null; onPick: (m: MemberHit | null) => void; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    let alive = true;
    const h = window.setTimeout(() => {
      appApi<{ items: MemberHit[] }>(`/members?q=${encodeURIComponent(q.trim())}&limit=8`)
        .then((r) => { if (alive) { setHits(r.items); setOpen(true); } }).catch(() => undefined);
    }, 250);
    return () => { alive = false; window.clearTimeout(h); };
  }, [q]);
  if (value) {
    return (
      <div className="c3-picked">
        <span><strong>{value.full_name}</strong><small>DNI {value.dni}</small></span>
        <button type="button" className="cb-link" onClick={() => { onPick(null); setQ(""); }}>Cambiar</button>
      </div>
    );
  }
  return (
    <div className="c3-pick">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} onFocus={() => hits.length && setOpen(true)} aria-label={placeholder} />
      {open && hits.length > 0 && (
        <ul className="c3-pick-list">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => { onPick(h); setOpen(false); setQ(""); }}>
                <strong>{h.full_name}</strong><small>DNI {h.dni}{h.plan_name ? ` · ${h.plan_name}` : ""}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lleva un número de pesos a texto con coma: 1234.5 -> "1.234,50" (para tablas y CSV) */
export function num(v: number | null | undefined, decimals = 0): string {
  return Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function monthStart(): string { return today().slice(0, 8) + "01"; }
export function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="cb-row">
      <label className="c3-inline">Desde <input type="date" value={from} max={to} onChange={(e) => onChange(e.target.value, to)} /></label>
      <label className="c3-inline">Hasta <input type="date" value={to} min={from} onChange={(e) => onChange(from, e.target.value)} /></label>
    </div>
  );
}

// Una sola fuente de verdad: PAYMENT_METHODS / PAYMENT_LABELS de config.ts (mismos valores que el backend)
export const METHODS: [string, string][] = PAYMENT_METHODS.map((m) => [m, PAYMENT_LABELS[m]]);
export const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHODS);
