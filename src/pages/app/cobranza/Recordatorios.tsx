import { useCallback, useEffect, useState } from "react";
import { appApi, shortDate } from "../../../config";
import { Empty, Loading, Pill, Seg, useFlash, useRefreshKey } from "../../../components/ui";

interface Item { id: number; member_id: number; member_name: string | null; template_key: string; text: string; wa_url: string | null; mailto: string | null; status: string; due_on: string | null; sent_at: string | null }
const KEY_LABEL: Record<string, string> = { VENCE_PRONTO: "Vence pronto", VENCIDA: "Vencida", MORA_10: "Mora de 10+ días" };

export default function Recordatorios() {
  const [status, setStatus] = useState<"PENDIENTE" | "TODOS">("PENDIENTE");
  const [items, setItems] = useState<Item[] | null>(null);
  const { show, fail, node: flash } = useFlash();
  const refresh = useRefreshKey();
  const load = useCallback(() => { appApi<Item[]>(`/collections/reminders?status=${status}`).then(setItems).catch(fail); }, [status, fail]);
  useEffect(load, [load, refresh]);
  const generate = async () => {
    try { const r = await appApi<{ created?: number }>("/collections/reminders/generate", { method: "POST" }); show(r.created ? `Se armaron ${r.created} mensajes` : "No hay mensajes nuevos"); load(); } catch (e) { fail(e); }
  };
  const act = async (it: Item, what: "sent" | "discard") => {
    try { await appApi(`/collections/reminders/${it.id}/${what}`, { method: "POST" }); load(); } catch (e) { fail(e); }
  };
  const open = async (it: Item) => {
    if (it.wa_url) window.open(it.wa_url, "_blank", "noopener");
    await act(it, "sent");
  };
  return (
    <div className="cb-stack">
      <div className="cb-toolbar">
        <Seg value={status} onChange={setStatus} options={[["PENDIENTE", "Pendientes"], ["TODOS", "Todos"]]} />
        <button className="secondary-button" onClick={generate}>Armar los de hoy</button>
      </div>
      {!items ? <Loading /> : items.length === 0 ? <Empty title="No hay recordatorios pendientes">Se arman solos cada día; también podés armarlos ahora.</Empty> : (
        <div className="cb-stack">{items.map((it) => (
          <div key={it.id} className="cb-card">
            <div className="cb-card-head cb-spread"><h3>{it.member_name}</h3>
              <span className="cb-row"><Pill tone="blue">{KEY_LABEL[it.template_key] || it.template_key}</Pill>{it.status !== "PENDIENTE" && <Pill tone={it.status === "ENVIADO" ? "green" : "gray"}>{it.status === "ENVIADO" ? "Enviado" : "Descartado"}</Pill>}</span></div>
            <div className="c1-msg">{it.text}</div>
            <div className="cb-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {it.status === "PENDIENTE" && (
                <>
                  {it.wa_url ? <button className="primary-button" onClick={() => open(it)}>Abrir WhatsApp y marcar enviado</button> : <span className="cb-muted">Sin teléfono válido</span>}
                  {it.mailto && <a className="secondary-button" href={it.mailto}>Email</a>}
                  <button className="secondary-button" onClick={() => act(it, "sent")}>Ya lo envié</button>
                  <button className="secondary-button" onClick={() => act(it, "discard")}>Descartar</button>
                </>
              )}
              {it.due_on && <small className="cb-muted">Vencimiento {shortDate(it.due_on)}</small>}
            </div>
          </div>))}</div>
      )}
      {flash}
    </div>
  );
}
