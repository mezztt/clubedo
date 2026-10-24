import { useCallback, useEffect, useRef, useState } from "react";
import { appApi, shortDate, useVocab } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, Switch, useFlash } from "../../../components/ui";
import { MemberPicker, SubTabs, isManager, useSub } from "../../../components/c3/common";
import type { MemberHit } from "../../../components/c3/common";
import { moduleHint, moduleLabel } from "../../../config";

const BASE = "/app/avisos";

/** Avisos: cola de mensajes para mandar a mano por WhatsApp, plantillas, campañas y cartelera. Clubedo no envía nada solo. */
function Index() {
  const [sub] = useSub(BASE, "cola");
  const manager = isManager();
  return (
    <section className="products-page">
      <PageHeader eyebrow="MÓDULO" title={moduleLabel("avisos")} subtitle={moduleHint("avisos")} />
      <SubTabs base={BASE} fallback="cola" options={[["cola", "Cola de mensajes"], ["armar", "Armar mensaje"], ["plantillas", "Plantillas"], ...(manager ? [["campanas", "Campañas"] as [string, string]] : []), ["cartelera", "Cartelera"]]} />
      {sub === "armar" ? <Compose /> : sub === "plantillas" ? <Templates /> : sub === "campanas" && manager ? <Campaigns /> : sub === "cartelera" ? <Board /> : <Queue />}
    </section>
  );
}

interface QItem { id: number; member_name: string | null; phone: string | null; text: string; wa_url: string | null; has_phone: boolean; mailto_url: string | null; template_label: string; status: string; due_on: string | null; overdue: boolean; marked_sent_at: string | null; marked_by: string | null }

// ------------------------------------------------------------ cola
function Queue() {
  const { show, fail, node } = useFlash();
  const [status, setStatus] = useState<"PENDIENTE" | "ENVIADO" | "DESCARTADO">("PENDIENTE");
  const [kind, setKind] = useState<"" | "cobro" | "otros">("");
  const [data, setData] = useState<{ items: QItem[]; counts: Record<string, number> } | null>(null);
  const load = useCallback(() => { appApi(`/messages/queue?status=${status}${kind ? `&kind=${kind}` : ""}`).then(setData).catch(fail); }, [status, kind, fail]);
  useEffect(() => { setData(null); load(); }, [load]);

  async function act(id: number, what: "sent" | "discard" | "restore") {
    try { await appApi(`/messages/queue/${id}/${what}`, { method: "POST" }); load(); if (what === "sent") show("Marcado como enviado"); } catch (e) { fail(e); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); show("Mensaje copiado"); } catch { show("No se pudo copiar: seleccionalo y copialo a mano", true); }
  }
  function openWa(it: QItem) {
    if (!it.wa_url) return;
    window.open(it.wa_url, "_blank", "noopener");
    if (it.status === "PENDIENTE") act(it.id, "sent");
  }
  const c = data?.counts;
  return (
    <div className="cb-stack">
      <div className="cb-toolbar">
        <Seg value={status} onChange={setStatus} options={[["PENDIENTE", `Para mandar${c ? ` (${c.PENDIENTE})` : ""}`], ["ENVIADO", `Enviados${c ? ` (${c.ENVIADO})` : ""}`], ["DESCARTADO", "Descartados"]]} />
        <Seg value={kind} onChange={setKind} options={[["", "Todos"], ["cobro", "De cobranza"], ["otros", "Otros"]]} />
      </div>
      <div className="cb-note cb-note-info">Clubedo arma el mensaje y vos lo mandás: al tocar «WhatsApp» se abre el chat con el texto listo. Si el aviso lleva mucho, usá «Copiar».</div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty title={status === "PENDIENTE" ? "No hay mensajes para mandar" : "No hay mensajes acá"}>{status === "PENDIENTE" && <p className="cb-muted">Armalos desde «Armar mensaje» o «Campañas».</p>}</Empty> : (
        <div className="cb-card">
          {data.items.map((it) => (
            <div className="c3-msg" key={it.id}>
              <div>
                <div className="cb-row"><strong>{it.member_name || "Sin nombre"}</strong><Pill tone="teal">{it.template_label}</Pill>{it.overdue && <Pill tone="orange">Atrasado</Pill>}{!it.has_phone && <Pill tone="red">Sin teléfono válido</Pill>}</div>
                <p>{it.text}</p>
                {it.status === "ENVIADO" && <small className="cb-muted">Enviado {shortDate(it.marked_sent_at)}{it.marked_by ? ` por ${it.marked_by}` : ""}</small>}
              </div>
              <div className="c3-msg-actions">
                {it.status === "PENDIENTE" && <>
                  {it.has_phone && <button className="primary-button" onClick={() => openWa(it)}>WhatsApp</button>}
                  <button className="secondary-button" onClick={() => copy(it.text)}>Copiar</button>
                  {it.mailto_url && <a className="secondary-button" href={it.mailto_url}>Email</a>}
                  <button className="secondary-button" onClick={() => act(it.id, "sent")}>Ya lo mandé</button>
                  <button className="cb-link" onClick={() => act(it.id, "discard")}>Descartar</button></>}
                {it.status === "ENVIADO" && <button className="secondary-button" onClick={() => copy(it.text)}>Copiar</button>}
                {it.status === "DESCARTADO" && <button className="secondary-button" onClick={() => act(it.id, "restore")}>Recuperar</button>}
              </div>
            </div>))}
        </div>)}
      {node}
    </div>
  );
}

// ------------------------------------------------------------ plantillas
interface Tpl { key: string; label: string; hint: string; body: string; active: boolean; is_default: boolean; default_body: string }

function Templates() {
  const { show, fail, node } = useFlash();
  const manager = isManager();
  const [data, setData] = useState<{ items: Tpl[]; variables: { name: string; text: string }[] } | null>(null);
  const [edit, setEdit] = useState<Tpl | null>(null);
  const load = useCallback(() => { appApi("/message-templates").then(setData).catch(fail); }, [fail]);
  useEffect(load, [load]);
  if (!data) return <Loading />;
  return (
    <div className="cb-stack">
      <p className="cb-muted" style={{ margin: 0 }}>Los textos con los que se arman los mensajes. Las llaves, como {"{nombre}"}, se reemplazan por los datos de cada persona.</p>
      <div className="c3-grid-cards">
        {data.items.map((t) => (
          <div className="cb-card" key={t.key}>
            <div className="cb-card-head"><div><strong>{t.label}</strong><small className="cb-muted" style={{ display: "block" }}>{t.hint}</small></div>{!t.active ? <Pill tone="gray">Desactivada</Pill> : t.is_default ? <Pill tone="gray">Original</Pill> : <Pill tone="teal">Personalizada</Pill>}</div>
            <p className="cb-muted" style={{ whiteSpace: "pre-line", margin: "0 0 12px" }}>{t.body}</p>
            {manager && <button className="secondary-button" onClick={() => setEdit(t)}>Editar</button>}
          </div>))}
      </div>
      {edit && <TemplateModal tpl={edit} vars={data.variables} onClose={() => setEdit(null)} onFail={fail} onDone={(txt) => { setEdit(null); load(); show(txt); }} />}
      {node}
    </div>
  );
}

function TemplateModal({ tpl, vars, onClose, onDone, onFail }: { tpl: Tpl; vars: { name: string; text: string }[]; onClose: () => void; onDone: (t: string) => void; onFail: (e: unknown) => void }) {
  const [body, setBody] = useState(tpl.body);
  const [active, setActive] = useState(tpl.active);
  const [preview, setPreview] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const h = window.setTimeout(() => { appApi("/message-templates/preview", { method: "POST", body: { body } }).then((r) => setPreview(r.text)).catch(() => undefined); }, 300);
    return () => window.clearTimeout(h);
  }, [body]);
  function insert(v: string) {
    const el = area.current;
    if (!el) { setBody(body + v); return; }
    const a = el.selectionStart, b = el.selectionEnd;
    setBody(body.slice(0, a) + v + body.slice(b));
    window.setTimeout(() => { el.focus(); el.setSelectionRange(a + v.length, a + v.length); }, 0);
  }
  async function save() { try { await appApi("/message-templates", { method: "PUT", body: { key: tpl.key, channel: "WHATSAPP", body, active } }); onDone("Plantilla guardada"); } catch (e) { onFail(e); } }
  async function reset() { try { await appApi(`/message-templates/${tpl.key}`, { method: "DELETE" }); onDone("Volvió al texto original"); } catch (e) { onFail(e); } }
  return (
    <Modal eyebrow="PLANTILLA" title={tpl.label} size="wide" onClose={onClose}
      footer={<>{!tpl.is_default && <button className="cb-link" onClick={reset}>Volver al original</button>}<button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={body.trim().length < 3} onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <Field label="Texto del mensaje"><textarea ref={area} rows={6} maxLength={1200} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="c3-vars" aria-label="Variables">{vars.map((v) => <button key={v.name} type="button" title={v.text} onClick={() => insert(v.name)}>{v.name}</button>)}</div>
        <Switch on={active} onChange={setActive} label="Plantilla activa" hint="Si la desactivás, no se arman mensajes con ella" />
        <div><span className="cb-form-title" style={{ margin: 0 }}>Así se ve con datos de ejemplo</span><div className="c3-bubble" style={{ marginTop: 8 }}>{preview}</div></div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ armar mensaje
function Compose() {
  const { t } = useVocab();
  const { show, fail, node } = useFlash();
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [people, setPeople] = useState<MemberHit[]>([]);
  const [picker, setPicker] = useState<MemberHit | null>(null);
  const [key, setKey] = useState("LIBRE");
  const [custom, setCustom] = useState("");
  useEffect(() => { appApi("/message-templates").then((r) => setTpls(r.items)).catch(fail); }, [fail]);
  function add(m: MemberHit | null) { if (m && !people.some((p) => p.id === m.id)) setPeople([...people, m]); setPicker(null); }
  async function make() {
    try {
      const r = await appApi("/messages/compose", { method: "POST", body: { member_ids: people.map((p) => p.id), template_key: custom.trim() ? null : key, text: custom.trim() || null } });
      show(`${r.created} ${r.created === 1 ? "mensaje quedó" : "mensajes quedaron"} en la cola${r.skipped_no_phone ? ` · ${r.skipped_no_phone} sin teléfono válido` : ""}`);
      setPeople([]); setCustom("");
    } catch (e) { fail(e); }
  }
  return (
    <div className="cb-card" style={{ maxWidth: 680 }}>
      <div className="product-form">
        <Field label={`Para quién (${t("members")})`}>
          <MemberPicker value={picker} onPick={add} placeholder="Buscá y sumá personas" />
          {people.length > 0 && <div className="cb-chips" style={{ marginTop: 8 }}>{people.map((p) => <span className="cb-chip" key={p.id}>{p.full_name} <button className="cb-link" style={{ textDecoration: "none" }} aria-label={`Sacar a ${p.full_name}`} onClick={() => setPeople(people.filter((x) => x.id !== p.id))}>×</button></span>)}</div>}
        </Field>
        <Field label="Plantilla"><select value={key} onChange={(e) => setKey(e.target.value)} disabled={!!custom.trim()}>{tpls.filter((x) => x.active).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></Field>
        <Field label="O escribí tu propio mensaje" hint="Si escribís acá, se usa este texto. Podés usar {nombre} y {club}."><textarea rows={3} maxLength={1200} value={custom} onChange={(e) => setCustom(e.target.value)} /></Field>
        <div><button className="primary-button" disabled={!people.length} onClick={make}>Armar {people.length > 1 ? `${people.length} mensajes` : "mensaje"}</button></div>
      </div>
      {node}
    </div>
  );
}

// ------------------------------------------------------------ campañas
interface Camp { kind: string; label: string; template_key: string }
function Campaigns() {
  const { show, fail, node } = useFlash();
  const [list, setList] = useState<Camp[]>([]);
  const [prev, setPrev] = useState<Record<string, any>>({});
  useEffect(() => { appApi("/messages/campaigns").then(setList).catch(fail); }, [fail]);
  async function run(kind: string, preview: boolean) {
    try {
      const r = await appApi("/messages/campaign", { method: "POST", body: { kind, preview } });
      if (preview) setPrev((p) => ({ ...p, [kind]: r }));
      else { show(`${r.created} mensajes nuevos en la cola${r.already_queued ? ` · ${r.already_queued} ya estaban` : ""}${r.skipped_no_phone ? ` · ${r.skipped_no_phone} sin teléfono` : ""}`); setPrev((p) => ({ ...p, [kind]: undefined })); }
    } catch (e) { fail(e); }
  }
  return (
    <div className="c3-grid-cards">
      {list.map((c) => {
        const p = prev[c.kind];
        return (
          <div className="cb-card" key={c.kind}>
            <strong>{c.label}</strong>
            {p ? <div style={{ margin: "10px 0" }}><p style={{ margin: 0 }}><strong>{p.candidates}</strong> personas · <strong>{p.with_phone}</strong> con teléfono</p>{p.sample.length > 0 && <small className="cb-muted">{p.sample.join(", ")}{p.with_phone > p.sample.length ? "..." : ""}</small>}</div> : <p className="cb-muted">Mirá a quiénes les llegaría antes de armar nada.</p>}
            <div className="cb-row"><button className="secondary-button" onClick={() => run(c.kind, true)}>Ver a quiénes</button><button className="primary-button" onClick={() => run(c.kind, false)}>Armar mensajes</button></div>
          </div>);
      })}
      {node}
    </div>
  );
}

// ------------------------------------------------------------ cartelera
interface Ann { id: number; title: string; body: string | null; from_date: string | null; to_date: string | null; audience: string; activity_id: number | null; category_id: number | null; audience_name: string | null; pinned: boolean; status: string }

function Board() {
  const { show, fail, node } = useFlash();
  const manager = isManager();
  const [data, setData] = useState<{ items: Ann[]; activities: { id: number; name: string }[]; categories: { id: number; name: string }[] } | null>(null);
  const [edit, setEdit] = useState<Partial<Ann> | null>(null);
  const load = useCallback(() => { appApi("/announcements").then(setData).catch(fail); }, [fail]);
  useEffect(load, [load]);
  async function remove(a: Ann) { try { await appApi(`/announcements/${a.id}`, { method: "DELETE" }); load(); show("Aviso eliminado"); } catch (e) { fail(e); } }
  if (!data) return <Loading />;
  const tone: Record<string, string> = { VIGENTE: "green", PROGRAMADO: "blue", VENCIDO: "gray" };
  return (
    <div className="cb-stack">
      <div className="cb-spread"><p className="cb-muted" style={{ margin: 0 }}>Lo que escribas acá lo ven las personas en su portal.</p>{manager && <button className="primary-button" onClick={() => setEdit({ audience: "TODOS", pinned: false })}>Nuevo aviso</button>}</div>
      {data.items.length === 0 ? <Empty title="No hay avisos en la cartelera" /> : data.items.map((a) => (
        <div className="c3-ann" key={a.id}>
          <div className="cb-spread"><strong>{a.title}</strong><span className="cb-row"><Pill tone={tone[a.status]}>{a.status === "VIGENTE" ? "Visible" : a.status === "PROGRAMADO" ? "Programado" : "Vencido"}</Pill><Pill tone="gray">{a.audience === "TODOS" ? "Para todos" : a.audience_name || a.audience}</Pill></span></div>
          {a.body && <p>{a.body}</p>}
          <small className="cb-muted">{a.from_date ? `Desde ${shortDate(a.from_date)}` : ""} {a.to_date ? `hasta ${shortDate(a.to_date)}` : ""}</small>
          {manager && <div className="cb-row"><button className="cb-link" onClick={() => setEdit(a)}>Editar</button><button className="cb-link cb-link-danger" onClick={() => remove(a)}>Eliminar</button></div>}
        </div>))}
      {edit && <AnnModal init={edit} acts={data.activities} cats={data.categories} onClose={() => setEdit(null)} onFail={fail} onDone={() => { setEdit(null); load(); show("Aviso guardado"); }} />}
      {node}
    </div>
  );
}

function AnnModal({ init, acts, cats, onClose, onDone, onFail }: { init: Partial<Ann>; acts: { id: number; name: string }[]; cats: { id: number; name: string }[]; onClose: () => void; onDone: () => void; onFail: (e: unknown) => void }) {
  const [f, setF] = useState({ title: init.title || "", body: init.body || "", from_date: init.from_date || "", to_date: init.to_date || "", audience: init.audience || "TODOS", activity_id: String(init.activity_id || ""), category_id: String(init.category_id || ""), pinned: !!init.pinned });
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    const body = { title: f.title.trim(), body: f.body.trim() || null, from_date: f.from_date || null, to_date: f.to_date || null, audience: f.audience, activity_id: f.audience === "ACTIVIDAD" ? Number(f.activity_id) || null : null, category_id: f.audience === "CATEGORIA" ? Number(f.category_id) || null : null, pinned: f.pinned };
    try { await appApi(init.id ? `/announcements/${init.id}` : "/announcements", { method: init.id ? "PUT" : "POST", body }); onDone(); } catch (e) { onFail(e); }
  }
  return (
    <Modal eyebrow="CARTELERA" title={init.id ? "Editar aviso" : "Nuevo aviso"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={f.title.trim().length < 2} onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <Field label="Título"><input value={f.title} maxLength={150} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Texto"><textarea rows={4} maxLength={3000} value={f.body} onChange={(e) => set("body", e.target.value)} /></Field>
        <div className="form-row"><Field label="Visible desde"><input type="date" value={f.from_date} onChange={(e) => set("from_date", e.target.value)} /></Field><Field label="Hasta"><input type="date" value={f.to_date} min={f.from_date} onChange={(e) => set("to_date", e.target.value)} /></Field></div>
        <Field label="Para quién"><select value={f.audience} onChange={(e) => set("audience", e.target.value)}><option value="TODOS">Todos</option>{acts.length > 0 && <option value="ACTIVIDAD">Una actividad</option>}{cats.length > 0 && <option value="CATEGORIA">Una categoría</option>}</select></Field>
        {f.audience === "ACTIVIDAD" && <Field label="Actividad"><select value={f.activity_id} onChange={(e) => set("activity_id", e.target.value)}><option value="">Elegí...</option>{acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
        {f.audience === "CATEGORIA" && <Field label="Categoría"><select value={f.category_id} onChange={(e) => set("category_id", e.target.value)}><option value="">Elegí...</option>{cats.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
        <div className="cb-inline-checks"><label><input type="checkbox" checked={f.pinned} onChange={(e) => set("pinned", e.target.checked)} /> Fijarlo arriba</label></div>
      </div>
    </Modal>
  );
}

export default Index;
