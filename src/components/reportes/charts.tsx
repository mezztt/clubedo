// Gráficos simples en SVG para los reportes (sin librerías). Los colores salen de los tokens, así que sirven en claro y oscuro.
import type { CSSProperties } from "react";
import { num } from "../c3/common";

export interface Point { label: string; value: number; value2?: number }

/** Barras verticales; con `value2` dibuja una segunda barra (por ejemplo «esperado» al lado de «cobrado»). */
export function BarChart({ data, height = 190, format = (v: number) => num(v), names }: { data: Point[]; height?: number; format?: (v: number) => string; names?: [string, string] }) {
  const W = 640, H = height, pad = { l: 8, r: 14, t: 20, b: 30 };
  const max = Math.max(...data.map((d) => Math.max(d.value, d.value2 || 0)), 1);
  const slot = (W - pad.l - pad.r) / Math.max(data.length, 1);
  const two = data.some((d) => d.value2 !== undefined);
  const bw = Math.min(two ? slot / 2.6 : slot * 0.6, 44);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const every = Math.ceil(data.length / 12);
  return (
    <div>
      <svg className="c3-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={names ? `${names[0]} y ${names[1]} por período` : "Gráfico de barras"}>
        <line className="c3-axis" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={i}>
              {two ? (
                <>
                  <rect className="c3-bar" x={cx - bw - 1} y={y(d.value)} width={bw} height={H - pad.b - y(d.value)} rx={4} />
                  <rect className="c3-bar-alt" x={cx + 1} y={y(d.value2 || 0)} width={bw} height={H - pad.b - y(d.value2 || 0)} rx={4} />
                </>
              ) : <rect className="c3-bar" x={cx - bw / 2} y={y(d.value)} width={bw} height={Math.max(H - pad.b - y(d.value), 1)} rx={4} />}
              {data.length <= 12 && !two && <text className="c3-val" x={cx} y={y(d.value) - 5} textAnchor="middle">{format(d.value)}</text>}
              {i % every === 0 && <text x={cx} y={H - 10} textAnchor="middle">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {names && <div className="cb-legend"><span><i className="cb-dot" style={{ background: "var(--cb-brand-c)" }} /> {names[0]}</span><span><i className="cb-dot" style={{ background: "var(--cb-accent)" }} /> {names[1]}</span></div>}
    </div>
  );
}

/** Línea de porcentajes (deserción, retención, ocupación...). */
export function LineChart({ data, height = 180, suffix = "%", name }: { data: Point[]; height?: number; suffix?: string; name: string }) {
  const W = 640, H = height, pad = { l: 34, r: 26, t: 16, b: 28 };
  const max = Math.max(...data.map((d) => d.value), 5);
  const ceil = Math.ceil(max / 5) * 5;
  const x = (i: number) => pad.l + (data.length <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v: number) => H - pad.b - (v / ceil) * (H - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const every = Math.ceil(data.length / 12);
  return (
    <svg className="c3-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={name}>
      {[0, 0.5, 1].map((f) => <g key={f}><line className="c3-axis" x1={pad.l} x2={W - pad.r} y1={y(ceil * f)} y2={y(ceil * f)} /><text x={pad.l - 6} y={y(ceil * f) + 4} textAnchor="end">{Math.round(ceil * f)}{suffix}</text></g>)}
      <path className="c3-line" d={path} />
      {data.map((d, i) => (
        <g key={i}>
          <circle className="c3-dot" cx={x(i)} cy={y(d.value)} r={3.5} />
          {data.length <= 12 && <text className="c3-val" x={x(i)} y={y(d.value) - 8} textAnchor="middle">{d.value}{suffix}</text>}
          {i % every === 0 && <text x={x(i)} y={H - 8} textAnchor="middle">{d.label}</text>}
        </g>
      ))}
    </svg>
  );
}

/** Barras horizontales con nombre, barra y valor. */
export function HBars({ rows, format = (v: number) => num(v), empty = "Sin datos en este período" }: { rows: { name: string; value: number }[]; format?: (v: number) => string; empty?: string }) {
  if (!rows.length) return <p className="cb-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return <div>{rows.map((r) => (
    <div className="c3-hbar" key={r.name}><span>{r.name}</span><div className="cb-meter"><div className="c3-hbar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></div><strong>{format(r.value)}</strong></div>
  ))}</div>;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Mapa de calor día de la semana x hora. `cells` trae el valor ya calculado (porcentaje o cantidad). */
export function Heatmap({ cells, unit, hours }: { cells: { weekday: number; hour: number; value: number }[]; unit: string; hours?: number[] }) {
  if (!cells.length) return <p className="cb-muted">Sin datos en este período</p>;
  const hs = hours || Array.from(new Set(cells.map((c) => c.hour))).sort((a, b) => a - b);
  const max = Math.max(...cells.map((c) => c.value), 1);
  const get = (d: number, h: number) => cells.find((c) => c.weekday === d && c.hour === h);
  const level = (v: number) => (v <= 0 ? "" : v / max > 0.66 ? "l3" : v / max > 0.33 ? "l2" : "l1");
  return (
    <div className="c3-heat" style={{ ["--cols" as string]: hs.length } as CSSProperties} role="table" aria-label={`Mapa de calor (${unit})`}>
      <div className="c3-heat-row"><span />{hs.map((h) => <span key={h}>{h}h</span>)}</div>
      {DAYS.map((d, di) => (
        <div className="c3-heat-row" key={d}><b>{d}</b>{hs.map((h) => { const c = get(di, h); return <div key={h} className={`c3-heat-cell ${c ? level(c.value) : ""}`} title={c ? `${d} ${h}h: ${c.value}${unit}` : "Sin clases"}>{c ? Math.round(c.value) : ""}</div>; })}</div>
      ))}
    </div>
  );
}
