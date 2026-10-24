import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

export interface PersonData {
  first_name: string; last_name: string; dni: string; phone: string; email: string; birth_date: string;
  guardian_name: string; guardian_dni: string; guardian_phone: string; consent: boolean;
}
export const emptyPerson = (): PersonData => ({ first_name: "", last_name: "", dni: "", phone: "", email: "", birth_date: "", guardian_name: "", guardian_dni: "", guardian_phone: "", consent: false });

function isMinor(birth: string): boolean {
  if (!birth) return false;
  const b = new Date(birth + "T12:00:00");
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  return age < 18;
}

/** Datos de la persona para los formularios públicos (prueba, alta, evento). Pide consentimiento y, si es menor, a su responsable. */
export function PersonForm({ slug, submitLabel, busy, error, onSubmit, extra, compact }: {
  slug: string; submitLabel: string; busy: boolean; error: string; onSubmit: (p: PersonData) => void; extra?: ReactNode; compact?: boolean;
}) {
  const [p, setP] = useState<PersonData>(emptyPerson());
  const set = (k: keyof PersonData, v: string | boolean) => setP((x) => ({ ...x, [k]: v }));
  const minor = isMinor(p.birth_date);
  function submit(e: FormEvent) { e.preventDefault(); onSubmit(p); }
  const f = (id: string, label: string, key: keyof PersonData, props: Record<string, any> = {}) => (
    <div className="cw-field"><label htmlFor={id}>{label}</label><input id={id} value={p[key] as string} onChange={(e) => set(key, e.target.value)} {...props} /></div>
  );
  return (
    <form onSubmit={submit} noValidate>
      {error && <div className="cw-error" role="alert">{error}</div>}
      <div className="cw-row">{f("pf-first", "Nombre", "first_name", { autoComplete: "given-name", maxLength: 80 })}{f("pf-last", "Apellido", "last_name", { autoComplete: "family-name", maxLength: 80 })}</div>
      <div className="cw-row">{f("pf-dni", "DNI", "dni", { inputMode: "numeric", maxLength: 12 })}{f("pf-phone", "Teléfono con código de área", "phone", { inputMode: "tel", autoComplete: "tel", placeholder: "261 555 1234" })}</div>
      {!compact && f("pf-email", "Email (opcional)", "email", { type: "email", autoComplete: "email" })}
      {f("pf-birth", "Fecha de nacimiento", "birth_date", { type: "date" })}
      {minor && (
        <div className="cw-summary">
          <strong>Sos menor de edad: necesitamos a tu madre, padre o responsable</strong>
          {f("pf-gn", "Nombre del responsable", "guardian_name")}
          <div className="cw-row">{f("pf-gd", "DNI del responsable", "guardian_dni", { inputMode: "numeric" })}{f("pf-gp", "Teléfono del responsable", "guardian_phone", { inputMode: "tel" })}</div>
        </div>
      )}
      {extra}
      <label className="pw-check">
        <input type="checkbox" checked={p.consent} onChange={(e) => set("consent", e.target.checked)} />
        <span>Acepto las <Link to={`/c/${slug}/condiciones`} target="_blank">Condiciones del club</Link> y la <Link to="/legal/privacidad" target="_blank">Política de Privacidad</Link>, y que el club use mis datos para contactarme.</span>
      </label>
      <button className="cw-btn" type="submit" disabled={busy || !p.consent}>{busy ? "Enviando..." : submitLabel}</button>
    </form>
  );
}
