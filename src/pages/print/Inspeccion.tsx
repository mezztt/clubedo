import { dateTime, shortDate } from "../../config";

export interface InspectionData {
  company: string; generated_at: string; today: string; disclaimer: string; missing: string[];
  local: Row[]; staff: Row[];
  aptos: { total_active: number; counts: Record<string, number>; validity_days: number; required_mode: string };
}
interface Row { id: number; kind_label: string; label: string; number: string | null; owner_name: string; valid_until: string | null; state: string; state_label: string }

const MODE: Record<string, string> = { NO: "No se exige", AVISAR: "Se avisa pero no se bloquea el ingreso", BLOQUEAR: "Se bloquea el ingreso sin apto vigente" };

function Table({ rows, who }: { rows: Row[]; who?: boolean }) {
  if (rows.length === 0) return <p>Sin documentos cargados.</p>;
  return (
    <table>
      <thead><tr><th>Documento</th>{who && <th>Persona</th>}<th>Número</th><th>Vence</th><th>Estado</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}><td>{r.label}</td>{who && <td>{r.owner_name}</td>}<td>{r.number || "-"}</td><td>{r.valid_until ? shortDate(r.valid_until) : "-"}</td><td>{r.state_label}</td></tr>))}</tbody>
    </table>
  );
}

/** Planilla para mostrar en una inspección: documentación del local y del equipo, y resumen de aptos (sin datos personales de socios). */
export default function InspectionSheet({ data }: { data: InspectionData }) {
  const c = data.aptos.counts;
  return (
    <div className="cb-sheet">
      <div className="cb-sheet-head">
        <div><h1>Planilla de documentación</h1><small>{data.company}</small></div>
        <div style={{ textAlign: "right" }}><strong>Al {shortDate(data.today)}</strong></div>
      </div>
      <h2>Documentación del local</h2>
      <Table rows={data.local} />
      {data.missing.length > 0 && <p><strong>Sin cargar:</strong> {data.missing.join(", ")}.</p>}
      <h2>Equipo</h2>
      <Table rows={data.staff} who />
      <h2>Aptos médicos de las personas activas</h2>
      <table>
        <thead><tr><th>Vigentes</th><th>Por vencer</th><th>Vencidos</th><th>Sin apto</th><th>Total activos</th></tr></thead>
        <tbody><tr><td>{c.VIGENTE || 0}</td><td>{c.POR_VENCER || 0}</td><td>{c.VENCIDO || 0}</td><td>{c.SIN_APTO || 0}</td><td>{data.aptos.total_active}</td></tr></tbody>
      </table>
      <p>Validez del apto: {data.aptos.validity_days} días. Política: {MODE[data.aptos.required_mode] || data.aptos.required_mode}.</p>
      <div className="cb-signature-line"><div>Firma y aclaración del responsable</div></div>
      <div className="cb-sheet-foot"><span>{data.disclaimer}</span><span>Emitida {dateTime(data.generated_at)}</span></div>
    </div>
  );
}
