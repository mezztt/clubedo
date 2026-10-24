import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { publicApi, money } from "../../config";
import { ClubedoLogo, PoweredBy, useLightPage } from "../../components/Brand";

/**
 * Páginas públicas que todo club tiene aunque no contrate ninguna web (spec B):
 *   /c/:slug/condiciones   condiciones generales del club
 *   /c/:slug/baja          botón de baja
 *   /c/:slug/arrepentimiento  botón de arrepentimiento (solo si el club vende online)
 * Citan la Disposición 954/2025. No prometen cumplimiento: el texto del contrato lo carga el club.
 */
type Page = "condiciones" | "baja" | "arrepentimiento";

interface ClubInfo { name: string; arrepentimiento: boolean; phone: string | null; email: string | null; address: string | null; city: string | null }
interface Conditions {
  name: string; text: string | null; version: number; late_fee_mode: string; late_fee_value: number; late_fee_after_days: number;
  freeze: { min_days: number; max_days: number; max_per_year: number }; cancel_window_hours: number; grace_days: number;
}
interface Receipt { code: string; requested_at: string; kind: string; detail: string }

const TITLES: Record<Page, string> = { condiciones: "Condiciones del club", baja: "Darme de baja", arrepentimiento: "Me arrepiento de mi compra" };

function ClubLegal({ page }: { page: Page }) {
  useLightPage();
  const { slug = "" } = useParams();
  const [club, setClub] = useState<ClubInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    publicApi<ClubInfo>(`/public/${slug}/club`).then(setClub).catch((e) => setError(e.message));
  }, [slug]);
  useEffect(() => { window.scrollTo(0, 0); document.title = `${TITLES[page]}${club ? ` · ${club.name}` : ""}`; }, [page, club]);

  return (
    <div className="cw-page lg-page">
      <header className="lg-top">
        <div className="lg-wrap lg-top-row">
          <span className="lg-brand"><ClubedoLogo size={34} /><strong>{club?.name || "Club"}</strong></span>
        </div>
      </header>
      <main className="lg-wrap">
        <article className="cw-card lg-card">
          <span className="cw-step-label">{club?.name || ""}</span>
          <h1>{TITLES[page]}</h1>
          {error ? <div className="cw-error">{error}</div> : !club ? <p className="lg-updated">Cargando…</p> : (
            page === "condiciones" ? <ConditionsBody slug={slug} /> : <RequestForm slug={slug} kind={page === "baja" ? "BAJA" : "ARREPENTIMIENTO"} enabled={page === "baja" || club.arrepentimiento} />
          )}
          {club && (
            <p className="lg-also">
              <Link to={`/c/${slug}/condiciones`}>Condiciones</Link>{" · "}
              <Link to={`/c/${slug}/baja`}>Darme de baja</Link>
              {club.arrepentimiento && <>{" · "}<Link to={`/c/${slug}/arrepentimiento`}>Me arrepiento de mi compra</Link></>}
            </p>
          )}
        </article>
      </main>
      <footer className="cw-foot"><PoweredBy /></footer>
    </div>
  );
}

function ConditionsBody({ slug }: { slug: string }) {
  const [c, setC] = useState<Conditions | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { publicApi<Conditions>(`/public/${slug}/conditions`).then(setC).catch((e) => setError(e.message)); }, [slug]);
  if (error) return <div className="cw-error">{error}</div>;
  if (!c) return null;
  const fee = c.late_fee_mode === "FIJO" ? `un recargo de ${money(c.late_fee_value)}` : c.late_fee_mode === "PORCENTAJE" ? `un recargo del ${c.late_fee_value} %` : "";
  return (
    <>
      <p className="lg-updated">Versión {c.version}</p>
      {c.text ? <section className="lg-section" style={{ whiteSpace: "pre-line" }}><p>{c.text}</p></section> : (
        <p className="lg-lead">El club todavía no cargó su texto de condiciones. Consultá en recepción.</p>
      )}
      <section className="lg-section">
        <h2>Resumen de las reglas del club</h2>
        <ul>
          <li>La cuota tiene {c.grace_days} días de gracia después del vencimiento.</li>
          {fee && <li>Si el atraso pasa de {c.late_fee_after_days} días, se aplica {fee}.</li>}
          <li>Las reservas se pueden cancelar hasta {c.cancel_window_hours} horas antes.</li>
          <li>El plan se puede congelar entre {c.freeze.min_days} y {c.freeze.max_days} días, hasta {c.freeze.max_per_year} veces por año.</li>
          <li>Podés darte de baja por esta misma web, sin llamar ni ir al club.</li>
        </ul>
      </section>
    </>
  );
}

function RequestForm({ slug, kind, enabled }: { slug: string; kind: "BAJA" | "ARREPENTIMIENTO"; enabled: boolean }) {
  const [dni, setDni] = useState("");
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  if (!enabled) return <p className="lg-lead">Este club no vende online, así que no tiene botón de arrepentimiento. Si necesitás ayuda, consultá en recepción.</p>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const path = kind === "BAJA" ? "baja" : "arrepentimiento";
      setReceipt(await publicApi<Receipt>(`/public/${slug}/${path}`, { method: "POST", body: { dni, full_name: fullName, contact, reason: reason.trim() || null } }));
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo enviar"); } finally { setSaving(false); }
  }

  if (receipt) {
    return (
      <div className="cw-ticket">
        <div className="cw-ticket-icon" aria-hidden="true">✓</div>
        <p className="lg-lead">{receipt.detail}</p>
        <div className="cw-code"><small>Tu código</small><strong>{receipt.code}</strong></div>
        <p className="lg-updated">{new Date(receipt.requested_at).toLocaleString("es-AR")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <p className="lg-lead">
        {kind === "BAJA"
          ? "Completá tus datos y recibís un código de constancia al instante. No hace falta que des un motivo."
          : "Tenés 10 días corridos para arrepentirte de una compra hecha por internet. Completá tus datos y recibís un código de constancia al instante."}
      </p>
      <div className="cw-field"><label htmlFor="dni">DNI</label><input id="dni" value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" required minLength={6} maxLength={20} /></div>
      <div className="cw-field"><label htmlFor="name">Nombre y apellido</label><input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={160} autoComplete="name" /></div>
      <div className="cw-field"><label htmlFor="contact">Teléfono o email</label><input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} required minLength={3} maxLength={160} autoComplete="tel" /></div>
      <div className="cw-field"><label htmlFor="reason">Motivo <span>(opcional)</span></label><textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
      {error && <div className="cw-error">{error}</div>}
      <button type="submit" className="cw-btn" disabled={saving}>{saving ? "Enviando…" : kind === "BAJA" ? "Pedir mi baja" : "Pedir el arrepentimiento"}</button>
      <p className="cw-consent">Botón previsto por la Disposición 954/2025. El club procesa tu pedido y se comunica con vos; las devoluciones y el período ya usado los define el club.</p>
    </form>
  );
}

export default ClubLegal;
