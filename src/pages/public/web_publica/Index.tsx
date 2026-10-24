import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { money, publicApi, shortDate } from "../../../config";
import { ClubedoLogo, PoweredBy, useLightPage } from "../../../components/Brand";
import { PersonForm } from "../../../components/web_publica/PersonForm";
import type { PersonData } from "../../../components/web_publica/PersonForm";
import "../../../c3.css";

interface Web {
  name: string; slug: string; rubro: string; vocab: Record<string, string>; logo_data: string | null; address: string | null; city: string | null; province: string | null;
  phone: string | null; email: string | null; map_url: string | null; hours: any; holidays: any[];
  activities: { id: number; name: string; color: string; description: string | null }[];
  features: { schedule: boolean; plans: boolean; events: boolean; portal: boolean; signup: boolean; trial: boolean; arrepentimiento: boolean };
}
interface Weekly { weekday: number; start_time: string; duration_min: number; activity_id: number; activity: string; color: string; space: string | null; instructor: string | null }
interface PlanItem { id: number; name: string; kind_label: string; price: number; enrollment_fee: number; lines: string[]; online: boolean }
interface EventItem { id: number; name: string; kind: string; starts_at: string | null; place: string | null; price: number; spots_left: number | null; registration_open: boolean; notes: string | null }

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAY_KEYS: Record<string, string> = { mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves", fri: "Viernes", sat: "Sábado", sun: "Domingo" };

function hoursLines(h: any): string[] {
  if (!h) return [];
  if (typeof h === "string") return [h];
  if (Array.isArray(h)) return h.map((x) => (typeof x === "string" ? x : `${x.day ?? x.dia ?? ""} ${x.open ?? x.desde ?? ""}${x.close ?? x.hasta ? ` a ${x.close ?? x.hasta}` : ""}`.trim())).filter(Boolean);
  if (typeof h === "object") {
    return Object.entries(h).map(([k, v]: [string, any]) => {
      const day = DAY_KEYS[k.toLowerCase()] || (/^\d$/.test(k) ? DAYS[Number(k)] : k);
      if (!v || v.closed || v === "cerrado") return `${day}: cerrado`;
      if (typeof v === "string") return `${day}: ${v}`;
      return `${day}: ${v.open ?? v.desde ?? ""} a ${v.close ?? v.hasta ?? ""}`;
    });
  }
  return [];
}

/** Web pública del club: /c/:slug. Clases, planes, clase de prueba, alta online con Mercado Pago, eventos, contacto y botones legales. */
function Index() {
  useLightPage();
  const { slug = "" } = useParams();
  const { pathname } = useLocation();
  const [web, setWeb] = useState<Web | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { publicApi<Web>(`/public/${slug}/web`).then(setWeb).catch((e) => setError(e.message)); }, [slug]);
  useEffect(() => { if (web) document.title = web.name; }, [web]);

  if (error) return <Shell><div className="cw-card"><div className="cw-error">{error}</div></div></Shell>;
  if (!web) return <Shell><div className="cw-card"><p>Cargando...</p></div></Shell>;
  if (pathname.replace(/\/+$/, "").endsWith("/gracias")) return <Shell web={web}><Thanks slug={slug} /><Foot web={web} /></Shell>;
  return (
    <Shell web={web}>
      <About web={web} />
      {web.features.schedule && <Schedule slug={slug} />}
      {web.features.plans && <Plans slug={slug} web={web} />}
      {web.features.events && <Events slug={slug} />}
      {web.features.trial && <Trial slug={slug} web={web} />}
      <Contact web={web} />
      <Foot web={web} />
    </Shell>
  );
}

function Shell({ web, children }: { web?: Web; children: ReactNode }) {
  return (
    <div className="cw-page">
      <header className="cw-hero"><div className="cw-wrap">
        <div className="cw-top">{web?.logo_data ? <img src={web.logo_data} alt="" width={44} height={44} style={{ borderRadius: 12, objectFit: "cover", background: "#fff" }} /> : <ClubedoLogo size={40} />}
          <div><strong>{web?.name || "Club"}</strong><small>{[web?.city, web?.province].filter(Boolean).join(", ")}</small></div></div>
        {web && <>
          <h1>{web.name}</h1>
          <p>{web.activities.length ? web.activities.map((a) => a.name).join(" · ") : "Te esperamos"}</p>
          <div className="cb-row" style={{ marginTop: 16 }}>
            {web.features.trial && <a className="cw-btn" href="#prueba">Probar una clase</a>}
            {web.features.plans && <a className="cw-btn cw-btn-ghost" href="#planes">Ver planes</a>}
            {web.features.portal && <Link className="cw-btn cw-btn-ghost" to={`/c/${web.slug}/socio`}>Ya soy {web.vocab.member || "socio"}</Link>}
          </div></>}
      </div></header>
      <main className="cw-wrap cw-main">{children}</main>
      <footer className="cw-foot"><PoweredBy /></footer>
    </div>
  );
}

function About({ web }: { web: Web }) {
  if (!web.activities.some((a) => a.description)) return null;
  return (
    <section className="cw-card"><h2>Qué hacemos</h2>
      <div className="pw-grid" style={{ marginTop: 10 }}>{web.activities.map((a) => <div key={a.id} className="cw-summary" style={{ borderLeft: `5px solid ${a.color}`, marginBottom: 0 }}><strong>{a.name}</strong>{a.description && <span>{a.description}</span>}</div>)}</div>
    </section>
  );
}

function Schedule({ slug }: { slug: string }) {
  const [data, setData] = useState<{ available: boolean; weekly: Weekly[] } | null>(null);
  useEffect(() => { publicApi(`/public/${slug}/schedule`).then(setData).catch(() => setData({ available: false, weekly: [] })); }, [slug]);
  if (!data || !data.available || data.weekly.length === 0) return null;
  return (
    <section className="cw-card" id="horarios"><h2>Horarios de clases</h2><p>Los horarios de la semana. Los lugares se reservan en el club o desde el portal.</p>
      <div className="pw-week">
        {DAYS.map((d, i) => {
          const list = data.weekly.filter((w) => w.weekday === i);
          return (
            <div key={d}><h4>{d}</h4>{list.length === 0 ? <small style={{ color: "#565c76" }}>Sin clases</small> : list.map((w, k) => (
              <span className="pw-cls" key={k} style={{ borderLeft: `4px solid ${w.color}` }}><b>{w.start_time}</b>{w.activity}{w.instructor ? ` · ${w.instructor}` : ""}</span>))}</div>);
        })}
      </div>
    </section>
  );
}

function Plans({ slug, web }: { slug: string; web: Web }) {
  const [data, setData] = useState<{ available: boolean; items: PlanItem[] } | null>(null);
  const [pick, setPick] = useState<PlanItem | null>(null);
  useEffect(() => { publicApi(`/public/${slug}/plans`).then(setData).catch(() => setData({ available: false, items: [] })); }, [slug]);
  if (!data || !data.available || data.items.length === 0) return null;
  return (
    <section className="cw-card" id="planes"><h2>Planes</h2><p>Precios vigentes{web.features.signup ? ". Podés asociarte ahora y pagar con Mercado Pago." : ". Para asociarte, pasá por el club."}</p>
      <div className="pw-grid">
        {data.items.map((p) => (
          <div key={p.id} className="cw-summary pw-plan" style={{ marginBottom: 0 }}>
            <span>{p.kind_label}</span><strong>{p.name}</strong><span className="pw-price">{money(p.price)}</span>
            <ul>{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
            {web.features.signup && p.online && <button className="cw-btn pw-mini" onClick={() => setPick(p)}>Asociarme</button>}
          </div>))}
      </div>
      {pick && <Signup slug={slug} plan={pick} onClose={() => setPick(null)} />}
    </section>
  );
}

function Signup({ slug, plan, onClose }: { slug: string; plan: PlanItem; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go(p: PersonData) {
    setBusy(true); setError("");
    try {
      const r = await publicApi<{ payment_url: string }>(`/public/${slug}/signup`, { method: "POST", body: { plan_id: plan.id, ...clean(p) } });
      window.location.href = r.payment_url;
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos completar el alta"); setBusy(false); }
  }
  return (
    <div className="cw-card" style={{ marginTop: 14, boxShadow: "none", border: "1.5px solid #1f2a5c" }}>
      <div className="cb-spread"><h2>Asociarme a {plan.name}</h2><button className="cw-btn cw-btn-ghost pw-mini" onClick={onClose}>Cerrar</button></div>
      <p>{money(plan.price)}{plan.enrollment_fee > 0 ? ` + matrícula ${money(plan.enrollment_fee)}` : ""}. Después de completar tus datos te llevamos a Mercado Pago a pagar.</p>
      <PersonForm slug={slug} busy={busy} error={error} onSubmit={go} submitLabel="Ir a pagar" />
    </div>
  );
}

function clean(p: PersonData) {
  return { ...p, email: p.email.trim() || null, birth_date: p.birth_date || null, guardian_name: p.guardian_name.trim() || null, guardian_dni: p.guardian_dni.trim() || null, guardian_phone: p.guardian_phone.trim() || null };
}

function Trial({ slug, web }: { slug: string; web: Web }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [act, setAct] = useState("");
  const [msg, setMsg] = useState("");
  async function go(p: PersonData) {
    setBusy(true); setError("");
    try { const r = await publicApi<{ message: string }>(`/public/${slug}/trial`, { method: "POST", body: { ...clean(p), activity_id: act ? Number(act) : null, message: msg.trim() || null } }); setDone(r.message); } catch (e) { setError(e instanceof Error ? e.message : "No pudimos enviar el pedido"); } finally { setBusy(false); }
  }
  return (
    <section className="cw-card" id="prueba"><h2>Probá una clase</h2>
      {done ? <div className="cw-msg" role="status">{done}</div> : <>
        <p>Dejanos tus datos y te escribimos para coordinar el día.</p>
        <PersonForm slug={slug} busy={busy} error={error} onSubmit={go} submitLabel="Quiero probar" compact extra={<>
          {web.activities.length > 0 && <div className="cw-field"><label htmlFor="tr-act">¿Qué te interesa? <span>(opcional)</span></label><select id="tr-act" value={act} onChange={(e) => setAct(e.target.value)}><option value="">Todavía no sé</option>{web.activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
          <div className="cw-field"><label htmlFor="tr-msg">Algo que quieras contarnos <span>(opcional)</span></label><textarea id="tr-msg" rows={2} maxLength={300} value={msg} onChange={(e) => setMsg(e.target.value)} /></div></>} />
      </>}
    </section>
  );
}

function Events({ slug }: { slug: string }) {
  const [items, setItems] = useState<EventItem[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { publicApi<{ items: EventItem[] }>(`/public/${slug}/events`).then((r) => setItems(r.items)).catch(() => setItems([])); }, [slug]);
  if (!items || items.length === 0) return null;
  async function go(id: number, p: PersonData) {
    setBusy(true); setError("");
    try { const r = await publicApi<{ message: string }>(`/public/${slug}/events/${id}/register`, { method: "POST", body: clean(p) }); setDone(r.message); setOpen(null); } catch (e) { setError(e instanceof Error ? e.message : "No pudimos anotarte"); } finally { setBusy(false); }
  }
  return (
    <section className="cw-card" id="eventos"><h2>Próximos eventos</h2>
      {done && <div className="cw-msg" role="status">{done}</div>}
      {items.map((e) => (
        <div key={e.id} style={{ padding: "12px 0", borderBottom: "1px solid #eaebf1" }}>
          <div className="cb-spread"><div><strong>{e.name}</strong><div style={{ color: "#565c76", fontSize: 14 }}>{e.starts_at ? shortDate(e.starts_at) : "Fecha a confirmar"}{e.place ? ` · ${e.place}` : ""} · {e.price > 0 ? money(e.price) : "Gratis"}{e.spots_left !== null ? ` · Quedan ${e.spots_left} lugares` : ""}</div></div>
            {e.registration_open ? <button className="cw-btn pw-mini" onClick={() => { setOpen(open === e.id ? null : e.id); setError(""); }}>{open === e.id ? "Cerrar" : "Anotarme"}</button> : <span style={{ color: "#565c76", fontWeight: 700 }}>Inscripción cerrada</span>}</div>
          {e.notes && <p style={{ margin: "6px 0 0", color: "#565c76", fontSize: 14 }}>{e.notes}</p>}
          {open === e.id && <div style={{ marginTop: 12 }}><PersonForm slug={slug} busy={busy} error={error} onSubmit={(p) => go(e.id, p)} submitLabel="Confirmar inscripción" compact /></div>}
        </div>))}
    </section>
  );
}

function Contact({ web }: { web: Web }) {
  const lines = hoursLines(web.hours);
  const wa = web.phone ? `https://wa.me/${web.phone.replace(/\D/g, "").replace(/^0/, "").replace(/^(?!54)/, "54")}` : null;
  if (!web.phone && !web.email && !web.address && !lines.length) return null;
  return (
    <section className="cw-card" id="contacto"><h2>Dónde estamos</h2>
      <div className="cw-detail">
        {web.address && <div><span>Dirección</span><strong>{[web.address, web.city].filter(Boolean).join(", ")}</strong></div>}
        {web.phone && <div><span>Teléfono</span><strong>{web.phone}</strong></div>}
        {web.email && <div><span>Email</span><strong>{web.email}</strong></div>}
        {lines.length > 0 && <div><span>Horarios</span><strong style={{ textAlign: "right" }}>{lines.map((l) => <span key={l} style={{ display: "block" }}>{l}</span>)}</strong></div>}
      </div>
      <div className="cb-row">{web.map_url && <a className="cw-btn cw-btn-ghost pw-mini" href={web.map_url} target="_blank" rel="noreferrer">Ver en el mapa</a>}{wa && <a className="cw-btn pw-mini" href={wa} target="_blank" rel="noreferrer">Escribinos por WhatsApp</a>}</div>
    </section>
  );
}

function Foot({ web }: { web: Web }) {
  return (
    <section style={{ textAlign: "center", padding: "6px 0 16px" }}>
      <div className="pw-foot-links">
        <Link to={`/c/${web.slug}/baja`}>Darme de baja</Link>
        {web.features.arrepentimiento && <Link to={`/c/${web.slug}/arrepentimiento`}>Botón de arrepentimiento</Link>}
        <Link to={`/c/${web.slug}/condiciones`}>Condiciones</Link>
        <Link to="/legal/privacidad">Privacidad</Link>
      </div>
    </section>
  );
}

function Thanks({ slug }: { slug: string }) {
  const token = new URLSearchParams(window.location.search).get("t") || "";
  const [res, setRes] = useState<{ status: string; plan: string | null; message: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) { setError("Falta el código de tu compra."); return; }
    let tries = 0, stop = false;
    const check = () => {
      publicApi(`/public/${slug}/signup/verify?t=${encodeURIComponent(token)}`).then((r) => {
        if (stop) return;
        setRes(r);
        if (r.status !== "PAGADO" && tries++ < 4) window.setTimeout(check, 4000);
      }).catch((e) => !stop && setError(e.message));
    };
    check();
    return () => { stop = true; };
  }, [slug, token]);
  return (
    <section className="cw-card cw-ticket"><div className={`cw-ticket-icon ${res?.status === "PAGADO" ? "" : "is-cancel"}`} aria-hidden>{res?.status === "PAGADO" ? "✓" : "…"}</div>
      <h2>{res?.status === "PAGADO" ? "¡Bienvenido!" : "Estamos confirmando tu pago"}</h2>
      {error ? <div className="cw-error">{error}</div> : <p>{res?.message || "Un momento..."}</p>}
      {res?.plan && <p><strong>{res.plan}</strong></p>}
      <Link className="cw-btn cw-btn-ghost" to={`/c/${slug}`}>Volver a la página del club</Link>
    </section>
  );
}

export default Index;
