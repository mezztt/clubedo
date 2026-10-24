import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, dayKey, dateTime, getSessionUser, hhmm, useVocab } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, Tabs, useFlash } from "../../../components/ui";
import Icon from "../../../components/Icons";
import QrCode from "../../../components/QrCode";
import { AptoPill, MemberPicker, Stat, useTab } from "../../../components/c2/shared";
import "../../../c2.css";

interface EventRow {
  id: number; at: string; member_id: number | null; member_name: string | null; method: string; result: string; direction: string;
  reason_code: string | null; reason_label: string | null; override_reason: string | null; override_by: string | null; offline: boolean;
}
interface Events { date: string | null; items: EventRow[]; summary: { ok: number; aviso: number; denegados: number; salidas: number } }
interface Lookup {
  found: boolean; result: string; reason_code: string | null; reason_label: string | null; warnings: string[];
  member: null | { id: number; name: string; dni: string; plan: string | null; ends_on: string | null; status: string; fee_label: string; apto: string };
}
interface Card { id: number; full_name: string; dni: string; status: string; qr: string }

const RESULT_TEXT: Record<string, string> = { OK: "Pasó", OK_AVISO: "Pasó con aviso", DENEGADO: "No pasó" };
const RESULT_TONE: Record<string, string> = { OK: "green", OK_AVISO: "orange", DENEGADO: "red" };

type TabKey = "hoy" | "verificar" | "adentro" | "carnets";

function Index() {
  const { t } = useVocab();
  const user = getSessionUser();
  const isInstructor = user?.role === "INSTRUCTOR";
  const [tab, setTab] = useTab<TabKey>(["hoy", "verificar", "adentro", "carnets"], isInstructor ? "adentro" : "hoy");
  const { show, fail, node: flash } = useFlash();
  const tabs: [TabKey, string][] = isInstructor ? [["adentro", "Aforo"]] : [["hoy", "Ingresos de hoy"], ["verificar", "Verificar"], ["adentro", "Aforo"], ["carnets", `Carnets QR`]];
  return (
    <section className="products-page">
      <PageHeader eyebrow="CONTROL DE ACCESO" title="Acceso"
        subtitle={`Quién entró, quién está adentro y el kiosco para que cada ${t("member")} se identifique solo.`}>
        {!isInstructor && <button className="primary-button" onClick={() => window.open("/kiosco", "_blank", "noopener")}>Abrir kiosco</button>}
      </PageHeader>
      <Tabs value={isInstructor ? "adentro" : tab} onChange={setTab} options={tabs} />
      {(isInstructor || tab === "adentro") ? <Inside readOnly={!!isInstructor} fail={fail} show={show} /> :
        tab === "hoy" ? <Today fail={fail} /> :
        tab === "verificar" ? <Verify fail={fail} show={show} memberWord={t("member")} /> :
        <Cards fail={fail} show={show} memberWord={t("member")} />}
      {flash}
    </section>
  );
}

// ---------------------------------------------------------------- ingresos del día
function Today({ fail }: { fail: (e: unknown) => void }) {
  const [date, setDate] = useState(dayKey(new Date()));
  const [only, setOnly] = useState<"TODOS" | "DENEGADO">("TODOS");
  const [data, setData] = useState<Events | null>(null);
  const load = useCallback(() => {
    appApi<Events>(`/access/events?date=${date}${only === "DENEGADO" ? "&result=DENEGADO" : ""}`).then(setData).catch(fail);
  }, [date, only, fail]);
  useEffect(() => { setData(null); load(); }, [load]);
  return (
    <>
      <div className="c2-toolbar">
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Día" />
        <Seg value={only} onChange={setOnly} options={[["TODOS", "Todos"], ["DENEGADO", "Solo los que no pasaron"]]} />
        <button className="secondary-button" onClick={load}>Actualizar</button>
      </div>
      {!data ? <Loading /> : (
        <>
          <div className="c2-grid-kpi">
            <Stat label="Pasaron" value={data.summary.ok} tone="green" />
            <Stat label="Pasaron con aviso" value={data.summary.aviso} tone="orange" />
            <Stat label="No pasaron" value={data.summary.denegados} tone={data.summary.denegados ? "red" : undefined} />
            <Stat label="Salidas" value={data.summary.salidas} />
          </div>
          {data.items.length === 0 ? <Empty title="Todavía no hay ingresos en este día">Cuando alguien se identifique en el kiosco o en recepción, aparece acá.</Empty> : (
            <div className="cb-table-wrap">
              <table className="cb-table">
                <thead><tr><th>Hora</th><th>Persona</th><th>Cómo</th><th>Resultado</th><th>Detalle</th></tr></thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id}>
                      <td>{hhmm(e.at)}</td>
                      <td><strong>{e.member_name || "No identificada"}</strong></td>
                      <td>{e.direction === "OUT" ? "Salida" : e.method === "QR" ? "Código QR" : e.method === "DNI" ? "DNI" : "Manual"}{e.offline && <small>Sin internet</small>}</td>
                      <td>{e.direction === "OUT" ? <Pill tone="gray">Salió</Pill> : <Pill tone={RESULT_TONE[e.result]}>{RESULT_TEXT[e.result] || e.result}</Pill>}</td>
                      <td>{e.override_reason ? <>Ingreso excepcional: {e.override_reason}<small>Autorizó {e.override_by}</small></> : e.reason_label || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- verificar en recepción
function Verify({ fail, show, memberWord }: { fail: (e: unknown) => void; show: (s: string) => void; memberWord: string }) {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(false);

  async function lookup(c: string) {
    if (!c.trim()) return;
    setBusy(true);
    try { setRes(await appApi<Lookup>("/access/lookup", { method: "POST", body: { code: c.trim() } })); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function register() {
    if (!res?.member) return;
    setBusy(true);
    try {
      const r = await appApi<{ result: string }>("/access/check", { method: "POST", body: { code: res.member.dni || code } });
      show(r.result === "DENEGADO" ? "No se registró: sigue sin poder pasar" : "Ingreso registrado"); setRes(null); setCode("");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  const tone = !res ? "" : res.result === "OK" ? "is-ok" : res.result === "OK_AVISO" ? "is-warn" : "is-no";
  return (
    <div className="c2-two">
      <div className="cb-card c2-stack">
        <div className="cb-card-head"><div><h2>Buscar</h2><p>Escribí o escaneá el DNI o el código QR del carnet. También podés buscar por nombre.</p></div></div>
        <form className="c2-toolbar" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
          <input className="c2-grow" value={code} onChange={(e) => setCode(e.target.value)} placeholder="DNI o código" aria-label="DNI o código" autoFocus />
          <button className="primary-button" disabled={busy || !code.trim()}>Verificar</button>
        </form>
        <MemberPicker endpoint={(q) => `/access/cards?q=${encodeURIComponent(q)}&status=TODOS&limit=8`}
          map={(r) => ({ id: r.id, name: r.full_name, dni: r.dni })} onPick={(m) => { setCode(m.dni || ""); lookup(m.dni || ""); }}
          placeholder={`Buscar ${memberWord} por nombre`} />
      </div>
      <div className="cb-card c2-stack">
        {!res ? <Empty title="Todavía no verificaste a nadie">El resultado aparece acá, con el motivo si no puede pasar.</Empty> : (
          <>
            <div className={`c2-semaforo ${tone}`} role="status">
              <Icon name={res.result === "DENEGADO" ? "close" : "scan"} size={34} />
              <div>
                <strong>{res.result === "OK" ? "Puede pasar" : res.result === "OK_AVISO" ? "Puede pasar, con aviso" : "No puede pasar"}</strong>
                <span>{res.reason_label || (res.found ? "Todo en orden" : "No se encontró ese código o DNI")}</span>
              </div>
            </div>
            {res.member && (
              <div className="cb-detail-grid">
                <div><small>Nombre</small><strong>{res.member.name}</strong></div>
                <div><small>DNI</small><strong>{res.member.dni}</strong></div>
                <div><small>Plan</small><strong>{res.member.plan || "Sin plan"}</strong></div>
                <div><small>Cuota</small><strong>{res.member.fee_label}</strong></div>
                <div><small>Apto médico</small><AptoPill state={res.member.apto} /></div>
                <div><small>Vence</small><strong>{res.member.ends_on ? dateTime(res.member.ends_on).split(" ")[0] : "-"}</strong></div>
              </div>
            )}
            {res.warnings.map((w, i) => <div key={i} className="cb-note cb-note-warn">{w}</div>)}
            {res.member && (
              <div className="c2-actions">
                {res.result !== "DENEGADO" && <button className="primary-button" disabled={busy} onClick={register}>Registrar ingreso</button>}
                {res.result === "DENEGADO" && <button className="secondary-button" onClick={() => setOverride(true)}>Ingreso excepcional</button>}
              </div>
            )}
          </>
        )}
      </div>
      {override && res?.member && <Override member={{ id: res.member.id, name: res.member.name }} reasonCode={res.reason_code}
        onClose={() => setOverride(false)} onDone={() => { setOverride(false); setRes(null); setCode(""); show("Ingreso excepcional registrado"); }} fail={fail} />}
    </div>
  );
}

function Override({ member, reasonCode, onClose, onDone, fail }: {
  member: { id: number; name: string }; reasonCode: string | null; onClose: () => void; onDone: () => void; fail: (e: unknown) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (reason.trim().length < 3) { fail(new Error("Escribí el motivo (mínimo 3 letras)")); return; }
    setSaving(true);
    try { await appApi("/access/override", { method: "POST", body: { member_id: member.id, reason: reason.trim(), reason_code: reasonCode } }); onDone(); }
    catch (e) { fail(e); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="INGRESO EXCEPCIONAL" title={member.name} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Dejar pasar"}</button></>}>
      <div className="product-form">
        <div className="cb-note cb-note-warn">Queda registrado con tu nombre y el motivo. No cambia el estado de la cuota.</div>
        <Field label="Motivo"><textarea rows={3} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Ej: pagó en efectivo y lo carga caja" /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- aforo
function Inside({ readOnly, fail, show }: { readOnly: boolean; fail: (e: unknown) => void; show: (s: string) => void }) {
  const [data, setData] = useState<{ count: number; capacity: number | null; items?: { member_id: number; name: string; since: string }[] } | null>(null);
  const load = useCallback(() => { appApi("/access/inside").then(setData).catch(fail); }, [fail]);
  useEffect(() => { load(); const h = window.setInterval(load, 30000); return () => window.clearInterval(h); }, [load]);
  async function out(id: number) {
    try { await appApi("/access/exit", { method: "POST", body: { member_id: id } }); show("Salida registrada"); load(); } catch (e) { fail(e); }
  }
  if (!data) return <Loading />;
  const cap = data.capacity || 0;
  const pct = cap ? Math.min(100, Math.round((data.count / cap) * 100)) : 0;
  return (
    <div className="c2-stack">
      <div className="cb-card">
        <div className="cb-card-head"><div><h2>{data.count} adentro{cap ? ` de ${cap}` : ""}</h2><p>{cap ? "Aforo máximo configurado." : "No hay aforo máximo configurado."} Se actualiza solo cada 30 segundos.</p></div></div>
        {cap > 0 && <div className={`c2-inside-bar ${pct >= 100 ? "is-full" : ""}`} role="img" aria-label={`${pct}% del aforo`}><i style={{ width: `${pct}%` }} /></div>}
      </div>
      {!readOnly && (data.items && data.items.length ? (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Persona</th><th>Entró</th><th></th></tr></thead>
          <tbody>{data.items.map((i) => (
            <tr key={i.member_id}><td><strong>{i.name}</strong></td><td>{hhmm(i.since)}</td>
              <td style={{ textAlign: "right" }}><button className="secondary-button c2-small-btn" onClick={() => out(i.member_id)}>Registrar salida</button></td></tr>
          ))}</tbody></table></div>
      ) : <Empty title="No hay nadie adentro ahora" />)}
    </div>
  );
}

// ---------------------------------------------------------------- carnets
function Cards({ fail, show, memberWord }: { fail: (e: unknown) => void; show: (s: string) => void; memberWord: string }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ total: number; items: Card[] } | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [qr, setQr] = useState<Card | null>(null);
  const load = useCallback(() => {
    appApi(`/access/cards?limit=48&q=${encodeURIComponent(q)}`).then(setData).catch(fail);
  }, [q, fail]);
  useEffect(() => { const h = window.setTimeout(load, 250); return () => window.clearTimeout(h); }, [load]);
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = useMemo(() => [...picked].join(","), [picked]);
  async function regen(c: Card) {
    if (!window.confirm(`El código actual de ${c.full_name} va a dejar de servir. ¿Generar uno nuevo?`)) return;
    try { const n = await appApi<Card>(`/access/cards/${c.id}/regenerate`, { method: "POST" }); setQr(n); show("Código nuevo generado"); load(); } catch (e) { fail(e); }
  }
  return (
    <>
      <div className="c2-toolbar">
        <input type="search" className="c2-grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${memberWord} por nombre o DNI`} aria-label="Buscar" />
        <button className="primary-button" onClick={() => window.open(picked.size ? `/print/carnets?ids=${ids}` : "/print/carnets?all=1", "_blank", "noopener")}>
          {picked.size ? `Imprimir ${picked.size} carnet${picked.size > 1 ? "s" : ""}` : "Imprimir todos los carnets"}</button>
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title="No hay personas para mostrar" /> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th></th><th>Persona</th><th>DNI</th><th></th></tr></thead>
          <tbody>{data.items.map((c) => (
            <tr key={c.id}>
              <td><input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Elegir a ${c.full_name}`} /></td>
              <td><strong>{c.full_name}</strong>{c.status !== "ACTIVO" && <small>{c.status === "BAJA" ? "De baja" : "Inactivo"}</small>}</td>
              <td>{c.dni}</td>
              <td style={{ textAlign: "right" }}><button className="secondary-button c2-small-btn" onClick={() => setQr(c)}>Ver QR</button></td>
            </tr>))}</tbody></table></div>
      )}
      {data && data.total > data.items.length && <p className="cb-muted">Mostrando {data.items.length} de {data.total}. Usá el buscador para encontrar a alguien puntual.</p>}
      {qr && (
        <Modal eyebrow="CARNET" title={qr.full_name} onClose={() => setQr(null)}
          footer={<><button className="secondary-button" onClick={() => regen(qr)}>Carnet perdido: código nuevo</button><button className="primary-button" onClick={() => setQr(null)}>Cerrar</button></>}>
          <div style={{ display: "grid", placeItems: "center", gap: 10, padding: 8 }}>
            <QrCode value={qr.qr} size={220} label={`QR de ${qr.full_name}`} />
            <small className="cb-muted">DNI {qr.dni}. Este código es como una llave: no lo compartas.</small>
          </div>
        </Modal>
      )}
    </>
  );
}

export default Index;
