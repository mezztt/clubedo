import { shortDate } from "../../config";

/** Gráfico de línea simple en SVG. Usa los colores de las variables del tema (se ve igual en claro y oscuro). */
export default function LineChart({ title, unit, points }: { title: string; unit?: string | null; points: { date: string; value: number }[] }) {
  const W = 520, H = 170, PX = 40, PY = 20;
  if (points.length === 0) return null;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const x = (i: number) => (points.length === 1 ? W / 2 : PX + (i * (W - PX - 10)) / (points.length - 1));
  const y = (v: number) => H - PY - ((v - lo) / (hi - lo)) * (H - PY * 2);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  return (
    <div className="c2-chart-wrap">
      <h3>{title}{unit ? ` (${unit})` : ""}</h3>
      <svg className="c2-sparkline" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: último valor ${fmt(last.value)}${unit ? " " + unit : ""}`}>
        <g className="c2-chart-axis">
          {[0, 0.5, 1].map((f) => { const v = lo + (hi - lo) * f; return <g key={f}><line className="c2-chart-grid" x1={PX} x2={W - 6} y1={y(v)} y2={y(v)} /><text x={PX - 4} y={y(v) + 3} textAnchor="end">{fmt(v)}</text></g>; })}
          <text x={PX} y={H - 2} textAnchor="start">{shortDate(points[0].date)}</text>
          {points.length > 1 && <text x={W - 6} y={H - 2} textAnchor="end">{shortDate(last.date)}</text>}
        </g>
        {points.length > 1 && <path className="c2-chart-line" d={path} />}
        {points.map((p, i) => <circle key={i} className="c2-chart-dot" cx={x(i)} cy={y(p.value)} r={3.2}><title>{`${shortDate(p.date)}: ${fmt(p.value)}`}</title></circle>)}
      </svg>
      <small className="cb-muted">Último: <strong>{fmt(last.value)}{unit ? " " + unit : ""}</strong> el {shortDate(last.date)}</small>
    </div>
  );
}
