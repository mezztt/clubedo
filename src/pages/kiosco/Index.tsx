import { useCallback, useEffect, useRef, useState } from "react";
import { appApi } from "../../config";
import { ClubedoLogo } from "../../components/Brand";
import "../../clubedo.css";
import "../../c2.css";
import { cameraBlockReason, startCameraScan } from "../../lib/qrdecode";
import { DENIED_TEXT, decideOffline, loadCache, loadQueue, newRef, saveCache, saveQueue } from "./offline";
import type { Cache, Decision } from "./offline";

interface Config { club_name: string; member_word: string; capacity: number | null; inside: number; return_seconds: number; cache_refresh_seconds: number; texts: { ok: string; warn: string; denied: string } }
interface Show extends Decision { offline: boolean }

/** Kiosco de ingreso: la persona pasa su QR o DNI y ve un semáforo con ícono y texto. Nunca muestra montos ni motivos de deuda. */
function Index() {
  const [config, setConfig] = useState<Config | null>(null);
  const [online, setOnline] = useState(true);
  const [shown, setShown] = useState<Show | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(loadQueue().length);
  const inputRef = useRef<HTMLInputElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const busyRef = useRef(false);

  const focus = useCallback(() => { if (!shown) inputRef.current?.focus(); }, [shown]);
  useEffect(() => { focus(); const h = window.setInterval(focus, 1500); return () => window.clearInterval(h); }, [focus]);

  const flush = useCallback(async () => {
    const q = loadQueue();
    if (!q.length) { setPending(0); return; }
    try {
      await appApi("/access/offline-events", { method: "POST", body: { events: q.slice(0, 200) } });
      saveQueue(q.slice(200)); setPending(Math.max(0, q.length - 200));
    } catch { /* sigue sin internet */ }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [c, cache] = await Promise.all([appApi<Config>("/access/kiosk-config"), appApi<Cache>("/access/kiosk-cache")]);
      setConfig(c); saveCache(cache); setOnline(true); setError("");
      await flush();
    } catch (e) {
      setOnline(false);
      if (!loadCache()) setError(e instanceof Error ? e.message : "No se pudo conectar");
    }
  }, [flush]);
  useEffect(() => {
    refresh();
    const h = window.setInterval(refresh, 300000);
    const on = () => refresh();
    window.addEventListener("online", on);
    return () => { window.clearInterval(h); window.removeEventListener("online", on); };
  }, [refresh]);

  function present(d: Show) {
    setShown(d);
    window.clearTimeout(hideTimer.current ?? undefined);
    hideTimer.current = window.setTimeout(() => { setShown(null); setValue(""); }, ((config?.return_seconds || 4) * 1000));
  }

  const submit = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code || busyRef.current) return;
    busyRef.current = true; setBusy(true); setValue("");
    try {
      const r = await appApi<any>("/access/check", { method: "POST", body: { code, kiosk_id: "kiosco" } });
      setOnline(true);
      present({ result: r.result, name: r.member?.name || null, message: r.message, warnings: r.warnings || [], reason_code: null,
        photo: r.member?.photo, plan: r.member?.plan, ends_on: r.member?.ends_on, offline: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("conectar") || msg.includes("Failed")) {
        setOnline(false);
        const d = decideOffline(code, loadCache(), new Date());
        const q = loadQueue();
        q.push({ client_ref: newRef(), code, at: new Date().toISOString().slice(0, 19), result: d.result, reason_code: d.reason_code });
        saveQueue(q); setPending(q.length);
        present({ ...d, offline: true });
      } else {
        present({ result: "DENEGADO", name: null, message: DENIED_TEXT, warnings: [], reason_code: null, offline: false });
      }
    } finally { busyRef.current = false; setBusy(false); }
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = !shown ? "" : shown.result === "OK" ? "is-ok" : shown.result === "OK_AVISO" ? "is-warn" : "is-no";
  const title = !shown ? "" : shown.result === "OK" ? (config?.texts.ok || "¡Bienvenido!") : shown.result === "OK_AVISO" ? (config?.texts.warn || "Pasá, pero fijate el aviso") : DENIED_TEXT;
  const word = config?.member_word || "socio";

  return (
    <main className="kiosk">
      <header className="kiosk-top">
        <div className="cb-row"><ClubedoLogo size={36} /><strong>{config?.club_name || "Ingreso"}</strong></div>
        <div className="cb-row">
          {config?.capacity ? <span className="kiosk-badge">Adentro: {config.inside} de {config.capacity}</span> : null}
          <span className={`kiosk-badge ${online ? "" : "is-off"}`}>{online ? "Con internet" : "Sin internet: funciona con la lista guardada"}</span>
          {pending > 0 && <span className="kiosk-badge is-off">{pending} ingreso{pending > 1 ? "s" : ""} por subir</span>}
        </div>
      </header>
      <section className="kiosk-stage">
        <h1>Identificate para entrar</h1>
        <p className="kiosk-hint">Acercá el código QR de tu carnet al lector o a la cámara, o escribí tu DNI y apretá Enter.</p>
        <form onSubmit={(e) => { e.preventDefault(); submit(value); }}>
          <input ref={inputRef} className="kiosk-input" inputMode="numeric" autoComplete="off" autoFocus value={value}
            onChange={(e) => setValue(e.target.value)} placeholder="DNI o código" aria-label={`DNI o código del ${word}`} disabled={busy} />
        </form>
        <div className="c2-actions">
          <button className="primary-button" onClick={() => submit(value)} disabled={busy || !value.trim()}>Entrar</button>
          <button className="secondary-button" onClick={() => { setError(""); setCamera((c) => !c); }}>{camera ? "Cerrar cámara" : "Usar la cámara"}</button>
        </div>
        {camera && <Camera onCode={(c) => { setCamera(false); submit(c); }} onFail={(m) => { setError(m); setCamera(false); }} />}
        {error && <div className="cb-note cb-note-error" role="alert">{error}</div>}
      </section>
      {shown && (
        <div className={`kiosk-result ${cls}`} role="alert" aria-live="assertive" onClick={() => { setShown(null); setValue(""); window.clearTimeout(hideTimer.current ?? undefined); }}>
          {shown.photo ? <img src={shown.photo} alt="" /> : null}
          <div className="kiosk-icon" aria-hidden="true">{shown.result === "DENEGADO" ? "✕" : shown.result === "OK" ? "✓" : "!"}</div>
          <h1>{title}</h1>
          {shown.name && <p><strong>{shown.name}</strong></p>}
          {shown.result !== "DENEGADO" && shown.plan && <p>{shown.plan}{shown.ends_on ? ` · al día hasta el ${shown.ends_on.split("-").reverse().join("/")}` : ""}</p>}
          {shown.warnings.map((w, i) => <p key={i}>{w}</p>)}
          {shown.offline && <p>Registrado sin internet</p>}
        </div>
      )}
    </main>
  );
}

function Camera({ onCode, onFail }: { onCode: (c: string) => void; onFail: (m: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    const reason = cameraBlockReason();
    if (reason || !v) { onFail(reason || "No pudimos abrir la cámara. Revisá el permiso del navegador o usá el lector."); return; }
    // QR con BarcodeDetector o con lib/qrdecode; el PDF417 del DNI solo se lee si el navegador tiene BarcodeDetector.
    const scan = startCameraScan(v, (text) => { scan.stop(); onCode(text); }, { formats: ["qr_code", "pdf417"], onError: onFail });
    return () => scan.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <video ref={ref} className="kiosk-video" muted playsInline aria-label="Cámara para leer el código" />;
}

export default Index;
