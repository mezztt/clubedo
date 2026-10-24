import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi, shortDate } from "../../../config";
import { Empty, Loading, Pill, useFlash } from "../../../components/ui";

interface Row { id: number; membership_id: number; member_id: number; member_name: string; plan_name: string; from_date: string; to_date: string; days: number; reason: string; started: boolean; undone: boolean }

export default function Congelamientos() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const { show, fail, node: flash } = useFlash();
  const load = useCallback(() => { appApi<Row[]>("/freezes").then(setRows).catch(fail); }, [fail]);
  useEffect(load, [load]);
  const undo = async (r: Row) => {
    try { await appApi(`/memberships/${r.membership_id}/unfreeze`, { method: "POST", body: {} }); show("Se descongeló"); load(); } catch (e) { fail(e); }
  };
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty title="No hay congelamientos vigentes ni programados">Se congela desde la ficha de la persona.</Empty>;
  return (
    <>
      <div className="cb-table-wrap"><table className="cb-table">
        <thead><tr><th>Persona</th><th>Plan</th><th>Desde</th><th>Hasta</th><th>Motivo</th><th /></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td><Link to={`/app/socios/${r.member_id}`}><strong>{r.member_name}</strong></Link></td><td>{r.plan_name}</td>
            <td>{shortDate(r.from_date)} {r.started ? <Pill tone="teal">En curso</Pill> : <Pill tone="blue">Programado</Pill>}</td>
            <td>{shortDate(r.to_date)} <small>{r.days} días</small></td><td>{r.reason}</td>
            <td className="c1-num"><button className="secondary-button" onClick={() => undo(r)}>Descongelar</button></td>
          </tr>))}</tbody></table></div>
      {flash}
    </>
  );
}
