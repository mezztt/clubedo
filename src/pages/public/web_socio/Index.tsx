import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { dateTime, money, shortDate } from "../../../config";
import { ClubedoLogo, PoweredBy, useLightPage } from "../../../components/Brand";
import QrCode from "../../../components/QrCode";
import Tour from "../../../components/tour/Tour";
import { portalTourSteps } from "../../../components/tour/steps";
import { SessionExpired, getPortalToken, portalApi, setPortalToken } from "../../../components/web_socio/portalApi";
import "../../../c3.css";

interface Me {
  id: number; first_name: string; last_name: string; dni: string; email: string | null; phone: string | null; address: string | null; status: string; club: { name: string; slug: string; rubro: string }; vocab: Record<string, string>; modules: string[];
  plan: { name: string | null; kind: string | null; credits_left: number | null; credits_expire_on: string | null };
  fee: { state: string; label: string; days: number | null; expires_on: string | null; covered_by_payer: boolean };
  debt: { total: number; overdue: number; count: number }; apto: { state: string } | null; qr: string;
  announcements: { id: number; title: string; body: string | null }[]; mp_enabled: boolean; cancel_window_hours: number;
}

const STATE_TONE: Record<string, string> = { ACTIVA: "green", POR_VENCER: "orange", EN_GRACIA: "orange", MOROSA: "red", VENCIDA: "red", CONGELADA: "gray", SIN_CLASES: "red", SIN_PLAN: "gray", PENDIENTE_PAGO: "orange", BAJA: "gray" };
const APTO_LABEL: Record<string, string> = { VIGENTE: "Apto médico al día", POR_VENCER: "Tu apto médico está por vencer", VENCIDO: "Tu apto médico venció", SIN_APTO: "Todavía no tenés apto médico cargado" };
const SECTIONS: [string, string][] = [["", "Inicio"], ["reservas", "Reservas"], ["pagos", "Pagos"], ["entrenamiento", "Entrenamiento"], ["perfil", "Mis datos"]];

/** Portal del socio: /c/:slug/socio/*. Entra con DNI y clave (la primera vez, con el código que da el club). */
function Index() {
  useLightPage();
  const { slug = "" } = useParams();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [logged, setLogged] = useState(!!getPortalToken(slug));
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const base = `/c/${slug}/socio`;
  const sub = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+|\/+$/g, "").split("/")[0] : "";

  const load = useCallback(() => {
    portalApi<Me>(slug, "/portal/me").then((m) => { setMe(m); setError(""); }).catch((e) => {
      if (e instanceof SessionExpired) { setLogged(false); setMe(null); } else setError(e.message);
    });
  }, [slug]);
  useEffect(() => { if (logged) load(); }, [logged, load]);
  useEffect(() => { document.title = me ? `Mi portal · ${me.club.name}` : "Mi portal"; }, [me]);

  const tour = useMemo(() => (me ? portalTourSteps().filter((s) => (s.selector?.includes("reservas") ? me.modules.includes("clases") : s.selector?.includes("pagos") ? me.modules.includes("membresias") || me.debt.count > 0 : true)) : []), [me]);

  function logout() { setPortalToken(slug, ""); setLogged(false); setMe(null); nav(base); }

  return (
    <div className="cw-page">
      <header className="cw-hero"><div className="cw-wrap">
        <div className="cw-top"><ClubedoLogo size={40} /><div><strong>{me?.club.name || "Mi portal"}</strong><small>{me ? `Hola, ${me.first_name}` : "Portal del socio"}</small></div>
          {logged && <button className="cw-btn cw-btn-ghost pw-mini" style={{ marginLeft: "auto" }} onClick={logout}>Salir</button>}</div>
        <h1>{me ? `Hola, ${me.first_name}` : "Mi portal"}</h1>
        {!me && <p>Tu cuota, tus clases y tu QR en un solo lugar.</p>}
      </div></header>
      <main className="cw-wrap cw-main">
        {!logged ? <Auth slug={slug} onIn={() => setLogged(true)} /> : !me ? <div className="cw-card">{error ? <div className="cw-error">{error}</div> : <p>Cargando...</p>}</div> : (
          <>
            <nav className="pw-nav" aria-label="Secciones">
              {SECTIONS.filter(([k]) => (k === "reservas" ? me.modules.includes("clases") : k === "pagos" ? me.modules.includes("membresias") || me.debt.count > 0 : k === "entrenamiento" ? me.modules.includes("entrenamiento") : true))
                .map(([k, l]) => <button key={k} data-tour={`portal-${k || "inicio"}`} className={sub === k ? "is-on" : ""} onClick={() => nav(k ? `${base}/${k}` : base)}>{l}</button>)}
            </nav>
            {sub === "reservas" ? <Bookings slug={slug} me={me} onChange={load} /> : sub === "pagos" ? <Payments slug={slug} me={me} onChange={load} /> : sub === "entrenamiento" ? <Training slug={slug} /> : sub === "perfil" ? <Profile slug={slug} me={me} onChange={load} /> : <Home me={me} slug={slug} />}
          </>)}
      </main>
      {me && !sub && tour.length > 0 && <Tour steps={tour} storageKey={`clubedo_portal_${slug}`} />}
      <footer className="cw-foot"><div className="pw-foot-links"><Link to={`/c/${slug}`}>Página del club</Link><Link to={`/c/${slug}/condiciones`}>Condiciones</Link><Link to="/legal/privacidad">Privacidad</Link></div><PoweredBy /></footer>
    </div>
  );
}

// ------------------------------------------------------------ ingreso
function Auth({ slug, onIn }: { slug: string; onIn: () => void }) {
  const [mode, setMode] = useState<"login" | "activate">("login");
  const [dni, setDni] = useState("");
  const [pass, setPass] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const body = mode === "login" ? { slug, dni, password: pass } : { slug, dni, code, password: pass };
      const r = await portalApi<{ access_token: string }>(slug, mode === "login" ? "/portal/login" : "/portal/activate", { method: "POST", body, auth: false });
      setPortalToken(slug, r.access_token); onIn();
    } catch (x) { setError(x instanceof Error ? x.message : "No pudimos ingresar"); } finally { setBusy(false); }
  }
  return (
    <div className="cw-card">
      <div className="pw-nav" role="tablist"><button type="button" className={mode === "login" ? "is-on" : ""} onClick={() => { setMode("login"); setError(""); }}>Ya tengo clave</button><button type="button" className={mode === "activate" ? "is-on" : ""} onClick={() => { setMode("activate"); setError(""); }}>Primera vez</button></div>
      <form onSubmit={submit} noValidate>
        {mode === "activate" && <p style={{ color: "#565c76", fontSize: 14 }}>Pedile al club tu código de activación de 6 números (dura 7 días y sirve una sola vez) y elegí una clave.</p>}
        {error && <div className="cw-error" role="alert">{error}</div>}
        <div className="cw-field"><label htmlFor="pa-dni">Tu DNI</label><input id="pa-dni" inputMode="numeric" autoComplete="username" value={dni} onChange={(e) => setDni(e.target.value)} /></div>
        {mode === "activate" && <div className="cw-field"><label htmlFor="pa-code">Código de activación</label><input id="pa-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></div>}
        <div className="cw-field"><label htmlFor="pa-pass">{mode === "activate" ? "Elegí una clave (mínimo 8 caracteres)" : "Tu clave"}</label><input id="pa-pass" type="password" autoComplete={mode === "activate" ? "new-password" : "current-password"} value={pass} onChange={(e) => setPass(e.target.value)} /></div>
        <button className="cw-btn" type="submit" disabled={busy || !dni || !pass || (mode === "activate" && code.length !== 6)}>{busy ? "Ingresando..." : mode === "activate" ? "Activar y entrar" : "Entrar"}</button>
        {mode === "login" && <p style={{ color: "#565c76", fontSize: 13 }}>¿Te olvidaste la clave? Pedile al club un código nuevo y usá «Primera vez».</p>}
      </form>
    </div>
  );
}

// ------------------------------------------------------------ inicio
function Home({ me, slug }: { me: Me; slug: string }) {
  const [full, setFull] = useState(false);
  const tone = STATE_TONE[me.fee.state] || "gray";
  return (
    <>
      {me.announcements.map((a) => <div className="pw-ann" key={a.id}><strong>{a.title}</strong>{a.body}</div>)}
      <section className="cw-card">
        <div className="cb-spread"><h2>Mi cuota</h2><span className={`pw-state is-${tone}`}>{me.fee.label}</span></div>
        <div className="cw-detail">
          <div><span>Plan</span><strong>{me.plan.name || "Sin plan"}</strong></div>
          {me.fee.expires_on && <div><span>Vence</span><strong>{shortDate(me.fee.expires_on)}</strong></div>}
          {me.plan.kind === "POR_CLASES" && me.plan.credits_left !== null && <div><span>Clases que te quedan</span><strong>{me.plan.credits_left}</strong></div>}
          {me.debt.total > 0 && <div><span>Debés</span><strong>{money(me.debt.total)}</strong></div>}
          {me.apto && <div><span>Apto médico</span><strong>{APTO_LABEL[me.apto.state] || me.apto.state}</strong></div>}
        </div>
        {me.debt.total > 0 && <Link className="cw-btn" to={`/c/${slug}/socio/pagos`}>Ver y pagar mi cuota</Link>}
      </section>
      <section className="cw-card" data-tour="portal-qr">
        <h2>Mi QR</h2><p>Mostralo en la entrada para ingresar.</p>
        <button className="pw-qr" style={{ border: 0, background: "none", width: "100%", cursor: "pointer" }} onClick={() => setFull(true)} aria-label="Agrandar mi QR">
          <span className="pw-qr-box"><QrCode value={me.qr} size={200} label="Mi código QR de ingreso" /></span><small style={{ color: "#565c76" }}>Tocalo para verlo en pantalla completa</small>
        </button>
      </section>
      {full && (
        <div className="pw-qr-full" role="dialog" aria-modal="true" aria-label="Mi QR">
          <div className="pw-qr-box"><QrCode value={me.qr} size={Math.min(320, window.innerWidth - 80)} label="Mi código QR de ingreso" /></div>
          <strong style={{ fontSize: 20 }}>{me.first_name} {me.last_name}</strong>
          <button className="cw-btn" onClick={() => setFull(false)}>Cerrar</button>
        </div>)}
    </>
  );
}

// ------------------------------------------------------------ reservas
interface Sess { id: number; activity: string; color: string; starts_at: string; ends_at: string; space: string | null; instructor: string | null; capacity: number; spots_left: number; full: boolean; booking: { id: number; status: string; waitlist_position: number | null } | null }

function Bookings({ slug, me, onChange }: { slug: string; me: Me; onChange: () => void }) {
  const [week, setWeek] = useState("");
  const [data, setData] = useState<{ available: boolean; week_start: string; week_end: string; sessions: Sess[] } | null>(null);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => { portalApi(slug, `/portal/schedule${week ? `?week=${week}` : ""}`).then(setData).catch((e) => setMsg({ text: e.message, err: true })); }, [slug, week]);
  useEffect(load, [load]);

  async function act(s: Sess) {
    setBusy(s.id); setMsg(null);
    try {
      const r = s.booking ? await portalApi(slug, `/portal/bookings/${s.booking.id}/cancel`, { method: "POST" }) : await portalApi(slug, "/portal/bookings", { method: "POST", body: { session_id: s.id } });
      setMsg({ text: r.message, err: false }); load(); onChange();
    } catch (e) { setMsg({ text: e instanceof Error ? e.message : "No se pudo", err: true }); } finally { setBusy(null); }
  }
  function shift(n: number) {
    const d = data ? new Date(data.week_start + "T12:00:00") : new Date();
    d.setDate(d.getDate() + n * 7);
    setWeek(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  const byDay: Record<string, Sess[]> = {};
  (data?.sessions || []).forEach((s) => { (byDay[s.starts_at.slice(0, 10)] ||= []).push(s); });
  return (
    <section className="cw-card"><h2>Reservar {me.vocab.sessions || "clases"}</h2>
      <p>Cancelá con al menos {me.cancel_window_hours} {me.cancel_window_hours === 1 ? "hora" : "horas"} de anticipación para no perder el crédito.</p>
      {msg && <div className={msg.err ? "cw-error" : "cw-msg"} role="status">{msg.text}</div>}
      <div className="cb-row" style={{ marginBottom: 10 }}><button className="cw-btn cw-btn-ghost pw-mini" onClick={() => shift(-1)}>← Semana anterior</button><button className="cw-btn cw-btn-ghost pw-mini" onClick={() => shift(1)}>Semana siguiente →</button></div>
      {!data ? <p>Cargando...</p> : !data.available ? <p>Este club no tiene reservas online.</p> : data.sessions.length === 0 ? <p>No hay clases para reservar esta semana.</p> : Object.entries(byDay).map(([day, list]) => (
        <div className="pw-day" key={day}><h3>{new Date(day + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</h3>
          {list.map((s) => (
            <div className="pw-class" key={s.id}><i style={{ background: s.color }} />
              <div><strong>{s.activity}</strong><small>{dateTime(s.starts_at).slice(-5)} a {dateTime(s.ends_at).slice(-5)}{s.instructor ? ` · ${s.instructor}` : ""}{s.space ? ` · ${s.space}` : ""}</small>
                <small>{s.booking ? (s.booking.status === "LISTA_ESPERA" ? `En lista de espera (lugar ${s.booking.waitlist_position})` : s.booking.status === "ASISTIO" ? "Asististe" : "Tenés lugar") : s.full ? "Completa: podés anotarte en la lista de espera" : `Quedan ${s.spots_left} lugares`}</small></div>
              {s.booking?.status === "ASISTIO" ? null : <button className={`cw-btn pw-mini ${s.booking ? "cw-btn-danger" : ""}`} disabled={busy === s.id} onClick={() => act(s)}>{s.booking ? "Cancelar" : s.full ? "Lista de espera" : "Reservar"}</button>}
            </div>))}
        </div>))}
    </section>
  );
}

// ------------------------------------------------------------ pagos
interface Pay { id: number; description: string; amount: number; paid: number; outstanding: number; due_date: string | null; status: string; label: string; tone: string; payable: boolean }

function Payments({ slug, me, onChange }: { slug: string; me: Me; onChange: () => void }) {
  const [data, setData] = useState<{ mp_enabled: boolean; items: Pay[]; credit_balance: number } | null>(null);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => { portalApi(slug, "/portal/payments").then(setData).catch((e) => setMsg({ text: e.message, err: true })); }, [slug]);
  useEffect(() => {
    load();
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) portalApi(slug, `/portal/charges/${c}/verify`, { method: "POST" }).then((r) => { setMsg({ text: r.message, err: false }); load(); onChange(); }).catch(() => undefined);
  }, [slug, load, onChange]);
  async function pay(p: Pay) {
    setBusy(p.id); setMsg(null);
    try { const r = await portalApi<{ payment_url: string }>(slug, `/portal/charges/${p.id}/pay`, { method: "POST" }); window.location.href = r.payment_url; } catch (e) { setMsg({ text: e instanceof Error ? e.message : "No se pudo", err: true }); setBusy(null); }
  }
  const tone: Record<string, string> = { green: "#1d6b3f", orange: "#8a4b06", red: "#a3302a", gray: "#555867" };
  return (
    <section className="cw-card"><h2>Mis pagos</h2>
      {me.debt.total > 0 && <div className="cw-summary"><strong>Debés {money(me.debt.total)}</strong>{me.debt.overdue > 0 && <span>De eso, {money(me.debt.overdue)} ya venció.</span>}</div>}
      {msg && <div className={msg.err ? "cw-error" : "cw-msg"} role="status">{msg.text}</div>}
      {!data ? <p>Cargando...</p> : data.items.length === 0 ? <p>Todavía no tenés cargos.</p> : data.items.map((p) => (
        <div className="pw-class" key={p.id} style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
          <div><strong>{p.description}</strong><small>{p.due_date ? `Vence ${shortDate(p.due_date)}` : ""} · <span style={{ color: tone[p.tone] || tone.gray, fontWeight: 800 }}>{p.label}</span></small></div>
          <div style={{ textAlign: "right" }}><strong>{money(p.status === "PAGADA" ? p.amount : p.outstanding)}</strong>
            {p.payable && <div><button className="cw-btn pw-mini" style={{ marginTop: 6 }} disabled={busy === p.id} onClick={() => pay(p)}>Pagar con Mercado Pago</button></div>}</div>
        </div>))}
      {data && !data.mp_enabled && data.items.some((p) => p.outstanding > 0) && <p style={{ color: "#565c76", fontSize: 14 }}>Por ahora los pagos se hacen en el mostrador del club.</p>}
    </section>
  );
}

// ------------------------------------------------------------ entrenamiento
function Training({ slug }: { slug: string }) {
  const [r, setR] = useState<any>(undefined);
  const [p, setP] = useState<any>(null);
  useEffect(() => { portalApi(slug, "/portal/routine").then(setR).catch(() => setR({ routine: null })); portalApi(slug, "/portal/progress").then(setP).catch(() => setP(null)); }, [slug]);
  return (
    <>
      <section className="cw-card"><h2>Mi rutina</h2>
        {r === undefined ? <p>Cargando...</p> : !r.routine ? <p>Todavía no te asignaron una rutina. Consultá con tu profe.</p> : (
          <>
            <p><strong>{r.routine.name}</strong>{r.routine.goal ? ` · ${r.routine.goal}` : ""}{r.routine.level ? ` · ${r.routine.level}` : ""}</p>
            {r.routine.notes && <div className="cw-msg">{r.routine.notes}</div>}
            {r.routine.days.map((d: any, i: number) => (
              <div className="pw-day" key={i}><h3>{d.day_label}</h3>
                {d.exercises.map((e: any, k: number) => <div className="pw-ex" key={k}><span>{e.exercise_name}{e.notes && <small style={{ display: "block" }}>{e.notes}</small>}</span><strong>{[e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.sets ? `${e.sets} series` : e.reps, e.load_note].filter(Boolean).join(" · ")}</strong></div>)}
              </div>))}
          </>)}
      </section>
      {p && (p.measurements.length > 0 || p.records.length > 0) && (
        <section className="cw-card"><h2>Mi progreso</h2>
          {p.measurements.length > 0 && <><h3 style={{ margin: "6px 0", fontSize: 14 }}>Medidas</h3>{p.measurements.slice(0, 8).map((m: any) => <div className="pw-ex" key={m.id}><span>{shortDate(m.date)}</span><strong>{[m.weight_kg != null && `${m.weight_kg} kg`, m.body_fat_pct != null && `${m.body_fat_pct} % grasa`, m.waist_cm != null && `cintura ${m.waist_cm} cm`].filter(Boolean).join(" · ")}</strong></div>)}</>}
          {p.records.length > 0 && <><h3 style={{ margin: "14px 0 6px", fontSize: 14 }}>Mis marcas</h3>{p.records.slice(0, 10).map((m: any) => <div className="pw-ex" key={m.id}><span>{m.name}<small style={{ display: "block" }}>{shortDate(m.date)}</small></span><strong>{m.value != null ? `${m.value} ${m.unit || ""}` : ""}{m.rx ? " · Rx" : ""}</strong></div>)}</>}
        </section>)}
    </>
  );
}

// ------------------------------------------------------------ mis datos y baja
function Profile({ me, slug, onChange }: { me: Me; slug: string; onChange: () => void }) {
  const [phone, setPhone] = useState(me.phone || "");
  const [email, setEmail] = useState(me.email || "");
  const [address, setAddress] = useState(me.address || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ text: string; err: boolean } | null>(null);
  async function saveContact(e: FormEvent) {
    e.preventDefault(); setSaving(true); setSaved(null);
    try {
      const r = await portalApi<{ message: string }>(slug, "/portal/profile", { method: "PATCH", body: { phone: phone.trim(), email: email.trim(), address: address.trim() } });
      setSaved({ text: r.message, err: false }); onChange();
    } catch (err) { setSaved({ text: err instanceof Error ? err.message : "No se pudo guardar", err: true }); } finally { setSaving(false); }
  }
  const [reason, setReason] = useState("");
  const [ask, setAsk] = useState(false);
  const [res, setRes] = useState<{ code: string; message: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true); setError("");
    try { setRes(await portalApi(slug, "/portal/cancellation", { method: "POST", body: { reason: reason.trim() || null } })); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo enviar"); } finally { setBusy(false); }
  }
  return (
    <>
      <section className="cw-card"><h2>Mis datos</h2>
        <div className="cw-detail"><div><span>Nombre</span><strong>{me.first_name} {me.last_name}</strong></div><div><span>DNI</span><strong>{me.dni}</strong></div><div><span>Club</span><strong>{me.club.name}</strong></div></div>
        <p style={{ color: "#565c76", fontSize: 14 }}>Tu nombre y tu DNI los corrige el club. Tus datos de contacto los podés cambiar acá abajo.</p>
      </section>
      <section className="cw-card"><h2>Mis datos de contacto</h2>
        <form onSubmit={saveContact} noValidate>
          {saved && <div className={saved.err ? "cw-error" : "cw-msg"} role={saved.err ? "alert" : "status"}>{saved.text}</div>}
          <div className="cw-field"><label htmlFor="pf-tel">Teléfono</label><input id="pf-tel" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} placeholder="261 555 1234" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="cw-field"><label htmlFor="pf-mail">Email</label><input id="pf-mail" type="email" autoComplete="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="cw-field"><label htmlFor="pf-dir">Domicilio</label><input id="pf-dir" type="text" autoComplete="street-address" maxLength={255} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <button className="cw-btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar mis datos"}</button>
        </form>
      </section>
      <section className="cw-card"><h2>Pedir la baja</h2>
        {res ? <div className="cw-msg" role="status">{res.message}<br /><strong>Código: {res.code}</strong></div> : !ask ? (
          <><p>Si querés dejar de ser parte del club, podés pedir tu baja desde acá.</p><button className="cw-btn cw-btn-danger" onClick={() => setAsk(true)}>Quiero darme de baja</button></>
        ) : (
          <>
            {error && <div className="cw-error" role="alert">{error}</div>}
            <div className="cw-field"><label htmlFor="bj-r">Nos ayuda saber por qué <span>(opcional)</span></label><textarea id="bj-r" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <div className="cb-row"><button className="cw-btn cw-btn-danger" disabled={busy} onClick={send}>{busy ? "Enviando..." : "Confirmar pedido de baja"}</button><button className="cw-btn cw-btn-ghost" onClick={() => setAsk(false)}>Me arrepentí</button></div>
          </>)}
      </section>
    </>
  );
}

export default Index;
