// Configuración compartida de Clubedo · by Mezztt
// En local usa el backend de tu PC. Online se define VITE_API_URL al compilar (ver .env.example).
import { useEffect, useState } from "react";

export const API_URL = ((typeof window !== "undefined" && (window as any).mezzttApp?.apiUrl) || import.meta.env.VITE_API_URL || "http://127.0.0.1:8050").replace(/\/$/, "");

export const APP_NAME = "Clubedo";
export const APP_VERSION = "1.0.0";
export const APP_BRAND = "Mezztt";

/** Enlaces de marca por defecto (Mezztt los cambia desde Configuración del panel; ver useBrandLinks en components/Brand) */
export interface BrandLinks { system_instagram_url: string; mezztt_instagram_url: string; mezztt_site_url: string }
export const DEFAULT_BRAND_LINKS: BrandLinks = {
  system_instagram_url: "https://instagram.com/clubedo.mezztt",
  mezztt_instagram_url: "https://instagram.com/mezzttofficial",
  mezztt_site_url: "https://mezztt.site",
};

export const ADMIN_TOKEN_KEY = "clubedo_admin_token";
export const TOKEN_KEY = "clubedo_token";
export const USER_KEY = "clubedo_user";
export const THEME_KEY = "clubedo_theme";
export const VOCAB_KEY = "clubedo_vocab";

/** Link público de la web de un club (si contrató la web) */
export function publicSiteUrl(slug: string | null | undefined): string {
  return `${window.location.origin}/c/${slug || ""}`;
}

// =====================================================================
// RUBROS Y VOCABULARIO
// El rubro solo cambia textos y plantillas (nunca los módulos contratados).
// La verdad es GET /config/vocab; esta tabla es para el primer pintado.
// =====================================================================
export type Rubro = "GIMNASIO" | "BOX" | "PILATES_YOGA" | "NATACION" | "ARTES_MARCIALES" | "CLUB";
export const RUBRO_KEYS: Rubro[] = ["GIMNASIO", "BOX", "PILATES_YOGA", "NATACION", "ARTES_MARCIALES", "CLUB"];
export const RUBRO_LABELS: Record<Rubro, string> = {
  GIMNASIO: "Gimnasio",
  BOX: "Box de funcional / CrossFit",
  PILATES_YOGA: "Pilates y yoga",
  NATACION: "Natación",
  ARTES_MARCIALES: "Artes marciales",
  CLUB: "Club social o deportivo",
};
export const RUBRO_SHORT: Record<Rubro, string> = {
  GIMNASIO: "Gimnasio", BOX: "Box", PILATES_YOGA: "Pilates y yoga", NATACION: "Natación", ARTES_MARCIALES: "Artes marciales", CLUB: "Club",
};
/** Módulos que el panel tilda al elegir el rubro de un club nuevo (se pueden cambiar a mano). Mismos datos que backend/rubros.py */
export const RUBRO_SUGGESTED_MODULES: Record<Rubro, string[]> = {
  GIMNASIO: ["socios", "membresias", "cobranza", "acceso", "clases", "entrenamiento", "salud", "instructores", "caja", "avisos", "web_publica", "web_socio", "reportes"],
  BOX: ["socios", "membresias", "cobranza", "clases", "entrenamiento", "instructores", "salud", "caja", "avisos", "web_socio"],
  PILATES_YOGA: ["socios", "membresias", "cobranza", "clases", "instructores", "avisos", "web_publica", "web_socio"],
  NATACION: ["socios", "membresias", "cobranza", "acceso", "clases", "salud", "instructores", "eventos", "caja", "web_socio"],
  ARTES_MARCIALES: ["socios", "membresias", "cobranza", "clases", "salud", "instructores", "eventos", "web_socio"],
  CLUB: ["socios", "membresias", "cobranza", "acceso", "clases", "instructores", "eventos", "caja", "avisos", "web_publica", "web_socio", "reportes"],
};
export const RUBRO_TAGLINES: Record<Rubro, string> = {
  GIMNASIO: "Acceso, rutinas y cobranza",
  BOX: "Clases con cupo y rutinas",
  PILATES_YOGA: "Clases, cupos y web de reservas",
  NATACION: "Clases, aptos médicos y eventos",
  ARTES_MARCIALES: "Clases, graduaciones y torneos",
  CLUB: "Cuotas, acceso, eventos y web del club",
};
export const VOCAB_CONCEPTS = ["member", "plan", "session", "space", "instructor", "training", "group", "baja", "cert"] as const;
export const VOCAB_CONCEPT_LABELS: Record<string, string> = {
  member: "Quién se asocia", plan: "Plan o cuota", session: "Clase o turno", space: "Lugar", instructor: "Quién da la clase",
  training: "Entrenamiento", group: "Grupo", baja: "Baja", cert: "Certificado de salud",
};

export type Vocab = Record<string, string>;
const v = (member: string, members: string, plan: string, plans: string, session: string, sessions: string, space: string, spaces: string,
  instructor: string, instructors: string, training: string, trainings: string, group: string, groups: string, baja: string, cert: string): Vocab =>
  ({ member, members, plan, plans, session, sessions, space, spaces, instructor, instructors, training, trainings, group, groups, baja, cert });

export const DEFAULT_VOCAB: Record<Rubro, Vocab> = {
  GIMNASIO: v("socio", "socios", "plan", "planes", "clase", "clases", "sala", "salas", "profe", "profes", "rutina", "rutinas", "grupo", "grupos", "baja", "apto médico"),
  BOX: v("atleta", "atletas", "membresía", "membresías", "clase", "clases", "box", "boxes", "coach", "coaches", "programación", "programaciones", "grupo", "grupos", "baja", "apto médico"),
  PILATES_YOGA: v("alumno", "alumnos", "abono", "abonos", "clase", "clases", "sala", "salas", "instructor", "instructores", "secuencia", "secuencias", "grupo de nivel", "grupos de nivel", "baja", "apto médico"),
  NATACION: v("alumno", "alumnos", "abono", "abonos", "turno de pileta", "turnos de pileta", "carril", "carriles", "profe", "profes", "nivel", "niveles", "nivel", "niveles", "baja", "apto médico y de pileta"),
  ARTES_MARCIALES: v("alumno", "alumnos", "cuota", "cuotas", "clase", "clases", "tatami", "tatamis", "sensei", "senseis", "graduación", "graduaciones", "grado", "grados", "baja", "apto médico"),
  CLUB: v("socio", "socios", "cuota social", "cuotas sociales", "actividad", "actividades", "cancha", "canchas", "profe", "profes", "categoría", "categorías", "categoría", "categorías", "baja de asociado", "apto médico o ficha de federación"),
};

/** Vocabulario vigente (el último que mandó el backend, o el del rubro) */
let currentVocab: Vocab = DEFAULT_VOCAB.GIMNASIO;
const vocabListeners = new Set<() => void>();

function readStoredVocab(): Vocab | null {
  try {
    const raw = localStorage.getItem(VOCAB_KEY);
    return raw ? (JSON.parse(raw) as Vocab) : null;
  } catch { return null; }
}

export function setVocab(vocab: Vocab | null | undefined, remember = true) {
  if (!vocab) return;
  currentVocab = { ...DEFAULT_VOCAB.GIMNASIO, ...vocab };
  if (remember) { try { localStorage.setItem(VOCAB_KEY, JSON.stringify(currentVocab)); } catch { /* sin almacenamiento: no pasa nada */ } }
  vocabListeners.forEach((fn) => fn());
}

/** Arranca con lo último que se guardó o, si no hay, con el rubro de la sesión */
export function initVocab(rubro?: string | null) {
  const stored = readStoredVocab();
  if (stored) { currentVocab = { ...DEFAULT_VOCAB.GIMNASIO, ...stored }; return; }
  if (rubro && rubro in DEFAULT_VOCAB) currentVocab = DEFAULT_VOCAB[rubro as Rubro];
}

/** Palabra del rubro: t("member") -> "socio"; t("members") -> "socios". cap=true pone mayúscula inicial. */
export function t(key: string, cap = false): string {
  const w = currentVocab[key] || DEFAULT_VOCAB.GIMNASIO[key] || key;
  return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

/** Hook: devuelve t() y vuelve a pintar si cambia el vocabulario. Pide GET /config/vocab una vez por sesión. */
let vocabRequested = false;
export function useVocab() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    vocabListeners.add(fn);
    if (!vocabRequested && localStorage.getItem(TOKEN_KEY)) {
      vocabRequested = true;
      appApi<{ rubro: string; vocab: Vocab }>("/config/vocab").then((r) => setVocab(r.vocab)).catch(() => { vocabRequested = false; });
    }
    return () => { vocabListeners.delete(fn); };
  }, []);
  return { t, vocab: currentVocab };
}
/** Vuelve a pedir el vocabulario (después de cambiar el rubro o las palabras) */
export async function refreshVocab() {
  const r = await appApi<{ rubro: string; vocab: Vocab }>("/config/vocab");
  setVocab(r.vocab);
}

// =====================================================================
// MÓDULOS
// =====================================================================
/** Núcleo: incluido, no se cobra */
export const CORE_MODULES = ["inicio", "configuracion", "usuarios"];
/** Módulos cobrables (USD 6 c/u) */
export const BILLABLE_MODULES = ["socios", "membresias", "cobranza", "acceso", "clases", "entrenamiento", "salud", "instructores", "caja", "reportes", "avisos", "eventos"];
/** Webs públicas (USD 20 c/u) */
export const WEB_MODULES = ["web_publica", "web_socio"];
export const EXTRA_MODULES = WEB_MODULES;
export const ALL_MODULES = [...BILLABLE_MODULES, ...WEB_MODULES];

/** Dependencias (las mismas que valida el backend) */
export const MODULE_DEPENDENCIES: Record<string, string[]> = {
  acceso: ["socios"], cobranza: ["socios", "membresias"], clases: ["socios"], entrenamiento: ["socios"], salud: ["socios"],
  instructores: ["socios"], reportes: ["socios"], avisos: ["socios"], eventos: ["socios"], web_publica: ["socios"], web_socio: ["socios"],
};
export const MODULE_ANY_OF: Record<string, string[]> = { web_publica: ["clases", "membresias"] };

export const MODULE_LABELS: Record<string, string> = {
  inicio: "Inicio", configuracion: "Configuración", usuarios: "Usuarios", bajas: "Bajas",
  socios: "Socios", membresias: "Planes y cuotas", cobranza: "Cobranza y mora", acceso: "Control de acceso",
  clases: "Clases y reservas", entrenamiento: "Rutinas y seguimiento", salud: "Apto médico y cumplimiento",
  instructores: "Instructores y comisiones", caja: "Caja y ventas", reportes: "Reportes y deserción",
  avisos: "Avisos y campañas", eventos: "Eventos y competencias",
  web_publica: "Web del club", web_socio: "Portal del socio",
};
export const MODULE_HINTS: Record<string, string> = {
  inicio: "Lo que tenés que resolver hoy y el resumen del día.",
  configuracion: "Datos del club, rubro, políticas y textos legales.",
  usuarios: "Tu equipo, con el rol de cada uno.",
  socios: "Ficha de cada persona, grupo familiar, QR e importación desde Excel.",
  membresias: "Planes, vencimientos, pagos, congelamiento, aumentos y recibos.",
  cobranza: "Deudores, recordatorios con mensaje listo, link de pago y plan de pagos.",
  acceso: "Kiosco de ingreso por QR o DNI con semáforo y registro de ingresos.",
  clases: "Grilla semanal con cupo, reservas, lista de espera y asistencia.",
  entrenamiento: "Rutinas, ejercicios, medidas, marcas y graduaciones.",
  salud: "Aptos con vencimiento, declaración de salud y legajo del local.",
  instructores: "Perfil, horarios, reglas de comisión y liquidación mensual.",
  caja: "Venta de productos y servicios, stock, caja diaria y cierre.",
  reportes: "Deserción, retención, ingresos, asistencia y morosidad.",
  avisos: "Plantillas de mensajes, cola de envíos manuales y cartelera.",
  eventos: "Torneos, exámenes y festivales con inscripción y cobro.",
  web_publica: "Página del club con horarios, planes, clase de prueba y alta online.",
  web_socio: "Portal para que cada persona vea su QR, reserve y pague.",
};

/** Nombre del módulo con las palabras del rubro: "Socios" -> "Atletas", "Clases y reservas" -> "Turnos de pileta y reservas" */
export function moduleLabel(module: string): string {
  switch (module) {
    case "socios": return t("members", true);
    case "membresias": return `${t("plans", true)} y cuotas`;
    case "clases": return `${t("sessions", true)} y reservas`;
    case "entrenamiento": return `${t("trainings", true)} y seguimiento`;
    case "salud": return `${t("cert", true)} y cumplimiento`;
    case "instructores": return `${t("instructors", true)} y comisiones`;
    case "web_socio": return `Portal del ${t("member")}`;
    default: return MODULE_LABELS[module] || module;
  }
}
export function moduleHint(module: string): string {
  return MODULE_HINTS[module] || "";
}

/** Mensajes de lo que le falta a una selección de módulos */
export function missingDependencies(modules: string[]): string[] {
  const have = new Set(modules);
  const out: string[] = [];
  for (const m of ALL_MODULES) {
    if (!have.has(m)) continue;
    const need = (MODULE_DEPENDENCIES[m] || []).filter((d) => !have.has(d));
    if (need.length) out.push(`${MODULE_LABELS[m]} necesita: ${need.map((d) => MODULE_LABELS[d]).join(", ")}`);
    const any = MODULE_ANY_OF[m];
    if (any && !any.some((d) => have.has(d))) out.push(`${MODULE_LABELS[m]} necesita al menos uno de: ${any.map((d) => MODULE_LABELS[d]).join(", ")}`);
  }
  return out;
}

/** Ícono (components/Icons) de cada módulo del menú */
export const MODULE_ICONS: Record<string, string> = {
  inicio: "home", socios: "users", membresias: "card", cobranza: "wallet", acceso: "scan", clases: "classes", entrenamiento: "dumbbell",
  salud: "heart", instructores: "instructor", caja: "bag", reportes: "reports", avisos: "megaphone", eventos: "trophy",
  usuarios: "customers", configuracion: "settings", bajas: "userx", web_publica: "store", web_socio: "users",
};
export function pathFor(m: string): string {
  return m === "inicio" ? "/app" : `/app/${m}`;
}

/** Orden y secciones del menú lateral */
export const MENU_SECTIONS: { section: string; items: string[] }[] = [
  { section: "DÍA A DÍA", items: ["inicio", "socios", "membresias", "cobranza", "acceso", "clases", "caja"] },
  { section: "SEGUIMIENTO", items: ["entrenamiento", "salud", "instructores", "eventos", "avisos", "reportes"] },
  { section: "EL CLUB", items: ["bajas", "usuarios", "configuracion"] },
];

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador/a", ENCARGADO: "Encargado/a", RECEPCION: "Recepción", INSTRUCTOR: "Instructor/a", KIOSCO: "Kiosco",
};
export const ROLE_HINTS: Record<string, string> = {
  ADMINISTRADOR: "Ve y hace todo, incluida la configuración y el equipo.",
  ENCARGADO: "Opera todo el día a día y la configuración operativa.",
  RECEPCION: "Cobra, da de alta y controla el ingreso.",
  INSTRUCTOR: "Ve sus clases, toma asistencia y carga rutinas.",
  KIOSCO: "Solo sirve para la tablet de ingreso: no ve montos.",
};
export const ROLES_ALL = ["ADMINISTRADOR", "ENCARGADO", "RECEPCION", "INSTRUCTOR", "KIOSCO"];

// =====================================================================
// HELPERS
// =====================================================================
export function splitList(value: string | null | undefined): string[] {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function money(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  const body = Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (n < 0 && Number(Math.abs(n).toFixed(decimals)) !== 0 ? "-$" : "$") + body;  // negativos: "-$1.500", nunca "$-1.500"
}

/** Importe en dólares: "USD 38,72" (los precios de Clubedo se cotizan en USD) */
export function usd(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  const body = Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (n < 0 && Number(Math.abs(n).toFixed(decimals)) !== 0 ? "-USD " : "USD ") + body;
}

/** Planes sobre el abono mensual M (iguales a los del backend, schemas.py): trimestral paga 2 de 3 meses, anual 10 de 12 */
export const TRIMESTRAL_MESES_PAGOS = 2;
export const ANUAL_MESES_PAGOS = 10;
export function plansFor(monthly: number | string | null | undefined) {
  const m = Number(monthly || 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { quarterly: r(m * TRIMESTRAL_MESES_PAGOS), annual: r(m * ANUAL_MESES_PAGOS), annualSaving: r(m * (12 - ANUAL_MESES_PAGOS)) };
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const v = value.length === 10 ? value + "T12:00:00" : value;
  return new Date(v).toLocaleDateString("es-AR");
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("es-AR")} ${hhmm(d)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Date -> "2026-10-01T18:30:00" (hora local, lo que espera el backend) */
export function toLocalISO(d: Date): string {
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60000);
}
export function hhmm(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function timeRange(start: string | Date, end: string | Date): string {
  return `${hhmm(start)}–${hhmm(end)}`;
}
export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]; // 0 = lunes (como el backend)

export function dayLabel(d: Date, short = true): string {
  const today = new Date();
  const k = dayKey(d);
  if (k === dayKey(today)) return "Hoy";
  if (k === dayKey(addDays(today, 1))) return "Mañana";
  if (k === dayKey(addDays(today, -1))) return "Ayer";
  return short ? `${DAYS_ES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` : longDate(d);
}
export function longDate(d: Date): string {
  const txt = `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const t = `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function shiftPeriod(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function minutesLabel(min: number): string {
  if (min % 60 === 0) return `${min / 60} h`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${min} min`;
}
export function initials(name: string): string {
  return name.replace(/^(lic|prof)\.?\s+/i, "").split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Descarga un archivo del backend (CSV) con el token de la sesión */
export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga en el navegador un archivo ya armado */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Arma un CSV que Excel abre bien (separado por ; y con acentos) y lo descarga */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
    return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const text = [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  saveBlob(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }), filename);
}

/** Descarga un archivo del panel general (con el token del panel) */
export async function adminDownload(path: string, fallbackName: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const match = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "");
  saveBlob(await res.blob(), match ? match[1] : fallbackName);
}

// =====================================================================
// FETCH
// =====================================================================
function adminHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/** fetch para el panel general (Mezztt). Si el token venció, vuelve al login. */
export async function adminApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: adminHeaders(options.body !== undefined),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401 || response.status === 403) {
    if (path !== "/admin/me/password" && !path.endsWith("/toggle-active")) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = "/";
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

function detailText(data: any): string {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return "Revisá los datos: " + d.map((x: any) => (x.loc || []).slice(-1)[0]).join(", ");
  return "Ocurrió un error";
}

/** fetch para el sistema del club. Si la sesión venció, vuelve al login. */
export async function appApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** Sube un archivo (multipart). No lleva Content-Type: el navegador arma el boundary. */
export async function appUpload<T = any>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` },
      body: form,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }
  if (response.status === 413) throw new Error("El archivo es demasiado grande");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** Trae un archivo protegido (imagen, PDF) con el token en el encabezado, nunca en la URL */
export async function appBlob(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` } });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(detailText(data));
  }
  return response.blob();
}

/** fetch público (webs del club, sin login) */
export async function publicApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar. Probá de nuevo en un momento.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}


// =====================================================================
// SESIÓN
// =====================================================================
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  company_id: number;
  company_name: string;
  company_slug: string | null;
  role: string;
  rubro: Rubro;
  instructor_id: number | null;
  enabled_modules: string;
}

export function getSessionUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

/** Qué secciones ve cada rol (además de que el módulo esté contratado). Es la misma tabla que usa el backend. */
const ROLE_ACCESS: Record<string, string[]> = {
  ADMINISTRADOR: ["*"],
  ENCARGADO: ["*"],
  RECEPCION: ["inicio", "socios", "membresias", "cobranza", "acceso", "clases", "entrenamiento", "salud", "caja", "avisos", "eventos", "bajas"],
  INSTRUCTOR: ["inicio", "socios", "acceso", "clases", "entrenamiento", "salud", "instructores", "reportes", "eventos"],
  KIOSCO: [],
};

export function canAccess(user: SessionUser | null, module: string): boolean {
  if (!user) return false;
  const enabled = CORE_MODULES.includes(module) || module === "bajas" || splitList(user.enabled_modules).includes(module);
  if (!enabled) return false;
  if (module === "usuarios") return user.role === "ADMINISTRADOR";
  if (module === "configuracion") return user.role === "ADMINISTRADOR" || user.role === "ENCARGADO";
  const allowed = ROLE_ACCESS[user.role] || [];
  return allowed.includes("*") || allowed.includes(module);
}

// =====================================================================
// PANEL (Mezztt)
// =====================================================================
export interface SystemItem {
  id: number;
  name: string;
  rubro: Rubro;
  slug: string | null;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  enabled_modules: string | null;
  client_price: number | string | null;
  payment_status: string;
  payment_due_date: string | null;
  billed: boolean;
  apply_iva: boolean;
  archived: boolean;
  cancel_requested_at?: string | null;   // baja del servicio pedida por la empresa
  service_end_date?: string | null;       // el sistema funciona hasta esta fecha
  notes: string | null;
  created_at: string;
}
export interface PaymentItem { id: number; company_id: number; amount: number | string; payment_date: string; method: string | null; notes: string | null }
export const GRACE_DAYS = 10;
export function isOverdue(s: Pick<SystemItem, "payment_due_date" | "payment_status">): boolean {
  if (!s.payment_due_date || s.payment_status === "al_dia") return false;
  const limit = new Date(s.payment_due_date);
  limit.setDate(limit.getDate() + GRACE_DAYS);
  return new Date() > limit;
}
export function systemStatus(s: SystemItem): { label: string; tone: "ok" | "warn" | "off" } {
  if (s.service_end_date && !s.archived) return { label: `Baja solicitada · hasta ${s.service_end_date.slice(0, 10).split("-").reverse().join("/")}`, tone: "warn" };
  if (s.archived) return { label: "Dado de baja", tone: "off" };
  if (isOverdue(s)) return { label: "Pago atrasado", tone: "warn" };
  return { label: "Activo", tone: "ok" };
}
export const PAYMENT_STATUS_LABELS: Record<string, string> = { al_dia: "Al día", pendiente: "Pendiente", vencido: "Vencido" };

/** Precios de Clubedo (USD): configuración (una vez), precio por módulo y precio de cada web */
export interface BillingPrices { base_cost: number | string; module_price: number | string; web_price: number | string }
export interface PriceBreakdown {
  setup: number; modulesCount: number; modulesTotal: number; web: number; websCount: number;
  monthlySubtotal: number; monthlyTotal: number; initialSubtotal: number; initialTotal: number;
}
/**
 * Pago inicial (una sola vez) = configuración + módulos + webs.
 * Abono mensual = módulos + webs (la configuración no se cobra por mes).
 */
export function priceBreakdown(modules: string[], prices: BillingPrices | null, iva: boolean): PriceBreakdown {
  const mods = [...new Set(modules)].filter((m) => ALL_MODULES.includes(m));
  const modulesCount = mods.filter((m) => !EXTRA_MODULES.includes(m)).length;
  const setup = Number(prices?.base_cost ?? 0);
  const modulesTotal = Number(prices?.module_price ?? 0) * modulesCount;
  const websCount = mods.filter((m) => EXTRA_MODULES.includes(m)).length;
  const web = Number(prices?.web_price ?? 0) * websCount;
  const monthlySubtotal = modulesTotal + web;
  const initialSubtotal = setup + monthlySubtotal;
  const f = iva ? 1.21 : 1;
  return { setup, modulesCount, modulesTotal, web, websCount, monthlySubtotal, monthlyTotal: monthlySubtotal * f, initialSubtotal, initialTotal: initialSubtotal * f };
}

// =====================================================================
// COMUNES
// =====================================================================
/** Ítem del panel «Pendientes» de Inicio (GET /dashboard/pending) */
export interface PendingItem { key: string; label: string; count: number; path: string; hint: string; tone: "warn" | "alert" | "info" }

export const PAYMENT_METHODS = ["EFECTIVO", "TRANSFERENCIA", "DEBITO", "CREDITO", "MERCADOPAGO", "OTRO"];
export const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", DEBITO: "Débito", CREDITO: "Crédito", MERCADOPAGO: "Mercado Pago", OTRO: "Otro",
};
