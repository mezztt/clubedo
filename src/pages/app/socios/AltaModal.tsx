import { useEffect, useState } from "react";
import { PAYMENT_LABELS, PAYMENT_METHODS, appApi, canAccess, getSessionUser, money, useVocab } from "../../../config";
import { Field, Modal, strOrNull, useForm } from "../../../components/ui";

interface PlanOpt { id: number; name: string; price: number; enrollment_fee: number; active: boolean }
interface Cat { id: number; name: string; active: boolean }

/** Foto del carnet: se achica a ~320 px y se manda como data URI (máx. 200 KB). */
export function PhotoInput({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const pick = (file?: File) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 320 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      onChange(c.toDataURL("image/jpeg", 0.8));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  return (
    <div className="c1-photo-input">
      {value ? <img className="c1-avatar c1-avatar-lg" src={value} alt="Foto" /> : <span className="c1-avatar c1-avatar-lg" aria-hidden="true">+</span>}
      <div className="cb-stack">
        <label className="secondary-button" style={{ cursor: "pointer", textAlign: "center" }}>
          {value ? "Cambiar foto" : "Sacar o subir foto"}
          <input type="file" accept="image/*" capture="user" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && <button type="button" className="cb-link-danger" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => onChange(null)}>Quitar foto</button>}
      </div>
    </div>
  );
}

/** Alta rápida: datos básicos, consentimiento, y opcionalmente plan y primer cobro (todo en un paso). */
export default function AltaModal({ onClose, onCreated, payerId }: { onClose: () => void; onCreated: (id: number, warning?: string) => void; payerId?: number }) {
  const { t } = useVocab();
  const user = getSessionUser();
  const hasPlans = canAccess(user, "membresias");
  const { form, set } = useForm({
    first_name: "", last_name: "", dni: "", birth_date: "", phone: "", email: "", sex: "", category_id: "",
    guardian_name: "", guardian_dni: "", guardian_phone: "", emergency_contact_name: "", emergency_contact_phone: "", notes: "",
    plan_id: "", pay_now: true, method: "EFECTIVO", prospect: false, consent: false,
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasPlans) appApi<PlanOpt[]>("/plans?active=true").then(setPlans).catch(() => setPlans([]));
    appApi<Cat[]>("/member-categories").then((c) => setCats(c.filter((x) => x.active))).catch(() => setCats([]));
  }, [hasPlans]);

  const plan = plans.find((p) => String(p.id) === form.plan_id);
  const minor = form.birth_date ? (Date.now() - new Date(form.birth_date).getTime()) / 31557600000 < 18 : false;

  const save = async () => {
    setError("");
    if (!form.consent) { setError("Marcá que la persona acepta que guardemos sus datos."); return; }
    setSaving(true);
    try {
      const created = await appApi<{ id: number }>("/members", { method: "POST", body: {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(), dni: form.dni.trim(), birth_date: strOrNull(form.birth_date),
        sex: strOrNull(form.sex), phone: strOrNull(form.phone), email: strOrNull(form.email), category_id: form.category_id ? Number(form.category_id) : null,
        guardian_name: strOrNull(form.guardian_name), guardian_dni: strOrNull(form.guardian_dni), guardian_phone: strOrNull(form.guardian_phone),
        emergency_contact_name: strOrNull(form.emergency_contact_name), emergency_contact_phone: strOrNull(form.emergency_contact_phone),
        notes: strOrNull(form.notes), status: form.prospect ? "PROSPECTO" : "ACTIVO", payer_member_id: payerId ?? null, photo_data: photo, consent: true } });
      let warning: string | undefined;
      if (form.plan_id && !form.prospect) {
        try {
          const sold = await appApi<{ receipt_url: string | null }>(`/members/${created.id}/memberships`, { method: "POST", body: {
            plan_id: Number(form.plan_id), pay: form.pay_now ? { method: form.method } : null } });
          if (sold.receipt_url) window.open(sold.receipt_url, "_blank", "noopener");
        } catch (e) {
          // la persona ya quedó creada: seguimos a su ficha y avisamos
          warning = `La persona se creó, pero no se pudo asignar el plan: ${e instanceof Error ? e.message : ""}`;
        }
      }
      onCreated(created.id, warning);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  };

  const ok = form.first_name.trim() && form.last_name.trim() && form.dni.trim().length >= 6;
  return (
    <Modal title={`Nueva persona (${t("member")})`} eyebrow="ALTA RÁPIDA" size="wide" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" disabled={saving || !ok} onClick={save}>{saving ? "Guardando..." : form.plan_id && form.pay_now ? "Guardar y cobrar" : "Guardar"}</button></>}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <div className="form-row">
          <Field label="Nombre *"><input autoFocus value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
          <Field label="Apellido *"><input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="DNI *"><input inputMode="numeric" value={form.dni} onChange={(e) => set("dni", e.target.value)} /></Field>
          <Field label="Fecha de nacimiento"><input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Teléfono (WhatsApp)"><input inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        </div>
        {minor && (
          <>
            <div className="cb-note cb-note-info">Es menor de edad: cargá los datos de su madre, padre o tutor.</div>
            <div className="form-row">
              <Field label="Tutor"><input value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} /></Field>
              <Field label="DNI del tutor"><input value={form.guardian_dni} onChange={(e) => set("guardian_dni", e.target.value)} /></Field>
              <Field label="Teléfono del tutor"><input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} /></Field>
            </div>
          </>
        )}
        {hasPlans && !payerId && (
          <>
            <div className="form-row">
              <Field label={t("plan", true)}>
                <select value={form.plan_id} onChange={(e) => set("plan_id", e.target.value)} disabled={form.prospect}>
                  <option value="">Sin plan por ahora</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
                </select>
              </Field>
              {form.plan_id && !form.prospect && (
                <Field label="Medio de pago">
                  <select value={form.method} onChange={(e) => set("method", e.target.value)}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
                  </select>
                </Field>
              )}
            </div>
            {form.plan_id && !form.prospect && (
              <div className="cb-inline-checks"><label><input type="checkbox" checked={form.pay_now} onChange={(e) => set("pay_now", e.target.checked)} />
                Cobrar ahora {plan ? `(${money(plan.price + (plan.enrollment_fee || 0))}${plan.enrollment_fee ? ", con matrícula" : ""})` : ""} e imprimir el recibo</label></div>
            )}
          </>
        )}
        <button type="button" className="secondary-button" onClick={() => setMore(!more)}>{more ? "Menos datos" : "Más datos (foto, categoría, emergencia, notas)"}</button>
        {more && (
          <>
            <Field label="Foto"><PhotoInput value={photo} onChange={setPhoto} /></Field>
            <div className="form-row">
              <Field label="Sexo"><select value={form.sex} onChange={(e) => set("sex", e.target.value)}><option value="">—</option><option value="F">F</option><option value="M">M</option><option value="X">X</option></select></Field>
              <Field label="Categoría"><select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}><option value="">Sin categoría</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            </div>
            <div className="form-row">
              <Field label="Contacto de emergencia"><input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} /></Field>
              <Field label="Teléfono de emergencia"><input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} /></Field>
            </div>
            <Field label="Notas" wide><textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            <div className="cb-inline-checks"><label><input type="checkbox" checked={form.prospect} onChange={(e) => set("prospect", e.target.checked)} /> Es un prospecto (todavía no es {t("member")})</label></div>
          </>
        )}
        <div className="cb-inline-checks"><label><input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
          La persona acepta que guardemos sus datos (Ley 25.326) *</label></div>
      </div>
    </Modal>
  );
}
