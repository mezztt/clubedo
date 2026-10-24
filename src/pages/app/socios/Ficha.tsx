import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PAYMENT_LABELS, appApi, canAccess, dateTime, downloadFile, getSessionUser, money, shortDate, useVocab } from "../../../config";
import { Empty, Field, Loading, Modal, Pill, Tabs, useFlash, useForm, useRefreshKey } from "../../../components/ui";
import FeeChip from "../../../components/c1/FeeChip";
import CobrarModal from "../../../components/c1/CobrarModal";
import MemberPicker from "../../../components/c1/MemberPicker";
import type { PickedMember } from "../../../components/c1/MemberPicker";
import { EndMembershipModal, FreezeModal, SellPlanModal } from "../../../components/c1/MembershipActions";
import QrCode from "../../../components/QrCode";
import AltaModal, { PhotoInput } from "./AltaModal";

interface MS {
  id: number; plan_name: string; plan_kind: string; status: string; state: string; state_label: string; state_tone: string; start_date: string | null; end_date: string | null;
  credits_left: number | null; credits_total: number | null; price_agreed: number | null; discount_pct: number; auto_renew: boolean;
  freeze: { id: number; from_date: string; to_date: string; days: number; reason: string } | null; ended_reason: string | null;
}
interface Detail {
  id: number; full_name: string; first_name: string; last_name: string; dni: string; birth_date: string | null; age: number | null; minor: boolean; sex: string | null;
  status: string; joined_at: string | null; left_at: string | null; left_reason: string | null; photo: string | null; anonymized: boolean; restricted: boolean;
  category: { id: number; name: string } | null; tags: string[];
  state: { state: string; label: string; name: string; tone: string; plan_name: string | null; expires_on: string | null; credits_left: number | null; covered_by_payer: boolean };
  apto: { state: string; valid_until: string | null };
  memberships?: MS[]; phone?: string | null; email?: string | null; address?: string | null; city?: string | null; notes?: string | null; source?: string | null;
  emergency_contact_name?: string | null; emergency_contact_phone?: string | null; guardian_name?: string | null; guardian_dni?: string | null; guardian_phone?: string | null;
  qr_code?: string; credit_balance?: number; debt?: { total: number; overdue: number; count: number; oldest_due: string | null } | null;
  payer?: { id: number; full_name: string } | null; dependents?: { id: number; full_name: string; status: string; state: string; state_label: string; tone: string }[];
  consent?: { at: string | null; version: number | null; current_version: number };
  portal?: { has_access: boolean; code_pending: boolean }; last_attendance?: string | null;
}
interface Charge { id: number; description: string | null; concept: string; due_date: string | null; amount: number; outstanding: number; status: string; label: string; tone: string }
interface Pay { id: number; number_text: string; amount: number; method: string; paid_at: string; status: string; refund_pending: boolean; lines: { description: string }[] }
interface Att { id: number; kind: string; at: string; source: string }
const APTO_TONE: Record<string, string> = { VIGENTE: "green", POR_VENCER: "orange", VENCIDO: "red", SIN_APTO: "gray" };
const APTO_LABEL: Record<string, string> = { VIGENTE: "Apto vigente", POR_VENCER: "Apto por vencer", VENCIDO: "Apto vencido", SIN_APTO: "Sin apto médico" };
const REASONS = ["Precio", "Mudanza", "Lesión o salud", "Horario", "No le gustó", "Falta de tiempo", "Otro"];
type Tab = "plan" | "pagos" | "asistencia" | "familia" | "datos";

function Ficha() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useVocab();
  const user = getSessionUser();
  const admin = user?.role === "ADMINISTRADOR";
  const { show, fail, node: flash } = useFlash();
  const refresh = useRefreshKey();
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("plan");
  const [modal, setModal] = useState<null | "cobrar" | "sell" | "edit" | "qr" | "baja" | "alta" | "portal" | "msg" | "anon">(null);
  const [freeze, setFreeze] = useState<MS | null>(null);
  const [endMs, setEndMs] = useState<MS | null>(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((n) => n + 1);

  useEffect(() => { appApi<Detail>(`/members/${id}`).then(setD).catch(fail); }, [id, tick, refresh, fail]);
  if (!d) return <section className="products-page"><Loading /></section>;

  const restricted = d.restricted;
  const hasBilling = canAccess(user, "membresias") && !restricted;
  const hasCobranza = canAccess(user, "cobranza") && !restricted;
  const hasSalud = canAccess(user, "salud");

  const unfreeze = async (ms: MS) => {
    try { await appApi(`/memberships/${ms.id}/unfreeze`, { method: "POST", body: {} }); show("Se descongeló"); reload(); } catch (e) { fail(e); }
  };

  return (
    <section className="products-page">
      <div className="c1-head">
        {d.photo ? <img className="c1-avatar c1-avatar-lg" src={d.photo} alt="" /> : <span className="c1-avatar c1-avatar-lg" aria-hidden="true">{(d.first_name[0] || "") + (d.last_name[0] || "")}</span>}
        <div className="c1-head-info">
          <Link to="/app/socios" className="cb-muted">← {t("members", true)}</Link>
          <h1>{d.full_name}</h1>
          <div className="cb-row" style={{ flexWrap: "wrap" }}>
            <FeeChip state={d.state.state} name={d.state.name} label={d.state.label} tone={d.state.tone} />
            {d.status !== "ACTIVO" && <Pill tone={d.status === "BAJA" ? "red" : "gray"}>{d.status === "BAJA" ? "De baja" : d.status.toLowerCase()}</Pill>}
            {!restricted && <Pill tone={APTO_TONE[d.apto.state] || "gray"}>{APTO_LABEL[d.apto.state] || d.apto.state}</Pill>}
            {d.minor && <Pill tone="violet">Menor de edad</Pill>}
            {d.debt && d.debt.total > 0 && <Pill tone="red">Debe {money(d.debt.total)}</Pill>}
            {!!d.credit_balance && d.credit_balance > 0 && <Pill tone="teal">A favor {money(d.credit_balance)}</Pill>}
          </div>
          <small className="cb-muted">DNI {d.dni}{d.age !== null ? ` · ${d.age} años` : ""}{d.category ? ` · ${d.category.name}` : ""}{d.joined_at ? ` · desde ${shortDate(d.joined_at)}` : ""}</small>
        </div>
        {!restricted && !d.anonymized && (
          <div className="c1-head-actions">
            {hasBilling && <button className="primary-button" onClick={() => setModal("cobrar")}>Cobrar</button>}
            {hasBilling && <button className="secondary-button" onClick={() => setModal("sell")}>Asignar plan</button>}
            <button className="secondary-button" onClick={() => setModal("qr")}>Carnet / QR</button>
            <button className="secondary-button" onClick={() => setModal("edit")}>Editar</button>
          </div>
        )}
      </div>

      {restricted ? (
        <div className="cb-note cb-note-info">Ves solo los datos necesarios para dar la clase: nombre, estado de cuota y apto.</div>
      ) : (
        <>
          <Tabs<Tab> value={tab} onChange={setTab} options={[["plan", "Plan y cuotas"], ["pagos", "Pagos"], ["asistencia", "Asistencia"], ["familia", "Grupo familiar"], ["datos", "Datos"]]} />
          <div style={{ marginTop: 14 }}>
            {tab === "plan" && (
              <PlanTab d={d} hasBilling={hasBilling} onFreeze={setFreeze} onEnd={setEndMs} onUnfreeze={unfreeze} onSell={() => setModal("sell")} onPay={() => setModal("cobrar")} tick={tick} />
            )}
            {tab === "pagos" && hasBilling && <PagosTab memberId={d.id} tick={tick} onChanged={reload} fail={fail} show={show} />}
            {tab === "asistencia" && <AsistenciaTab memberId={d.id} last={d.last_attendance} fail={fail} />}
            {tab === "familia" && (
              <FamiliaTab d={d} onAdd={() => setModal("alta")} onChanged={reload} fail={fail} show={show} />
            )}
            {tab === "datos" && (
              <div className="cb-stack">
                <div className="c1-two">
                  <div className="cb-card"><div className="cb-card-head"><h3>Contacto</h3></div>
                    <dl className="c1-dl">
                      <dt>Teléfono</dt><dd>{d.phone || "—"}</dd><dt>Email</dt><dd>{d.email || "—"}</dd>
                      <dt>Domicilio</dt><dd>{[d.address, d.city].filter(Boolean).join(", ") || "—"}</dd>
                      <dt>Nacimiento</dt><dd>{d.birth_date ? shortDate(d.birth_date) : "—"}</dd>
                      <dt>Origen</dt><dd>{d.source || "—"}</dd>
                    </dl>
                    {hasCobranza && d.phone && <div style={{ marginTop: 10 }}><button className="secondary-button" onClick={() => setModal("msg")}>Armar mensaje de WhatsApp</button></div>}
                  </div>
                  <div className="cb-card"><div className="cb-card-head"><h3>Emergencia y tutor</h3></div>
                    <dl className="c1-dl">
                      <dt>Emergencia</dt><dd>{d.emergency_contact_name ? `${d.emergency_contact_name} · ${d.emergency_contact_phone || ""}` : "—"}</dd>
                      <dt>Tutor</dt><dd>{d.guardian_name ? `${d.guardian_name} · DNI ${d.guardian_dni || "—"} · ${d.guardian_phone || ""}` : d.minor ? "Falta cargarlo" : "—"}</dd>
                      <dt>Apto médico</dt><dd>{d.apto.valid_until ? `hasta ${shortDate(d.apto.valid_until)}` : "Sin apto cargado"}{hasSalud && <> · <Link to="/app/salud">Ver en Salud</Link></>}</dd>
                    </dl>
                  </div>
                </div>
                {d.notes && <div className="cb-note cb-note-info"><strong>Notas:</strong> {d.notes}</div>}
                <div className="cb-card"><div className="cb-card-head"><h3>Datos personales y portal</h3></div>
                  <dl className="c1-dl">
                    <dt>Consentimiento</dt><dd>{d.consent?.at ? `Aceptado el ${dateTime(d.consent.at)}` : <Pill tone="orange">Sin registrar</Pill>}</dd>
                    <dt>Portal del socio</dt><dd>{d.portal?.has_access ? "Tiene acceso" : d.portal?.code_pending ? "Código pendiente de usar" : "Sin acceso"}</dd>
                  </dl>
                  <div className="cb-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                    {canAccess(user, "web_socio") && d.status !== "BAJA" && <button className="secondary-button" onClick={() => setModal("portal")}>Generar código del portal</button>}
                    {!d.consent?.at && <button className="secondary-button" onClick={async () => { try { await appApi(`/members/${d.id}`, { method: "PUT", body: { consent: true } }); reload(); } catch (e) { fail(e); } }}>Registrar consentimiento</button>}
                    {admin && <button className="secondary-button" onClick={() => downloadFile(`/members/${d.id}/export`, `socio-${d.dni}.json`).catch(fail)}>Descargar sus datos</button>}
                    {admin && !d.anonymized && <button className="cb-danger-button" onClick={() => setModal("anon")}>Anonimizar</button>}
                  </div>
                </div>
                <div className="cb-row">
                  {d.status === "BAJA" || d.status === "INACTIVO" ? (
                    <button className="primary-button" onClick={async () => { try { await appApi(`/members/${d.id}/status`, { method: "POST", body: { status: "ACTIVO" } }); show("Reactivado"); reload(); } catch (e) { fail(e); } }}>Reactivar</button>
                  ) : <button className="cb-danger-button" onClick={() => setModal("baja")}>Dar de baja</button>}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {modal === "cobrar" && <CobrarModal memberId={d.id} onClose={() => setModal(null)} onDone={reload} />}
      {modal === "sell" && <SellPlanModal memberId={d.id} onClose={() => setModal(null)} onDone={(url) => { setModal(null); if (url) window.open(url, "_blank", "noopener"); show("Plan asignado"); reload(); }} />}
      {modal === "edit" && <EditModal d={d} onClose={() => setModal(null)} onDone={() => { setModal(null); show("Datos guardados"); reload(); }} />}
      {modal === "qr" && d.qr_code && <QrModal d={d} onClose={() => setModal(null)} />}
      {modal === "baja" && <BajaModal d={d} onClose={() => setModal(null)} onDone={() => { setModal(null); show("Se dio de baja"); reload(); }} />}
      {modal === "alta" && <AltaModal payerId={d.id} onClose={() => setModal(null)} onCreated={(nid) => { setModal(null); navigate(`/app/socios/${nid}`); }} />}
      {modal === "portal" && <PortalModal id={d.id} onClose={() => setModal(null)} />}
      {modal === "msg" && <MsgModal id={d.id} onClose={() => setModal(null)} fail={fail} />}
      {modal === "anon" && <AnonModal d={d} onClose={() => setModal(null)} onDone={() => { setModal(null); show("Ficha anonimizada"); reload(); }} />}
      {freeze && <FreezeModal membershipId={freeze.id} planName={freeze.plan_name} onClose={() => setFreeze(null)} onDone={() => { setFreeze(null); show("Congelada"); reload(); }} />}
      {endMs && <EndMembershipModal membershipId={endMs.id} planName={endMs.plan_name} onClose={() => setEndMs(null)} onDone={() => { setEndMs(null); show("Plan dado de baja"); reload(); }} />}
      {flash}
    </section>
  );
}

function PlanTab({ d, hasBilling, onFreeze, onEnd, onUnfreeze, onSell, onPay, tick }: {
  d: Detail; hasBilling: boolean; onFreeze: (m: MS) => void; onEnd: (m: MS) => void; onUnfreeze: (m: MS) => void; onSell: () => void; onPay: () => void; tick: number;
}) {
  const [charges, setCharges] = useState<Charge[] | null>(null);
  useEffect(() => { if (hasBilling) appApi<Charge[]>(`/members/${d.id}/charges?status=open`).then(setCharges).catch(() => setCharges([])); }, [d.id, hasBilling, tick]);
  const live = (d.memberships || []).filter((m) => ["ACTIVA", "CONGELADA", "PENDIENTE_PAGO", "VENCIDA"].includes(m.status));
  const old = (d.memberships || []).filter((m) => !live.includes(m));
  return (
    <div className="cb-stack">
      {d.state.covered_by_payer && d.payer && <div className="cb-note cb-note-info">Su cuota la paga <Link to={`/app/socios/${d.payer.id}`}>{d.payer.full_name}</Link>.</div>}
      {live.length === 0 ? <Empty title="No tiene un plan vigente">{hasBilling && <button className="primary-button" onClick={onSell}>Asignar plan</button>}</Empty> : live.map((m) => (
        <div key={m.id} className="cb-card">
          <div className="cb-card-head cb-spread"><h3>{m.plan_name}</h3><FeeChip state={m.state} name={m.state_label} tone={m.state_tone} /></div>
          <dl className="c1-dl">
            <dt>Vigencia</dt><dd>{m.start_date ? shortDate(m.start_date) : "—"} a {m.end_date ? shortDate(m.end_date) : "sin fin"}</dd>
            {m.credits_total !== null && <><dt>Clases</dt><dd>{m.credits_left} de {m.credits_total}</dd></>}
            <dt>Precio</dt><dd>{m.price_agreed !== null ? money(m.price_agreed) : "El del plan"}{m.discount_pct ? ` · ${m.discount_pct}% de descuento` : ""}</dd>
            <dt>Cuota automática</dt><dd>{m.auto_renew ? "Sí" : "No"}</dd>
            {m.freeze && <><dt>Congelada</dt><dd>{shortDate(m.freeze.from_date)} al {shortDate(m.freeze.to_date)} · {m.freeze.reason}</dd></>}
          </dl>
          {hasBilling && (
            <div className="cb-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {m.freeze ? <button className="secondary-button" onClick={() => onUnfreeze(m)}>Descongelar</button> : m.status === "ACTIVA" && !["POR_CLASES", "DIARIO"].includes(m.plan_kind) && <button className="secondary-button" onClick={() => onFreeze(m)}>Congelar</button>}
              <button className="secondary-button" onClick={onPay}>Cobrar / renovar</button>
              <button className="cb-danger-button" onClick={() => onEnd(m)}>Dar de baja el plan</button>
            </div>
          )}
        </div>
      ))}
      {hasBilling && charges && charges.length > 0 && (
        <div className="cb-card"><div className="cb-card-head"><h3>Cuotas pendientes</h3></div>
          <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Concepto</th><th>Vence</th><th>Estado</th><th className="c1-num">Falta</th></tr></thead>
            <tbody>{charges.map((c) => <tr key={c.id}><td>{c.description || c.concept}</td><td>{c.due_date ? shortDate(c.due_date) : "—"}</td><td><Pill tone={c.tone}>{c.label}</Pill></td><td className="c1-num">{money(c.outstanding)}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {old.length > 0 && (
        <div className="cb-card"><div className="cb-card-head"><h3>Planes anteriores</h3></div>
          <ul className="cb-list">{old.map((m) => <li key={m.id}><div className="cb-list-main"><strong>{m.plan_name}</strong><small>{m.start_date ? shortDate(m.start_date) : ""} – {m.end_date ? shortDate(m.end_date) : ""}{m.ended_reason ? ` · ${m.ended_reason}` : ""}</small></div><Pill>{m.status.toLowerCase()}</Pill></li>)}</ul>
        </div>
      )}
    </div>
  );
}

function PagosTab({ memberId, tick, onChanged, fail, show }: { memberId: number; tick: number; onChanged: () => void; fail: (e: unknown) => void; show: (t: string) => void }) {
  const [rows, setRows] = useState<Pay[] | null>(null);
  const [voiding, setVoiding] = useState<Pay | null>(null);
  const [reason, setReason] = useState("");
  useEffect(() => { appApi<Pay[]>(`/members/${memberId}/payments`).then(setRows).catch(fail); }, [memberId, tick, fail]);
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty title="Todavía no hay pagos" />;
  const doVoid = async () => {
    if (!voiding) return;
    try { await appApi(`/payments/${voiding.id}/void`, { method: "POST", body: { reason: reason.trim() } }); setVoiding(null); setReason(""); show("Cobro anulado"); onChanged(); } catch (e) { fail(e); }
  };
  return (
    <>
      <div className="cb-table-wrap"><table className="cb-table">
        <thead><tr><th>Recibo</th><th>Fecha</th><th>Detalle</th><th>Medio</th><th className="c1-num">Importe</th><th /></tr></thead>
        <tbody>{rows.map((p) => (
          <tr key={p.id}>
            <td>{p.number_text}</td><td>{dateTime(p.paid_at)}</td><td>{p.lines.map((l) => l.description).join(", ") || "Saldo a favor"}</td>
            <td>{PAYMENT_LABELS[p.method] || p.method}</td>
            <td className="c1-num">{p.status === "OK" ? money(p.amount) : <Pill tone="gray">Anulado</Pill>}{p.refund_pending && <Pill tone="orange">A devolver</Pill>}</td>
            <td className="c1-num"><a href={`/print/recibo/${p.id}`} target="_blank" rel="noreferrer">Recibo</a>{p.status === "OK" && <> · <button type="button" className="cb-link-danger" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }} onClick={() => setVoiding(p)}>Anular</button></>}</td>
          </tr>))}</tbody></table></div>
      {voiding && (
        <Modal title={`Anular recibo ${voiding.number_text}`} onClose={() => setVoiding(null)}
          footer={<><button className="secondary-button" onClick={() => setVoiding(null)}>Cancelar</button><button className="cb-danger-button" disabled={reason.trim().length < 3} onClick={doVoid}>Anular cobro</button></>}>
          <div className="product-form"><Field label="Motivo"><input value={reason} autoFocus onChange={(e) => setReason(e.target.value)} /></Field>
            <p className="cb-muted">Las cuotas que cubría vuelven a quedar pendientes y el plan vuelve a su fecha anterior.</p></div>
        </Modal>
      )}
    </>
  );
}

function AsistenciaTab({ memberId, last, fail }: { memberId: number; last?: string | null; fail: (e: unknown) => void }) {
  const [rows, setRows] = useState<Att[] | null>(null);
  useEffect(() => { appApi<Att[]>(`/members/${memberId}/attendance`).then(setRows).catch(fail); }, [memberId, fail]);
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty title="Todavía no registró asistencias" />;
  return (
    <div className="cb-stack">
      {last && <span className="cb-muted">Última visita: {dateTime(last)}</span>}
      <div className="cb-table-wrap"><table className="cb-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Origen</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id}><td>{dateTime(a.at)}</td><td>{a.kind === "CLASE" ? "Clase" : a.kind === "ACCESO" ? "Ingreso" : a.kind}</td><td>{a.source}</td></tr>)}</tbody></table></div>
    </div>
  );
}

function FamiliaTab({ d, onAdd, onChanged, fail, show }: { d: Detail; onAdd: () => void; onChanged: () => void; fail: (e: unknown) => void; show: (t: string) => void }) {
  const [pick, setPick] = useState<PickedMember | null>(null);
  const call = useCallback(async (body: { add?: number[]; remove?: number[] }, msg: string) => {
    try { await appApi(`/members/${d.id}/family`, { method: "POST", body }); show(msg); setPick(null); onChanged(); } catch (e) { fail(e); }
  }, [d.id, fail, show, onChanged]);
  if (d.payer) return <div className="cb-note cb-note-info">Depende de <Link to={`/app/socios/${d.payer.id}`}>{d.payer.full_name}</Link>, que paga la cuota del grupo.</div>;
  return (
    <div className="cb-stack">
      {(d.dependents || []).length === 0 ? <Empty title="No tiene personas a cargo" /> : (
        <ul className="cb-list">{(d.dependents || []).map((x) => (
          <li key={x.id}><div className="cb-list-main"><Link to={`/app/socios/${x.id}`}><strong>{x.full_name}</strong></Link></div>
            <Pill tone={x.tone}>{x.state_label}</Pill>
            <button className="secondary-button" onClick={() => call({ remove: [x.id] }, "Se desvinculó")}>Quitar</button></li>))}</ul>
      )}
      <div className="cb-card"><div className="cb-card-head"><h3>Sumar al grupo</h3></div>
        <MemberPicker value={pick} onChange={setPick} placeholder="Buscar a quien se suma al grupo" />
        <div className="cb-row" style={{ marginTop: 10 }}>
          <button className="primary-button" disabled={!pick} onClick={() => pick && call({ add: [pick.id] }, "Se sumó al grupo")}>Sumar</button>
          <button className="secondary-button" onClick={onAdd}>Crear persona nueva en el grupo</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ d, onClose, onDone }: { d: Detail; onClose: () => void; onDone: () => void }) {
  const { form, set } = useForm({
    first_name: d.first_name, last_name: d.last_name, dni: d.dni, birth_date: d.birth_date || "", phone: d.phone || "", email: d.email || "", address: d.address || "", city: d.city || "",
    emergency_contact_name: d.emergency_contact_name || "", emergency_contact_phone: d.emergency_contact_phone || "",
    guardian_name: d.guardian_name || "", guardian_dni: d.guardian_dni || "", guardian_phone: d.guardian_phone || "", notes: d.notes || "",
  });
  const [photo, setPhoto] = useState<string | null>(d.photo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    const body: Record<string, unknown> = { ...form };
    for (const k of Object.keys(body)) if (body[k] === "" && !["first_name", "last_name", "dni"].includes(k)) body[k] = null;
    if (photo !== d.photo) { if (photo) body.photo_data = photo; else body.remove_photo = true; }
    try { await appApi(`/members/${d.id}`, { method: "PUT", body }); onDone(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  };
  const f = (k: keyof typeof form, label: string, type = "text") => <Field label={label}><input type={type} value={form[k]} onChange={(e) => set(k, e.target.value)} /></Field>;
  return (
    <Modal title="Editar datos" onClose={onClose} size="wide" footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <Field label="Foto"><PhotoInput value={photo} onChange={setPhoto} /></Field>
        <div className="form-row">{f("first_name", "Nombre")}{f("last_name", "Apellido")}</div>
        <div className="form-row">{f("dni", "DNI")}{f("birth_date", "Fecha de nacimiento", "date")}</div>
        <div className="form-row">{f("phone", "Teléfono")}{f("email", "Email", "email")}</div>
        <div className="form-row">{f("address", "Domicilio")}{f("city", "Localidad")}</div>
        <div className="form-row">{f("emergency_contact_name", "Contacto de emergencia")}{f("emergency_contact_phone", "Teléfono de emergencia")}</div>
        <div className="form-row">{f("guardian_name", "Tutor")}{f("guardian_dni", "DNI del tutor")}{f("guardian_phone", "Teléfono del tutor")}</div>
        <Field label="Notas" wide><textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function QrModal({ d, onClose }: { d: Detail; onClose: () => void }) {
  return (
    <Modal title="Carnet y código QR" onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button" onClick={() => window.open(`/print/carnets?ids=${d.id}`, "_blank", "noopener")}>Imprimir carnet</button></>}>
      <div className="cb-stack" style={{ alignItems: "center", textAlign: "center" }}>
        <QrCode value={d.qr_code || ""} size={220} label={`QR de ${d.full_name}`} />
        <strong>{d.full_name}</strong>
        <small className="cb-muted">Se lee en el kiosco o en la entrada. Si no tiene celular, tiene el carnet impreso o dice el DNI.</small>
      </div>
    </Modal>
  );
}

function BajaModal({ d, onClose, onDone }: { d: Detail; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    try { await appApi(`/members/${d.id}/status`, { method: "POST", body: { status: "BAJA", reason, note: note.trim() || null } }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo"); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Dar de baja a ${d.full_name}`} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="cb-danger-button" disabled={busy || !reason} onClick={go}>Dar de baja</button></>}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <Field label="Motivo"><select value={reason} onChange={(e) => setReason(e.target.value)} autoFocus><option value="">Elegí el motivo</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Comentario (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="cb-muted">Se cortan sus planes y se anulan las cuotas futuras sin pagar. La deuda vencida se conserva. Puede seguir entrando hasta que termine lo que ya pagó.</p>
      </div>
    </Modal>
  );
}

function PortalModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [res, setRes] = useState<{ code: string; expires_at: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { appApi<{ code: string; expires_at: string }>(`/members/${id}/portal-code`, { method: "POST" }).then(setRes).catch((e) => setError(e.message)); }, [id]);
  return (
    <Modal title="Código del portal" onClose={onClose} footer={<button className="secondary-button" onClick={onClose}>Cerrar</button>}>
      {error ? <div className="cb-note cb-note-error">{error}</div> : !res ? <Loading /> : (
        <div className="cb-stack" style={{ textAlign: "center" }}>
          <strong style={{ fontSize: 34, letterSpacing: 6 }}>{res.code}</strong>
          <p className="cb-muted">Pasáselo a la persona: lo usa una sola vez junto con su DNI, hasta el {shortDate(res.expires_at)}. No se vuelve a mostrar.</p>
        </div>
      )}
    </Modal>
  );
}

function MsgModal({ id, onClose, fail }: { id: number; onClose: () => void; fail: (e: unknown) => void }) {
  const [res, setRes] = useState<{ text: string; wa_url: string | null; mailto: string | null } | null>(null);
  useEffect(() => { appApi(`/collections/members/${id}/message`, { method: "POST", body: {} }).then(setRes).catch((e) => { fail(e); onClose(); }); }, [id, fail, onClose]);
  return (
    <Modal title="Mensaje listo" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cerrar</button>
      {res?.wa_url && <a className="primary-button" href={res.wa_url} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}</>}>
      {!res ? <Loading /> : <div className="c1-msg">{res.text}</div>}
    </Modal>
  );
}

function AnonModal({ d, onClose, onDone }: { d: Detail; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [dni, setDni] = useState("");
  const [error, setError] = useState("");
  const go = async () => {
    try { await appApi(`/members/${d.id}/anonymize`, { method: "POST", body: { reason, confirm_dni: dni } }); onDone(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo"); }
  };
  return (
    <Modal title="Anonimizar ficha" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="cb-danger-button" disabled={reason.trim().length < 3 || !dni} onClick={go}>Anonimizar</button></>}>
      <div className="product-form">
        {error && <div className="cb-note cb-note-error">{error}</div>}
        <div className="cb-note cb-note-warn">Se borran sus datos personales y no se puede deshacer. Los pagos y recibos se conservan sin su nombre.</div>
        <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Field label="Escribí su DNI para confirmar"><input value={dni} onChange={(e) => setDni(e.target.value)} placeholder={d.dni} /></Field>
      </div>
    </Modal>
  );
}

export default Ficha;
