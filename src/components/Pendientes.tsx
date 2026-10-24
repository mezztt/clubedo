import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi } from "../config";
import type { PendingItem } from "../config";
import { useRefreshKey } from "./ui";

/**
 * Panel «Pendientes»: lo que requiere acción hoy, con su cantidad y un clic a la pantalla.
 * exclude: claves que esa pantalla ya muestra de otra forma · hideEmpty: no ocupa lugar si no hay nada.
 */
export default function Pendientes({ exclude, hideEmpty }: { exclude?: string[]; hideEmpty?: boolean } = {}) {
  const navigate = useNavigate();
  const refreshKey = useRefreshKey();
  const [items, setItems] = useState<PendingItem[] | null>(null);

  useEffect(() => {
    const load = () => appApi<{ items: PendingItem[] }>("/dashboard/pending").then((r) => setItems(r.items)).catch(() => setItems((x) => x || []));
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [refreshKey]);

  if (!items) return null;
  const list = exclude ? items.filter((i) => !exclude.includes(i.key)) : items;
  if (hideEmpty && list.length === 0) return null;
  return (
    <div className="cb-card cb-pending" aria-label="Pendientes" data-tour="pending">
      <div className="cb-card-head">
        <div><h2>Pendientes</h2><p>{list.length ? "Lo que hay para resolver hoy. Tocá uno para ir a esa pantalla." : "No hay nada esperando."}</p></div>
      </div>
      {list.length === 0 ? <div className="cb-pending-ok"><span aria-hidden="true">✓</span> Todo al día</div> : (
        <div className="cb-pending-grid">
          {list.map((i) => (
            <button key={i.key} type="button" className={`cb-pending-item is-${i.tone}`} onClick={() => navigate(i.path)}>
              <b>{i.count}</b>
              <span><strong>{i.label}</strong><small>{i.hint}</small></span>
              <i aria-hidden="true">›</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
