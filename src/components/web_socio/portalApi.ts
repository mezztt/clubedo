import { API_URL } from "../../config";

const key = (slug: string) => `clubedo_member_${slug}`;

export function getPortalToken(slug: string): string {
  try { return localStorage.getItem(key(slug)) || ""; } catch { return ""; }
}
export function setPortalToken(slug: string, token: string) {
  try { if (token) localStorage.setItem(key(slug), token); else localStorage.removeItem(key(slug)); } catch { /* sin almacenamiento: queda en memoria */ }
}

function detail(data: any): string {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return "Revisá los datos que completaste";
  return "Ocurrió un error";
}

export class SessionExpired extends Error {}

/** fetch del portal del socio: usa el token del socio, que no sirve para nada del sistema del club */
export async function portalApi<T = any>(slug: string, path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.auth !== false) headers.Authorization = `Bearer ${getPortalToken(slug)}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: options.method || "GET", headers, body: options.body !== undefined ? JSON.stringify(options.body) : undefined });
  } catch {
    throw new Error("No se pudo conectar. Probá de nuevo en un momento.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && options.auth !== false) { setPortalToken(slug, ""); throw new SessionExpired("Tu sesión venció. Ingresá de nuevo."); }
  if (!res.ok) throw new Error(detail(data));
  return data as T;
}
