import { useEffect, useState } from "react";
import { PAYMENT_LABELS, PAYMENT_METHODS, appApi, money, useVocab } from "../../config";
import { Field, Modal, useForm } from "../ui";

interface PlanOpt { id: number; name: string; kind: string; price: number; enrollment_fee: number; active: boolean }

function Footer({ onClose, onOk, label, busy, disabled, danger }: { onClose: () => void; onOk: () => void; label: string; busy: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className={danger ? "cb-danger-button" : "primary-button"} disabled={busy || disabled} onClick={onOk}>{busy ? "Guardando..." : label}</button>
    </>
  );
}

/** Asignar un plan a una persona (con descuento, matrícula y cobro opcional en el mismo paso). */
export function SellPlanModal({ memberId, onClose, onDone }: { memberId: number; onClose: () => void; onDone: (receiptUrl?: string | null) => void }) {
  const { t } = useVocab();
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const { form, set } = useForm({ plan_id: "", start_date: "", discount_pct: "", discount_reason: "", pay_now: true, method: "EFECTIVO", enrollment: true, auto_renew: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { appApi<PlanOpt[]>("/plans?active=true").then(setPlans).catch(() => setPlans([])); }, []);
  const plan = plans.find((p) => String(p.id) === form.plan_id);
  const go = async () => {
    setBusy(true); setError("");
    try {
      const r = await appApi<{ receipt_url: string | null }>(`/members/${memberId}/memberships`, { method: "POST", body: {
        plan_id: Number(form.plan_id), start_date: form.start_date || null, discount_pct: Number(form.discount_pct || 0) || 0,
        discount_reason: form.discount_reason.trim() || null, auto_renew: form.auto_renew, include_enrollment: form.enrollment,
        pay: form.pay_now ? { method: form.method } : null } });
      onDone(r.receipt_url);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Asignar ${t("plan")}`} eyebrow="MEMBRESÍA" onClose={onClose} footer={<Footer onClose={onClose} onOk={go} busy={busy} disabled={!form.plan_id} label={form.pay_now ? "Asignar y cobrar" : "Asignar"} />}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <Field label={t("plan", true)}>
          <select value={form.plan_id} onChange={(e) => set("plan_id", e.target.value)} autoFocus>
            <option value="">Elegí un plan</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Empieza el"><input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="Descuento %"><input inputMode="decimal" value={form.discount_pct} onChange={(e) => set("discount_pct", e.target.value)} /></Field>
        </div>
        {Number(form.discount_pct) > 0 && <Field label="Motivo del descuento"><input value={form.discount_reason} onChange={(e) => set("discount_reason", e.target.value)} /></Field>}
        {plan && plan.enrollment_fee > 0 && (
          <div className="cb-inline-checks"><label><input type="checkbox" checked={form.enrollment} onChange={(e) => set("enrollment", e.target.checked)} /> Cobrar la matrícula ({money(plan.enrollment_fee)})</label></div>
        )}
        <div className="cb-inline-checks"><label><input type="checkbox" checked={form.auto_renew} onChange={(e) => set("auto_renew", e.target.checked)} /> Generar la cuota todos los meses</label></div>
        <div className="cb-inline-checks"><label><input type="checkbox" checked={form.pay_now} onChange={(e) => set("pay_now", e.target.checked)} /> Cobrar ahora</label></div>
        {form.pay_now && (
          <Field label="Medio de pago">
            <select value={form.method} onChange={(e) => set("method", e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}</select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function FreezeModal({ membershipId, planName, onClose, onDone }: { membershipId: number; planName?: string; onClose: () => void; onDone: () => void }) {
  const { form, set } = useForm({ reason: "", from_date: "", unit: "days", amount: "30" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    const n = Number(form.amount);
    try {
      await appApi(`/memberships/${membershipId}/freeze`, { method: "POST", body: {
        reason: form.reason.trim(), from_date: form.from_date || null, ...(form.unit === "days" ? { days: n } : { months: n }) } });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo congelar"); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Congelar${planName ? ` · ${planName}` : ""}`} eyebrow="MEMBRESÍA" onClose={onClose}
      footer={<Footer onClose={onClose} onOk={go} busy={busy} disabled={form.reason.trim().length < 3 || !(Number(form.amount) > 0)} label="Congelar" />}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <Field label="Motivo"><input value={form.reason} onChange={(e) => set("reason", e.target.value)} autoFocus placeholder="Viaje, lesión, licencia…" /></Field>
        <div className="form-row">
          <Field label="Desde (vacío = hoy)"><input type="date" value={form.from_date} onChange={(e) => set("from_date", e.target.value)} /></Field>
          <Field label="Por cuánto tiempo">
            <div className="cb-row">
              <input style={{ width: 80 }} inputMode="numeric" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              <select value={form.unit} onChange={(e) => set("unit", e.target.value)}><option value="days">días</option><option value="months">meses</option></select>
            </div>
          </Field>
        </div>
        <p className="cb-muted">Mientras está congelada no se genera deuda y la fecha de fin se corre los días congelados.</p>
      </div>
    </Modal>
  );
}

export function EndMembershipModal({ membershipId, planName, onClose, onDone }: { membershipId: number; planName?: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    try { await appApi(`/memberships/${membershipId}/end`, { method: "POST", body: { reason: reason.trim() } }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo dar de baja"); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Dar de baja${planName ? ` · ${planName}` : ""}`} eyebrow="MEMBRESÍA" onClose={onClose}
      footer={<Footer onClose={onClose} onOk={go} busy={busy} disabled={reason.trim().length < 3} label="Dar de baja el plan" danger />}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <p className="cb-muted">Deja de generar cuotas. Sigue habilitada hasta que termine lo que ya pagó y las cuotas futuras sin pagar se anulan; la deuda vencida se conserva.</p>
      </div>
    </Modal>
  );
}
