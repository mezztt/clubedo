import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime, useVocab } from "../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, useFlash } from "../../components/ui";

interface Req {
  id: number; kind: "BAJA" | "ARREPENTIMIENTO"; code: string; member_id: number | null; member_name: string | null; dni: string;
  full_name: string; contact: string; reason: string | null; requested_at: string; source: string;
  status: "RECIBIDA" | "PROCESADA" | "RECHAZADA"; processed_at: string | null; resolution_note: string | null;
}

const STATUS_TONE: Record<string, string> = { RECIBIDA: "orange", PROCESADA: "green", RECHAZADA: "gray" };
const STATUS_LABEL: Record<string, string> = { RECIBIDA: "Sin procesar", PROCESADA: "Procesada", RECHAZADA: "Rechazada" };

/** Bajas y arrepentimientos recibidos. Siempre disponible: no depende de ningún módulo. */
function Bajas() {
  const { t } = useVocab();
  const { show, fail, node: flash } = useFlash();
  const [filter, setFilter] = useState<"RECIBIDA" | "TODAS">("RECIBIDA");
  const [items, setItems] = useState<Req[] | null>(null);
  const [open, setOpen] = useState<Req | null>(null);

  const load = useCallback(() => {
    appApi<Req[]>(`/cancellations${filter === "RECIBIDA" ? "?status=RECIBIDA" : ""}`).then(setItems).catch(fail);
  }, [filter, fail]);
  useEffect(() => { setItems(null); load(); }, [load]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="EL CLUB" title="Bajas y arrepentimientos"
        subtitle={`Pedidos de baja y de arrepentimiento que llegaron desde la web o el portal. Procesalos dentro de los 2 días hábiles.`}>
        <Seg value={filter} onChange={setFilter} options={[["RECIBIDA", "Sin procesar"], ["TODAS", "Todas"]]} />
      </PageHeader>
      {!items ? <Loading /> : items.length === 0 ? <Empty title={filter === "RECIBIDA" ? "No hay pedidos sin procesar" : "Todavía no llegó ningún pedido"} /> : (
        <div className="cb-table-wrap">
          <table className="cb-table">
            <thead><tr><th>Código</th><th>Tipo</th><th>Persona</th><th>Contacto</th><th>Recibida</th><th>Estado</th></tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="is-click" onClick={() => setOpen(r)}>
                  <td><span className="cb-code-sm">{r.code}</span></td>
                  <td>{r.kind === "BAJA" ? "Baja" : "Arrepentimiento"}</td>
                  <td><strong>{r.member_name || r.full_name}</strong><small>DNI {r.dni}</small></td>
                  <td>{r.contact}</td>
                  <td>{dateTime(r.requested_at)}</td>
                  <td><Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <Detail req={open} memberWord={t("member")} onClose={() => setOpen(null)}
        onDone={(text) => { setOpen(null); load(); show(text); }} onFail={fail} />}
      {flash}
    </section>
  );
}

function Detail({ req, memberWord, onClose, onDone, onFail }: {
  req: Req; memberWord: string; onClose: () => void; onDone: (text: string) => void; onFail: (e: unknown) => void;
}) {
  const [note, setNote] = useState("");
  const [endMembership, setEndMembership] = useState(true);
  const [saving, setSaving] = useState(false);
  const pending = req.status === "RECIBIDA";

  async function run(action: "PROCESAR" | "RECHAZAR") {
    if (action === "RECHAZAR" && !note.trim()) { onFail(new Error("Para rechazar, escribí el motivo")); return; }
    setSaving(true);
    try {
      await appApi(`/cancellations/${req.id}/process`, { method: "POST", body: { action, note: note.trim() || null, end_membership: endMembership } });
      onDone(action === "PROCESAR" ? "Pedido procesado" : "Pedido rechazado");
    } catch (e) { onFail(e); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow={req.kind === "BAJA" ? "BAJA" : "ARREPENTIMIENTO"} title={req.code} onClose={onClose}
      footer={pending ? (
        <>
          <button className="secondary-button" onClick={() => run("RECHAZAR")} disabled={saving}>Rechazar</button>
          <button className="primary-button" onClick={() => run("PROCESAR")} disabled={saving}>{saving ? "Procesando..." : "Procesar"}</button>
        </>
      ) : <button className="secondary-button" onClick={onClose}>Cerrar</button>}>
      <div className="cb-detail-grid">
        <div><small>Nombre</small><strong>{req.full_name}</strong></div>
        <div><small>DNI</small><strong>{req.dni}</strong></div>
        <div><small>Contacto</small><strong>{req.contact}</strong></div>
        <div><small>{memberWord === "socio" ? "Socio en el sistema" : "Registrado como"}</small><strong>{req.member_name || "No se encontró por DNI"}</strong></div>
        <div><small>Llegó por</small><strong>{req.source === "WEB" ? "La web del club" : req.source}</strong></div>
        <div><small>Recibida</small><strong>{dateTime(req.requested_at)}</strong></div>
      </div>
      {req.reason && <div className="cb-note cb-note-info"><strong>Motivo:</strong> {req.reason}</div>}
      {req.resolution_note && <div className="cb-note cb-note-info" style={{ marginTop: 8 }}><strong>Resolución:</strong> {req.resolution_note}</div>}
      {pending && (
        <div className="product-form" style={{ marginTop: 14 }}>
          {req.kind === "BAJA" && (
            <div className="cb-inline-checks"><label><input type="checkbox" checked={endMembership} onChange={(e) => setEndMembership(e.target.checked)} /> Cortar el plan y no generar más cuotas</label></div>
          )}
          {req.kind === "ARREPENTIMIENTO" && <p className="cb-muted">Al procesarlo, los pagos asociados quedan marcados «a devolver». La devolución la hacés vos desde Mercado Pago o en caja.</p>}
          <Field label="Nota (obligatoria para rechazar)"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        </div>
      )}
    </Modal>
  );
}

export default Bajas;
