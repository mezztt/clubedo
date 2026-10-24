import { useCallback, useEffect, useMemo, useState } from "react";
import { PAYMENT_LABELS, PAYMENT_METHODS, appApi, money, shortDate } from "../../config";
import { Field, Loading, Modal, Pill, useFlash } from "../ui";
import MemberPicker from "./MemberPicker";
import type { PickedMember } from "./MemberPicker";
import "../../c1.css";

interface ChargeRow { id: number; concept: string; description: string | null; period_label: string | null; outstanding: number; due_date: string | null; label: string; tone: string; member_name: string | null }
interface Renewable { membership_id: number; plan_name: string; plan_kind: string; state_label: string; expires_on: string | null; price: number }
interface Billing {
  member: { id: number; full_name: string; dni: string }; owner: { id: number; full_name: string };
  charges: ChargeRow[]; credit_balance: number; renewables: Renewable[];
  cash: { module: boolean; required: boolean; open: boolean };
}
interface Paid { id: number; receipt_url: string; number_text: string; amount: number; credit: number }

/** Ventana «Cobrar»: elegir cuotas, medio de pago, cobrar e imprimir el recibo interno. Sin elegir persona, muestra el buscador. */
export default function CobrarModal({ memberId, onClose, onDone }: { memberId?: number | null; onClose: () => void; onDone?: () => void }) {
  const [picked, setPicked] = useState<PickedMember | null>(null);
  const mid = memberId || picked?.id || null;
  const [data, setData] = useState<Billing | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [method, setMethod] = useState("EFECTIVO");
  const [amount, setAmount] = useState("");
  const [custom, setCustom] = useState(false);
  const [invoice, setInvoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [paid, setPaid] = useState<Paid | null>(null);
  const { show, fail, node: flash } = useFlash();

  const load = useCallback(() => {
    if (!mid) return;
    appApi<Billing>(`/members/${mid}/billing`).then((b) => {
      setData(b); setSel(new Set(b.charges.map((c) => c.id))); setCustom(false);
    }).catch(fail);
  }, [mid, fail]);
  useEffect(() => { setData(null); load(); }, [load]);

  const total = useMemo(() => (data?.charges || []).filter((c) => sel.has(c.id)).reduce((s, c) => s + c.outstanding, 0), [data, sel]);
  useEffect(() => { if (!custom) setAmount(total ? total.toFixed(2) : ""); }, [total, custom]);

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const blocked = !!data?.cash.required && !data.cash.open;

  const pay = async () => {
    if (!mid) return;
    const num = Number(String(amount).replace(",", "."));
    if (!(num > 0)) { fail(new Error("Escribí el importe a cobrar")); return; }
    setSaving(true);
    try {
      const r = await appApi<Paid>(`/members/${mid}/payments`, { method: "POST", body: {
        amount: num, method, charge_ids: sel.size ? [...sel] : null, external_invoice_number: invoice.trim() || null } });
      setPaid(r); onDone?.();
    } catch (e) { fail(e); } finally { setSaving(false); }
  };

  const renew = async (r: Renewable) => {
    try {
      await appApi(`/memberships/${r.membership_id}/renew`, { method: "POST", body: {} });
      show("Cuota generada"); load(); onDone?.();
    } catch (e) { fail(e); }
  };

  const openReceipt = (url: string) => window.open(url, "_blank", "noopener");

  return (
    <Modal title={data ? `Cobrar · ${data.owner.id !== data.member.id ? data.owner.full_name : data.member.full_name}` : "Cobrar"} eyebrow="COBRO"
      onClose={onClose} size="wide"
      footer={paid ? (
        <>
          <button className="secondary-button" onClick={onClose}>Listo</button>
          <button className="primary-button" onClick={() => openReceipt(paid.receipt_url)}>Imprimir recibo</button>
        </>
      ) : mid ? (
        <>
          <button className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={saving || blocked || !data} onClick={pay}>{saving ? "Cobrando..." : `Cobrar ${amount ? money(Number(String(amount).replace(",", ".")) || 0) : ""}`}</button>
        </>
      ) : undefined}>
      {!mid ? (
        <div className="product-form"><Field label="¿A quién le cobrás?" wide><MemberPicker value={picked} onChange={setPicked} autoFocus /></Field></div>
      ) : paid ? (
        <div className="cb-stack">
          <div className="cb-note cb-note-info"><strong>Cobro registrado.</strong> Recibo N° {paid.number_text} por {money(paid.amount)}.</div>
          {paid.credit > 0 && <div className="cb-note cb-note-info">Quedó un saldo a favor de {money(paid.credit)} que se descuenta de la próxima cuota.</div>}
          <p className="cb-muted">El recibo es interno: «Documento no válido como factura».</p>
        </div>
      ) : !data ? <Loading /> : (
        <div className="cb-stack">
          {blocked && <div className="cb-note cb-note-warn">Para cobrar tenés que abrir tu caja primero (módulo Caja).</div>}
          {data.credit_balance > 0 && <div className="cb-note cb-note-info">Tiene {money(data.credit_balance)} a favor: se descuenta solo de las cuotas.</div>}
          {data.charges.length === 0 ? <div className="cb-note cb-note-info">No tiene cuotas pendientes.</div> : (
            <div>
              {data.charges.map((c) => (
                <label key={c.id} className="c1-charge-row">
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="c1-grow"><strong>{c.description || c.concept}</strong>
                    <small>{c.member_name ? `${c.member_name} · ` : ""}{c.due_date ? `vence ${shortDate(c.due_date)}` : "sin vencimiento"}</small></span>
                  <Pill tone={c.tone}>{c.label}</Pill>
                  <strong className="c1-num">{money(c.outstanding)}</strong>
                </label>
              ))}
              <div className="c1-total"><span>Total elegido</span><span>{money(total)}</span></div>
            </div>
          )}
          {data.renewables.length > 0 && (
            <div>
              <span className="cb-form-title">Renovar o recargar</span>
              {data.renewables.map((r) => (
                <div key={r.membership_id} className="c1-charge-row">
                  <span className="c1-grow"><strong>{r.plan_name}</strong><small>{r.state_label}{r.expires_on ? ` · vence ${shortDate(r.expires_on)}` : ""}</small></span>
                  <button className="secondary-button" onClick={() => renew(r)}>Generar cuota · {money(r.price)}</button>
                </div>
              ))}
            </div>
          )}
          <div className="product-form">
            <Field label="Medio de pago" wide>
              <div className="c1-methods">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} type="button" className={method === m ? "is-on" : ""} onClick={() => setMethod(m)}>{PAYMENT_LABELS[m] || m}</button>
                ))}
              </div>
            </Field>
            <div className="form-row">
              <Field label="Importe" hint="Si cobrás de más, queda como saldo a favor.">
                <input inputMode="decimal" value={amount} onChange={(e) => { setCustom(true); setAmount(e.target.value); }} />
              </Field>
              <Field label="N° de factura externa (opcional)"><input value={invoice} maxLength={40} onChange={(e) => setInvoice(e.target.value)} /></Field>
            </div>
          </div>
        </div>
      )}
      {flash}
    </Modal>
  );
}
