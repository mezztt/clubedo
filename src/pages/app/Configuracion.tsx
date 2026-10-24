import { useEffect, useState } from "react";
import {
  appApi, getSessionUser, refreshVocab, DEFAULT_VOCAB, RUBRO_KEYS, RUBRO_LABELS, VOCAB_CONCEPTS, VOCAB_CONCEPT_LABELS, useVocab,
} from "../../config";
import type { Rubro } from "../../config";
import { startTour } from "../../components/tour/Tour";
import { BajaCard } from "../../components/ServiceCancel";
import { Field, Loading, PageHeader, Switch, strOrNull, useFlash } from "../../components/ui";

interface Company {
  name: string; slug: string | null; rubro: Rubro; vocab_overrides: Record<string, string> | null;
  cuit: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; province: string | null;
}
interface Settings {
  grace_days: number; due_soon_days: number; billing_mode_default: "ANIVERSARIO" | "CALENDARIO"; due_day: number;
  late_fee_mode: "NINGUNO" | "FIJO" | "PORCENTAJE"; late_fee_value: number; late_fee_after_days: number;
  cancel_window_hours: number; booking_open_days: number; trial_classes: number;
  apto_required_mode: "NO" | "AVISAR" | "BLOQUEAR"; apto_validity_days: number;
  freeze_min_days: number; freeze_max_per_year: number; freeze_max_days: number;
  max_discount_pct_recepcion: number; max_discount_pct_encargado: number; receipt_footer: string | null;
  // solo las ve el administrador
  mp_enabled?: boolean; has_mp_token?: boolean; mp_token_hint?: string | null; mp_test_mode?: boolean;
  conditions_text?: string | null; privacy_extra?: string | null;
}

const num = (v: string) => (v === "" ? 0 : Number(v));

function Configuracion() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMINISTRADOR";
  const { t } = useVocab();
  const { show, fail, node: flash } = useFlash();
  const [company, setCompany] = useState<Company | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [vocab, setVocabDraft] = useState<Record<string, string>>({});
  const [mpToken, setMpToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    appApi<Company>("/company").then((c) => { setCompany(c); setVocabDraft(c.vocab_overrides || {}); }).catch(fail);
    appApi<Settings>("/settings").then(setSettings).catch(fail);
  }, [fail]);

  async function saveCompany() {
    if (!company) return;
    try {
      const clean = Object.fromEntries(Object.entries(vocab).filter(([, v]) => v.trim()));
      const c = await appApi<Company>("/company", { method: "PUT", body: {
        name: company.name, rubro: company.rubro, vocab_overrides: clean, cuit: strOrNull(company.cuit), email: strOrNull(company.email),
        phone: strOrNull(company.phone), address: strOrNull(company.address), city: strOrNull(company.city), province: strOrNull(company.province),
      } });
      setCompany(c);
      setVocabDraft(c.vocab_overrides || {});
      await refreshVocab();
      show("Datos guardados");
    } catch (e) { fail(e); }
  }

  async function loadTemplates() {
    if (!confirm("Se cargan los planes, actividades y mensajes típicos del rubro. No se borra ni se pisa nada de lo que ya tenés. ¿Seguimos?")) return;
    setBusy(true);
    try {
      const r = await appApi<{ created: Record<string, number> }>("/config/apply-template", { method: "POST", body: {} });
      const total = Object.values(r.created || {}).reduce((a, b) => a + b, 0);
      show(total ? `Listo: se cargaron ${total} plantillas. Los planes quedan inactivos hasta que les pongas precio.` : "Ya tenías todas las plantillas cargadas.");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function saveSettings(patch?: Partial<Settings> & { mp_access_token?: string }, okText = "Configuración guardada") {
    if (!settings) return;
    const body: Record<string, unknown> = patch ? { ...patch } : {
      grace_days: settings.grace_days, due_soon_days: settings.due_soon_days, billing_mode_default: settings.billing_mode_default,
      due_day: settings.due_day, late_fee_mode: settings.late_fee_mode, late_fee_value: settings.late_fee_value,
      late_fee_after_days: settings.late_fee_after_days, cancel_window_hours: settings.cancel_window_hours,
      booking_open_days: settings.booking_open_days, trial_classes: settings.trial_classes,
      apto_required_mode: settings.apto_required_mode, apto_validity_days: settings.apto_validity_days,
      freeze_min_days: settings.freeze_min_days, freeze_max_per_year: settings.freeze_max_per_year, freeze_max_days: settings.freeze_max_days,
      max_discount_pct_recepcion: settings.max_discount_pct_recepcion, max_discount_pct_encargado: settings.max_discount_pct_encargado,
      receipt_footer: strOrNull(settings.receipt_footer),
    };
    try { setSettings(await appApi<Settings>("/settings", { method: "PUT", body })); show(okText); }
    catch (e) { fail(e); }
  }

  if (!company || !settings) return <Loading />;
  const setC = (k: keyof Company, v: string) => setCompany({ ...company, [k]: v });
  const setS = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings({ ...settings, [k]: v });
  const base = DEFAULT_VOCAB[company.rubro] || DEFAULT_VOCAB.GIMNASIO;

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONFIGURACIÓN" title="Configuración" subtitle={`Datos del club, rubro y reglas de ${t("plans")}, cobro y acceso.`} />

      <div className="cb-grid-2">
        <div className="cb-card">
          <h2>Datos del club</h2>
          <p className="cb-muted">Salen en los recibos, los mensajes y las páginas del club.</p>
          <div className="product-form">
            <Field label="Nombre"><input value={company.name} onChange={(e) => setC("name", e.target.value)} /></Field>
            <div className="form-row">
              <Field label="CUIT"><input value={company.cuit || ""} onChange={(e) => setC("cuit", e.target.value)} /></Field>
              <Field label="Teléfono"><input value={company.phone || ""} onChange={(e) => setC("phone", e.target.value)} /></Field>
            </div>
            <Field label="Email"><input value={company.email || ""} onChange={(e) => setC("email", e.target.value)} /></Field>
            <div className="form-row">
              <Field label="Dirección"><input value={company.address || ""} onChange={(e) => setC("address", e.target.value)} /></Field>
              <Field label="Localidad"><input value={company.city || ""} onChange={(e) => setC("city", e.target.value)} /></Field>
            </div>
            <Field label="Provincia"><input value={company.province || ""} onChange={(e) => setC("province", e.target.value)} /></Field>
          </div>
        </div>

        <div className="cb-card">
          <h2>Rubro y palabras</h2>
          <p className="cb-muted">El rubro solo cambia los textos y las plantillas. Podés cambiarlo cuando quieras.</p>
          <div className="product-form">
            <Field label="Rubro">
              <select value={company.rubro} onChange={(e) => setCompany({ ...company, rubro: e.target.value as Rubro })}>
                {RUBRO_KEYS.map((k) => <option key={k} value={k}>{RUBRO_LABELS[k]}</option>)}
              </select>
            </Field>
            <details>
              <summary className="cb-link">Cambiar palabras sueltas</summary>
              <div className="cb-stack" style={{ marginTop: 10 }}>
                {VOCAB_CONCEPTS.map((k) => (
                  <Field key={k} label={VOCAB_CONCEPT_LABELS[k]} hint={`Por defecto: ${base[k]}`}>
                    <input value={vocab[k] || ""} placeholder={base[k]} maxLength={60} onChange={(e) => setVocabDraft({ ...vocab, [k]: e.target.value })} />
                  </Field>
                ))}
              </div>
            </details>
            <div className="cb-row">
              <button className="secondary-button" disabled={busy} onClick={loadTemplates}>Cargar plantillas del rubro</button>
            </div>
          </div>
        </div>
      </div>
      <div className="cb-row" style={{ marginBottom: 16 }}>
        <button className="primary-button" onClick={saveCompany}>Guardar datos y rubro</button>
      </div>

      <div className="cb-card">
        <h2>Cuotas y cobro</h2>
        <p className="cb-muted">Cuándo vence una cuota y qué pasa cuando se atrasa.</p>
        <div className="product-form">
          <div className="form-row">
            <Field label="Cómo vencen las cuotas">
              <select value={settings.billing_mode_default} onChange={(e) => setS("billing_mode_default", e.target.value as Settings["billing_mode_default"])}>
                <option value="ANIVERSARIO">Desde el día que se asocia</option>
                <option value="CALENDARIO">Un día fijo de cada mes</option>
              </select>
            </Field>
            {settings.billing_mode_default === "CALENDARIO" && (
              <Field label="Día de vencimiento"><input type="number" min="1" max="28" value={settings.due_day} onChange={(e) => setS("due_day", num(e.target.value))} /></Field>
            )}
          </div>
          <div className="form-row">
            <Field label="Días de gracia" hint="Después del vencimiento puede seguir entrando."><div className="cb-input-suffix"><input type="number" min="0" max="60" value={settings.grace_days} onChange={(e) => setS("grace_days", num(e.target.value))} /><span>días</span></div></Field>
            <Field label="Avisar que vence con" hint="Se marca «por vencer» ese tiempo antes."><div className="cb-input-suffix"><input type="number" min="0" max="30" value={settings.due_soon_days} onChange={(e) => setS("due_soon_days", num(e.target.value))} /><span>días</span></div></Field>
          </div>
          <div className="form-row">
            <Field label="Recargo por atraso">
              <select value={settings.late_fee_mode} onChange={(e) => setS("late_fee_mode", e.target.value as Settings["late_fee_mode"])}>
                <option value="NINGUNO">Sin recargo</option>
                <option value="FIJO">Monto fijo</option>
                <option value="PORCENTAJE">Porcentaje</option>
              </select>
            </Field>
            {settings.late_fee_mode !== "NINGUNO" && (
              <Field label={settings.late_fee_mode === "FIJO" ? "Monto del recargo" : "Porcentaje del recargo"}>
                <div className="cb-input-suffix"><span>{settings.late_fee_mode === "FIJO" ? "$" : "%"}</span><input type="number" min="0" step="0.5" value={settings.late_fee_value} onChange={(e) => setS("late_fee_value", num(e.target.value))} /></div>
              </Field>
            )}
          </div>
          {settings.late_fee_mode !== "NINGUNO" && (
            <Field label="Se aplica a partir de"><div className="cb-input-suffix" style={{ maxWidth: 260 }}><input type="number" min="0" max="365" value={settings.late_fee_after_days} onChange={(e) => setS("late_fee_after_days", num(e.target.value))} /><span>días de atraso</span></div></Field>
          )}
          <div className="form-row">
            <Field label={`Descuento máximo de recepción`}><div className="cb-input-suffix"><input type="number" min="0" max="100" value={settings.max_discount_pct_recepcion} onChange={(e) => setS("max_discount_pct_recepcion", num(e.target.value))} /><span>%</span></div></Field>
            <Field label="Descuento máximo del encargado"><div className="cb-input-suffix"><input type="number" min="0" max="100" value={settings.max_discount_pct_encargado} onChange={(e) => setS("max_discount_pct_encargado", num(e.target.value))} /><span>%</span></div></Field>
          </div>
          <Field label="Pie de los recibos" hint="Los recibos siempre dicen «Documento no válido como factura».">
            <input value={settings.receipt_footer || ""} maxLength={300} onChange={(e) => setS("receipt_footer", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="cb-grid-2" style={{ marginTop: 16 }}>
        <div className="cb-card">
          <h2>{t("sessions", true)} y reservas</h2>
          <div className="product-form">
            <Field label={`Cancelar una reserva hasta`}><div className="cb-input-suffix"><input type="number" min="0" max="72" value={settings.cancel_window_hours} onChange={(e) => setS("cancel_window_hours", num(e.target.value))} /><span>horas antes</span></div></Field>
            <Field label="Se puede reservar con"><div className="cb-input-suffix"><input type="number" min="1" max="60" value={settings.booking_open_days} onChange={(e) => setS("booking_open_days", num(e.target.value))} /><span>días de anticipación</span></div></Field>
            <Field label="Clases de prueba"><input type="number" min="0" max="10" value={settings.trial_classes} onChange={(e) => setS("trial_classes", num(e.target.value))} /></Field>
          </div>
        </div>
        <div className="cb-card">
          <h2>{t("cert", true)} y congelamiento</h2>
          <div className="product-form">
            <Field label={`${t("cert", true)} obligatorio`}>
              <select value={settings.apto_required_mode} onChange={(e) => setS("apto_required_mode", e.target.value as Settings["apto_required_mode"])}>
                <option value="NO">No se exige</option>
                <option value="AVISAR">Se avisa en el ingreso</option>
                <option value="BLOQUEAR">Sin apto no entra</option>
              </select>
            </Field>
            <Field label="Vale por"><div className="cb-input-suffix"><input type="number" min="1" max="1825" value={settings.apto_validity_days} onChange={(e) => setS("apto_validity_days", num(e.target.value))} /><span>días</span></div></Field>
            <div className="form-row">
              <Field label="Congelar: mínimo"><div className="cb-input-suffix"><input type="number" min="1" max="365" value={settings.freeze_min_days} onChange={(e) => setS("freeze_min_days", num(e.target.value))} /><span>días</span></div></Field>
              <Field label="Congelar: máximo"><div className="cb-input-suffix"><input type="number" min="1" max="365" value={settings.freeze_max_days} onChange={(e) => setS("freeze_max_days", num(e.target.value))} /><span>días</span></div></Field>
            </div>
            <Field label="Veces por año"><input type="number" min="0" max="12" value={settings.freeze_max_per_year} onChange={(e) => setS("freeze_max_per_year", num(e.target.value))} /></Field>
          </div>
        </div>
      </div>
      <div className="cb-row" style={{ margin: "16px 0" }}>
        <button className="primary-button" onClick={() => saveSettings()}>Guardar políticas</button>
      </div>

      {isAdmin && (
        <div className="cb-card" style={{ marginBottom: 16 }}>
          <div className="cb-card-head">
            <div><h2>Mercado Pago</h2><p>Opcional: para cobrar cuotas con link de pago. La plata va directo a la cuenta del club.</p></div>
            {settings.has_mp_token && <span className={`cb-pill ${settings.mp_test_mode ? "cb-pill-orange" : "cb-pill-green"}`}>{settings.mp_test_mode ? "Modo prueba" : "Conectado"} {settings.mp_token_hint}</span>}
          </div>
          <div className="product-form">
            {!settings.has_mp_token ? (
              <>
                <Field label="Access Token de Mercado Pago" hint="Lo sacás en mercadopago.com.ar/developers → Tus integraciones → Credenciales. Empezá con el de prueba (TEST-…).">
                  <input value={mpToken} onChange={(e) => setMpToken(e.target.value)} placeholder="APP_USR-…" autoComplete="off" />
                </Field>
                <button className="primary-button" style={{ alignSelf: "flex-start" }} disabled={mpToken.trim().length < 10}
                  onClick={async () => { await saveSettings({ mp_access_token: mpToken.trim(), mp_enabled: true }, "Mercado Pago conectado"); setMpToken(""); }}>Conectar Mercado Pago</button>
              </>
            ) : (
              <div className="cb-row">
                <Switch on={!!settings.mp_enabled} onChange={(v) => saveSettings({ mp_enabled: v }, v ? "Cobros online activados" : "Cobros online pausados")} label="Cobrar online" hint="Si lo apagás, no se generan links de pago." />
                <button className="cb-link cb-link-danger" onClick={() => confirm("¿Desconectar Mercado Pago? Se dejan de generar links de pago.") && saveSettings({ mp_access_token: "", mp_enabled: false }, "Mercado Pago desconectado")}>Desconectar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="cb-card" style={{ marginBottom: 16 }}>
          <h2>Condiciones y privacidad</h2>
          <p className="cb-muted">Textos propios del club para su web. Pedí que los revise tu abogado o abogada: Clubedo no da garantías de cumplimiento.</p>
          <div className="product-form">
            <Field label="Condiciones del servicio (opcional)" hint="Se muestran en la página de condiciones del club, junto a las de Clubedo.">
              <textarea rows={5} value={settings.conditions_text || ""} maxLength={20000} onChange={(e) => setS("conditions_text", e.target.value)} />
            </Field>
            <Field label="Aclaraciones de privacidad (opcional)">
              <textarea rows={3} value={settings.privacy_extra || ""} maxLength={5000} onChange={(e) => setS("privacy_extra", e.target.value)} />
            </Field>
            <button className="primary-button" style={{ alignSelf: "flex-start" }}
              onClick={() => saveSettings({ conditions_text: settings.conditions_text || "", privacy_extra: settings.privacy_extra || "" }, "Textos guardados")}>Guardar textos</button>
          </div>
        </div>
      )}

      {isAdmin && <div style={{ marginBottom: 16 }}><BajaCard /></div>}

      <div className="cb-card" data-tour="config">
        <div className="cb-card-head"><div><h2>¿Cómo funcionamos?</h2><p>Volvé a ver el recorrido por el sistema.</p></div></div>
        <button type="button" className="secondary-button" onClick={startTour}>Ver el recorrido</button>
      </div>
      {flash}
    </section>
  );
}

export default Configuracion;
