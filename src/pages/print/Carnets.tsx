import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QrCode from "../../components/QrCode";
import { appApi } from "../../config";
import "../../clubedo.css";
import "../../c1.css";

interface Data { club: { name: string }; items: { id: number; name: string; dni: string; code: string; plan_name: string | null }[] }

/** Carnets con código QR (85,6 × 54 mm), listos para imprimir y recortar. */
export default function Carnets() {
  const [sp] = useSearchParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const ids = sp.get("ids");
    appApi<Data>(ids ? `/members/carnets?ids=${encodeURIComponent(ids)}` : "/members/carnets?all_active=true").then(setData).catch((e) => setError(e.message));
  }, [sp]);
  if (error) return <div className="cb-print-page"><div className="cb-sheet">{error}</div></div>;
  if (!data) return <div className="cb-print-page"><div className="cb-sheet">Cargando...</div></div>;
  return (
    <div className="cb-print-page">
      <div className="cb-print-toolbar"><span>{data.items.length} carnets</span><button className="primary-button" onClick={() => window.print()}>Imprimir</button></div>
      <div className="c1-carnet-grid">
        {data.items.map((c) => (
          <div key={c.id} className="c1-carnet">
            <div className="c1-carnet-info">
              <small>{data.club.name}</small>
              <strong>{c.name}</strong>
              <small>DNI {c.dni}{c.plan_name ? ` · ${c.plan_name}` : ""}</small>
            </div>
            <div className="c1-carnet-qr"><QrCode value={c.code} size={118} label={`QR de ${c.name}`} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
