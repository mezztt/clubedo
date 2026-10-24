import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi, money, shortDate } from "../../../config";
import { Empty, Loading, Pill, useFlash } from "../../../components/ui";

interface P { id: number; member_id: number; member_name: string | null; total: number; installments: number; status: string; paid_count: number; remaining: number; next_due: string | null; overdue: boolean;
  items: { charge_id: number; description: string; amount: number; paid_amount: number; due_date: string | null; status: string }[] }

export default function PlanesPago() {
  const [rows, setRows] = useState<P[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const { fail, node: flash } = useFlash();
  useEffect(() => { appApi<P[]>("/payment-plans").then(setRows).catch(fail); }, [fail]);
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty title="Todavía no hay planes de pago">Se crean desde Deudores, con «Plan de pagos».</Empty>;
  return (
    <>
      <div className="cb-table-wrap"><table className="cb-table">
        <thead><tr><th>Persona</th><th>Cuotas</th><th className="c1-num">Total</th><th className="c1-num">Resta</th><th>Próximo</th><th>Estado</th></tr></thead>
        <tbody>{rows.map((p) => (
          <Fragment key={p.id}>
            <tr className="is-click" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <td>{p.member_name ? <Link to={`/app/socios/${p.member_id}`} onClick={(e) => e.stopPropagation()}><strong>{p.member_name}</strong></Link> : "—"}</td>
              <td>{p.paid_count} de {p.installments}</td><td className="c1-num">{money(p.total)}</td><td className="c1-num">{money(p.remaining)}</td>
              <td>{p.next_due ? shortDate(p.next_due) : "—"}</td>
              <td>{p.status === "COMPLETADO" || p.remaining === 0 ? <Pill tone="green">Completo</Pill> : p.overdue ? <Pill tone="red">Atrasado</Pill> : <Pill tone="blue">Al día</Pill>}</td>
            </tr>
            {open === p.id && <tr key={`${p.id}-d`}><td colSpan={6}>{p.items.map((i) => (
              <div key={i.charge_id} className="c1-charge-row"><span className="c1-grow">{i.description}<small>{i.due_date ? `vence ${shortDate(i.due_date)}` : ""}</small></span>
                <Pill tone={i.status === "PAGADA" ? "green" : "orange"}>{i.status === "PAGADA" ? "Pagada" : "Pendiente"}</Pill><strong className="c1-num">{money(i.amount)}</strong></div>))}</td></tr>}
          </Fragment>))}</tbody></table></div>
      {flash}
    </>
  );
}
