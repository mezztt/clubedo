import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminBajas } from "../../components/ServiceCancel";
import { adminApi, money, shortDate, ALL_MODULES, MODULE_LABELS, RUBRO_SHORT } from "../../config";
import type { Rubro } from "../../config";

interface Overview {
  by_rubro: Record<string, number>;
  total_systems: number;
  active_systems: number;
  inactive_systems: number;
  overdue_systems: number;
  monthly_recurring: number;
  collected_this_month: number;
  months: { period: string; total: number }[];
  module_usage: Record<string, number>;
  upcoming_due: {
    id: number; name: string; payment_due_date: string;
    payment_status: string; client_price: number; overdue: boolean;
  }[];
  recent_payments: {
    id: number; company_name: string; amount: number; payment_date: string; method: string | null;
  }[];
  recent_systems: { id: number; name: string; rubro: string; city: string | null; created_at: string }[];
}

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function AdminHome() {
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi<Overview>("/admin/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <section className="products-page">
        <div className="products-empty"><h3>No se pudo cargar el resumen</h3><p>{error}</p></div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="products-page">
        <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
      </section>
    );
  }

  const rubroSummary = Object.entries(data.by_rubro || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${RUBRO_SHORT[k as Rubro] || k}`).join(" · ");
  const maxMonth = Math.max(1, ...data.months.map((m) => m.total));
  const collectedPct = data.monthly_recurring > 0
    ? Math.min(100, Math.round((data.collected_this_month / data.monthly_recurring) * 100))
    : 0;

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT · CLUBEDO</span>
          <h1>Inicio</h1>
          <p>Cómo vienen tus gimnasios, clubes y cobros.</p>
        </div>
        <div className="products-header-actions">
          <button className="primary-button" onClick={() => navigate("/admin/sistemas?nuevo=1")}>+ Nuevo sistema</button>
        </div>
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <span>Sistemas activos</span>
          <strong>{data.active_systems}</strong>
          <small>{rubroSummary || "Todavía no hay sistemas"}{data.inactive_systems ? ` · ${data.inactive_systems} de baja` : ""}</small>
        </div>
        <div className="dashboard-card">
          <span>Ingreso mensual esperado</span>
          <strong>{money(data.monthly_recurring)}</strong>
          <small>Suma de abonos de sistemas activos</small>
        </div>
        <div className="dashboard-card">
          <span>Cobrado este mes</span>
          <strong>{money(data.collected_this_month)}</strong>
          <div className="cb-progress" title={`${collectedPct}% del esperado`}>
            <div style={{ width: `${collectedPct}%` }} />
          </div>
          <small>{collectedPct}% del esperado</small>
        </div>
        <div className={`dashboard-card ${data.overdue_systems > 0 ? "cb-card-warn" : ""}`}>
          <span>Pagos atrasados</span>
          <strong>{data.overdue_systems}</strong>
          <small>Más de 10 días después del vencimiento</small>
        </div>
      </div>

      <AdminBajas />

      <div className="cb-grid-2">
        <div className="dashboard-section">
          <div className="section-heading"><h2>Cobrado por mes</h2><p>Últimos 6 meses</p></div>
          <div className="cb-bars">
            {data.months.map((m) => {
              const [, mm] = m.period.split("-");
              return (
                <div key={m.period} className="cb-bar-col" title={`${m.period}: ${money(m.total)}`}>
                  <span className="cb-bar-value">{m.total > 0 ? money(m.total) : ""}</span>
                  <div className="cb-bar-track">
                    <div className="cb-bar" style={{ height: `${(m.total / maxMonth) * 100}%` }} />
                  </div>
                  <span className="cb-bar-label">{MONTHS_ES[Number(mm) - 1]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-heading"><h2>Próximos vencimientos</h2><p>Vencidos y próximos 15 días</p></div>
          {data.upcoming_due.length === 0 ? (
            <p className="cb-muted">No hay vencimientos cerca.</p>
          ) : (
            <ul className="cb-list">
              {data.upcoming_due.map((u) => (
                <li key={u.id} onClick={() => navigate(`/admin/sistemas?id=${u.id}`)}>
                  <span className={`cb-dot ${u.overdue ? "warn" : new Date(u.payment_due_date) < new Date() ? "late" : "ok"}`} />
                  <div className="cb-list-main">
                    <strong>{u.name}</strong>
                    <small>Vence {shortDate(u.payment_due_date)} · {u.payment_status === "al_dia" ? "Al día" : u.payment_status}</small>
                  </div>
                  <span className="cb-list-amount">{money(u.client_price)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="cb-grid-3">
        <div className="dashboard-section">
          <div className="section-heading"><h2>Últimos pagos</h2></div>
          {data.recent_payments.length === 0 ? (
            <p className="cb-muted">Todavía no registraste pagos.</p>
          ) : (
            <ul className="cb-list">
              {data.recent_payments.map((p) => (
                <li key={p.id} onClick={() => navigate("/admin/pagos")}>
                  <div className="cb-list-main">
                    <strong>{p.company_name}</strong>
                    <small>{shortDate(p.payment_date)} · {p.method || "—"}</small>
                  </div>
                  <span className="cb-list-amount">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-section">
          <div className="section-heading"><h2>Módulos más usados</h2><p>En sistemas activos</p></div>
          <ul className="cb-usage">
            {ALL_MODULES.map((m) => {
              const n = data.module_usage[m] ?? 0;
              const pct = data.active_systems ? (n / data.active_systems) * 100 : 0;
              return (
                <li key={m}>
                  <div className="cb-usage-row"><span>{MODULE_LABELS[m]}</span><strong>{n}</strong></div>
                  <div className="cb-progress"><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="dashboard-section">
          <div className="section-heading"><h2>Sistemas nuevos</h2></div>
          {data.recent_systems.length === 0 ? (
            <p className="cb-muted">Todavía no creaste sistemas.</p>
          ) : (
            <ul className="cb-list">
              {data.recent_systems.map((s) => (
                <li key={s.id} onClick={() => navigate(`/admin/sistemas?id=${s.id}`)}>
                  <div className="cb-list-main">
                    <strong>{s.name}</strong>
                    <small>{RUBRO_SHORT[s.rubro as Rubro] || s.rubro} · {s.city || "Sin ciudad"} · alta {shortDate(s.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminHome;
