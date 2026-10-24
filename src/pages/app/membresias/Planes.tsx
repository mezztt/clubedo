import { useCallback, useEffect, useState } from "react";
import { WEEKDAYS, appApi, money, shortDate, useVocab } from "../../../config";
import { Empty, Field, Loading, Modal, Pill, useFlash, useForm } from "../../../components/ui";

interface Plan {
  id: number; name: string; kind: string; price: number; period_months: number; billing_mode: string; classes_per_period: number | null; credits_validity_days: number | null;
  max_visits_per_week: number | null; allowed_days: number[]; allowed_time_from: string | null; allowed_time_to: string | null; max_members: number | null;
  extra_member_price: number; consume_on_access: boolean; personalized: boolean; enrollment_fee: number; prorate_first_period: boolean; active: boolean; members: number;
  upcoming_price: { new_price: number; effective_from: string } | null;
}
const KINDS: Record<string, string> = { MENSUAL: "Mensual", PERIODICO: "Trimestral / semestral / anual", POR_CLASES: "Pack de clases", PASE_LIBRE: "Pase libre", FAMILIAR: "Familiar", DIARIO: "Pase diario" };

export default function Planes({ admin }: { admin: boolean }) {
  const { t } = useVocab();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [edit, setEdit] = useState<Plan | "new" | null>(null);
  const [price, setPrice] = useState<Plan | null>(null);
  const { show, fail, node: flash } = useFlash();
  const load = useCallback(() => { appApi<Plan[]>("/plans").then(setPlans).catch(fail); }, [fail]);
  useEffect(load, [load]);
  if (!plans) return <Loading />;
  return (
    <div className="cb-stack">
      {admin && <div><button className="primary-button" onClick={() => setEdit("new")}>Nuevo {t("plan")}</button></div>}
      {plans.length === 0 ? <Empty title={`Todavía no hay ${t("plans")}`} /> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Nombre</th><th>Tipo</th><th className="c1-num">Precio</th><th>Cuota</th><th className="c1-num">Personas</th><th /></tr></thead>
          <tbody>{plans.map((p) => (
            <tr key={p.id} className={admin ? "is-click" : ""} onClick={() => admin && setEdit(p)}>
              <td><strong>{p.name}</strong>{!p.active && <> <Pill tone="gray">Inactivo</Pill></>}</td>
              <td>{KINDS[p.kind] || p.kind}{p.classes_per_period ? <small>{p.classes_per_period} clases</small> : null}</td>
              <td className="c1-num">{money(p.price)}{p.upcoming_price && <small>{money(p.upcoming_price.new_price)} desde {shortDate(p.upcoming_price.effective_from)}</small>}</td>
              <td>{p.billing_mode === "CALENDARIO" ? "Por calendario" : "Por aniversario"}</td><td className="c1-num">{p.members}</td>
              <td className="c1-num" onClick={(e) => e.stopPropagation()}>{admin && <button className="secondary-button" onClick={() => setPrice(p)}>Cambiar precio</button>}</td>
            </tr>))}</tbody></table></div>
      )}
      {edit && <PlanModal plan={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); show("Plan guardado"); load(); }} />}
      {price && <PriceModal plan={price} onClose={() => setPrice(null)} onDone={() => { setPrice(null); show("Precio programado"); load(); }} />}
      {flash}
    </div>
  );
}

function PlanModal({ plan, onClose, onDone }: { plan: Plan | null; onClose: () => void; onDone: () => void }) {
  const { form, set } = useForm({
    name: plan?.name || "", kind: plan?.kind || "MENSUAL", price: plan ? String(plan.price) : "", period_months: String(plan?.period_months || 1), billing_mode: plan?.billing_mode || "",
    classes_per_period: plan?.classes_per_period ? String(plan.classes_per_period) : "", credits_validity_days: plan?.credits_validity_days ? String(plan.credits_validity_days) : "",
    max_visits_per_week: plan?.max_visits_per_week ? String(plan.max_visits_per_week) : "", max_members: plan?.max_members ? String(plan.max_members) : "",
    extra_member_price: plan ? String(plan.extra_member_price) : "0", enrollment_fee: plan ? String(plan.enrollment_fee) : "0",
    allowed_time_from: plan?.allowed_time_from || "", allowed_time_to: plan?.allowed_time_to || "",
    prorate: plan?.prorate_first_period || false, consume: plan?.consume_on_access || false, personalized: plan?.personalized || false, active: plan?.active ?? true,
  });
  const [days, setDays] = useState<number[]>(plan?.allowed_days || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const save = async () => {
    setBusy(true); setError("");
    const body: Record<string, unknown> = {
      name: form.name.trim(), kind: form.kind, price: num(form.price) ?? 0, period_months: Number(form.period_months), billing_mode: form.billing_mode || null,
      classes_per_period: form.kind === "POR_CLASES" ? num(form.classes_per_period) : null, credits_validity_days: form.kind === "POR_CLASES" ? num(form.credits_validity_days) : null,
      max_visits_per_week: num(form.max_visits_per_week), max_members: form.kind === "FAMILIAR" ? num(form.max_members) : null,
      extra_member_price: num(form.extra_member_price) ?? 0, enrollment_fee: num(form.enrollment_fee) ?? 0,
      allowed_days: days, allowed_time_from: form.allowed_time_from || null, allowed_time_to: form.allowed_time_to || null,
      prorate_first_period: form.prorate, consume_on_access: form.consume, personalized: form.personalized, active: form.active,
    };
    try { await appApi(plan ? `/plans/${plan.id}` : "/plans", { method: plan ? "PUT" : "POST", body }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  };
  const tgl = (d: number) => setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));
  return (
    <Modal title={plan ? `Editar ${plan.name}` : "Nuevo plan"} onClose={onClose} size="wide" footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || !form.name.trim()} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <div className="form-row">
          <Field label="Nombre"><input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
          <Field label="Tipo"><select value={form.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <div className="form-row">
          <Field label="Precio ($)" hint={plan ? "Para cambiar el precio hacia adelante usá «Cambiar precio»." : undefined}><input inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} disabled={!!plan} /></Field>
          <Field label="Matrícula ($)"><input inputMode="decimal" value={form.enrollment_fee} onChange={(e) => set("enrollment_fee", e.target.value)} /></Field>
        </div>
        {form.kind !== "POR_CLASES" && form.kind !== "DIARIO" && (
          <div className="form-row">
            <Field label="Período"><select value={form.period_months} onChange={(e) => set("period_months", e.target.value)}>{[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m === 1 ? "Mensual" : `${m} meses`}</option>)}</select></Field>
            <Field label="Cómo vence la cuota"><select value={form.billing_mode} onChange={(e) => set("billing_mode", e.target.value)}>
              <option value="">El del club</option><option value="ANIVERSARIO">Por aniversario (desde que paga)</option><option value="CALENDARIO">Por calendario (día fijo del mes)</option></select></Field>
          </div>
        )}
        {form.kind === "POR_CLASES" && (
          <div className="form-row">
            <Field label="Clases del pack"><input inputMode="numeric" value={form.classes_per_period} onChange={(e) => set("classes_per_period", e.target.value)} /></Field>
            <Field label="Vigencia (días)"><input inputMode="numeric" value={form.credits_validity_days} onChange={(e) => set("credits_validity_days", e.target.value)} /></Field>
          </div>
        )}
        {form.kind === "FAMILIAR" && (
          <div className="form-row">
            <Field label="Máximo de personas"><input inputMode="numeric" value={form.max_members} onChange={(e) => set("max_members", e.target.value)} /></Field>
            <Field label="Adicional por persona ($)"><input inputMode="decimal" value={form.extra_member_price} onChange={(e) => set("extra_member_price", e.target.value)} /></Field>
          </div>
        )}
        <div className="form-row">
          <Field label="Máximo de visitas por semana"><input inputMode="numeric" value={form.max_visits_per_week} onChange={(e) => set("max_visits_per_week", e.target.value)} placeholder="Sin límite" /></Field>
          <Field label="Horario permitido"><div className="cb-row"><input type="time" value={form.allowed_time_from} onChange={(e) => set("allowed_time_from", e.target.value)} /><span>a</span><input type="time" value={form.allowed_time_to} onChange={(e) => set("allowed_time_to", e.target.value)} /></div></Field>
        </div>
        <Field label="Días permitidos (vacío = todos)" wide><div className="cb-chips">{WEEKDAYS.map((w, i) => (
          <label key={w} className="cb-chip" style={{ cursor: "pointer" }}><input type="checkbox" checked={days.includes(i)} onChange={() => tgl(i)} /> {w.slice(0, 3)}</label>))}</div></Field>
        <div className="cb-inline-checks">
          <label><input type="checkbox" checked={form.prorate} onChange={(e) => set("prorate", e.target.checked)} /> Cobrar proporcional el primer mes</label>
          <label><input type="checkbox" checked={form.personalized} onChange={(e) => set("personalized", e.target.checked)} /> Entrenamiento personalizado</label>
          <label><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Se puede vender</label>
        </div>
      </div>
    </Modal>
  );
}

function PriceModal({ plan, onClose, onDone }: { plan: Plan; onClose: () => void; onDone: () => void }) {
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState("");
  const [error, setError] = useState("");
  const go = async () => {
    try { await appApi(`/plans/${plan.id}/price-change`, { method: "POST", body: { new_price: Number(price.replace(",", ".")), effective_from: from } }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo"); }
  };
  return (
    <Modal title={`Cambiar precio · ${plan.name}`} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!price || !from} onClick={go}>Programar</button></>}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <p className="cb-muted">Hoy cuesta {money(plan.price)}. Las cuotas que ya se generaron no cambian; el precio nuevo rige para las cuotas desde la fecha.</p>
        <div className="form-row">
          <Field label="Precio nuevo ($)"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus /></Field>
          <Field label="Rige desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}
