import { useEffect, useState } from "react";
import { appApi } from "../../config";

export interface PickedMember { id: number; full_name: string; dni?: string | null }

/** Buscador de personas por nombre o DNI (usa GET /members?limit=8&q=). */
export default function MemberPicker({ value, onChange, placeholder = "Buscar por nombre o DNI…", autoFocus }: {
  value: PickedMember | null; onChange: (m: PickedMember | null) => void; placeholder?: string; autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedMember[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems([]); return; }
    const timer = window.setTimeout(() => {
      appApi<{ items: PickedMember[] }>(`/members?limit=8&q=${encodeURIComponent(term)}`).then((r) => setItems(r.items || [])).catch(() => setItems([]));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [q]);
  if (value) {
    return (
      <div className="cb-row" style={{ justifyContent: "space-between" }}>
        <strong>{value.full_name}</strong>
        <button type="button" className="secondary-button" onClick={() => { onChange(null); setQ(""); }}>Cambiar</button>
      </div>
    );
  }
  return (
    <div className="c1-picker">
      <input value={q} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => setQ(e.target.value)} aria-label="Buscar persona" />
      {items.length > 0 && (
        <div className="c1-picker-results">
          {items.map((m) => (
            <button key={m.id} type="button" onClick={() => { onChange(m); setItems([]); }}>
              <strong>{m.full_name}</strong><small>{m.dni ? `DNI ${m.dni}` : ""}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
