import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, dayKey, addDays, hhmm, money, moduleLabel, shortDate, t as vocab } from "../config";
import type { SessionUser } from "../config";
import { ClubedoLogo } from "./Brand";

/**
 * Asistente de Clubedo.
 * Responde con datos reales del club (consultando la API del propio sistema) y explica cómo usar cada pantalla.
 * Va por reglas: no usa IA externa, no tiene costo y respeta los módulos contratados y el rol de quien pregunta.
 */

interface Msg {
  from: "bot" | "user";
  text: string;
  actions?: { label: string; to: string }[];
}

type Handler = (raw: string, t: string) => Promise<Msg>;

interface Intent {
  id: string;
  keys: string[];
  mod: string;                  // módulo que tiene que ver el usuario
  ok?: () => boolean;           // condición extra (rol)
  run: Handler;
}

interface Help {
  id: string;
  keys: string[];
  mod?: string;
  ok?: () => boolean;
  text: () => string;
  to?: string;
  label?: string;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim();

/** Distancia de edición (para tolerar errores de tipeo) */
function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** ¿La frase (ya normalizada) contiene la clave? Tolera plurales, terminaciones y 1-2 letras mal puestas. */
function hit(t: string, key: string): boolean {
  if (key.includes(" ")) return t.includes(key);
  const toks = t.split(" ");
  if (key.length <= 4) return toks.some((w) => w === key || (key.length >= 3 && w.startsWith(key)));
  if (t.includes(key)) return true;
  const tol = key.length >= 8 ? 2 : 1;
  return toks.some((w) => w.length >= 4 && lev(w, key) <= tol);
}
/** Las claves largas o de varias palabras pesan más que las sueltas y genéricas */
const score = (t: string, keys: string[]) => keys.reduce((n, k) => n + (hit(t, k) ? (k.includes(" ") || k.length >= 7 ? 2 : 1) : 0), 0);

const HOWTO = ["como", "donde", "que hago", "ayuda", "se puede", "puedo", "quiero", "necesito", "pasos", "explicame", "para que sirve"];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const goTo = (label: string, to: string) => ({ label, to });

function Assistant({ user }: { user: SessionUser | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // en el celular el botón se esconde al bajar la pantalla (así no tapa los botones de acción del final) y vuelve al subir
  const [tuck, setTuck] = useState(false);
  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | Document;
      const y = t instanceof Document ? window.scrollY : (t as HTMLElement).scrollTop;
      const prev = last.get(t);
      if (prev === undefined) { last.set(t, y); return; }
      if (Math.abs(y - prev) > 6) { setTuck(y > prev && y > 60); last.set(t, y); }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  
  const role = user?.role || "";
  const can = (m: string) => canAccess(user, m);
  const isInstr = role === "INSTRUCTOR";
  const isBoss = role === "ADMINISTRADOR" || role === "ENCARGADO";
  const canGo = (to: string) => {
    const m = to.split("/")[2] || "inicio";
    return can(m);
  };
  const acts = (...a: { label: string; to: string }[]) => {
    const list = a.filter((x) => canGo(x.to));
    return list.length ? list : undefined;
  };

  useEffect(() => {
    if (open && msgs.length === 0) {
      const first = (user?.name || "").split(" ")[0];
      setMsgs([{
        from: "bot",
        text: `Hola${first ? ` ${first}` : ""}. Soy el asistente de ${user?.company_name || "Clubedo"}. Te cuento cómo viene el día (cobros, ingresos, clases, deudores), busco ${vocab("members")} y te explico cómo hacer cada cosa.`,
      }]);
    }
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const M = vocab("member");
  const MS = vocab("members");

  // -------------------------------------------------------------------- consultas con datos reales
  const INTENTS: Intent[] = [
    {
      id: "pendientes", mod: "inicio",
      keys: ["pendiente", "pendientes", "que tengo que hacer", "que hay que hacer", "tareas", "resumen", "como viene el dia", "como va el dia", "novedades", "urgente"],
      run: async () => {
        const r = await appApi<{ items: { label: string; count: number; hint: string; path: string; tone: string }[] }>("/dashboard/pending");
        if (!r.items.length) return { from: "bot", text: "No tenés nada pendiente por ahora. Todo al día." };
        return {
          from: "bot",
          text: "Esto es lo que hay para resolver:\n" + r.items.slice(0, 7).map((i) => `• ${i.label}: ${i.count}${i.hint ? ` (${i.hint})` : ""}`).join("\n"),
          actions: acts(...r.items.slice(0, 3).map((i) => goTo(i.label.length > 26 ? i.label.slice(0, 24) + "…" : i.label, i.path))),
        };
      },
    },
    {
      id: "activos", mod: "socios", ok: () => !isInstr,
      keys: [`cuantos ${MS}`, "cuantos socios", "cuantos alumnos", "cuantos atletas", "cuantas personas", `${MS} activos`, "socios activos", "alumnos activos", "activos", "activas", "padron", "total de socios"],
      run: async () => {
        const d = await appApi<{ members_active?: number }>("/dashboard");
        const n = d.members_active ?? 0;
        return { from: "bot", text: `Hay ${plural(n, `${M} activo`, `${MS} activos`)} en este momento.`, actions: acts(goTo(`Ver ${MS}`, "/app/socios")) };
      },
    },
    {
      id: "cobrado", mod: "membresias", ok: () => !isInstr,
      keys: ["cuanto cobre", "cuanto cobramos", "cuanto se cobro", "cobrado", "cobros de hoy", "cobros del dia", "cobros del mes", "cobranzas de hoy", "recaudacion", "recaudamos", "recaude", "ingresos de plata", "plata de hoy", "facturacion", "cobros"],
      run: async (_r, t) => {
        const wantMonth = hit(t, "mes") || hit(t, "mensual");
        if (wantMonth) {
          const now = new Date();
          const from = dayKey(new Date(now.getFullYear(), now.getMonth(), 1));
          const r = await appApi<{ total: number; total_ok: number; totals_by_method: Record<string, number> }>(`/payments?date_from=${from}&date_to=${dayKey(now)}&limit=1`);
          const meth = Object.entries(r.totals_by_method || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
          return {
            from: "bot",
            text: `En lo que va del mes se cobraron ${money(r.total_ok)} (${plural(r.total, "movimiento", "movimientos")}).` +
              (meth.length ? "\nPor medio: " + meth.map(([k, v]) => `${k.charAt(0)}${k.slice(1).toLowerCase()} ${money(v)}`).join(" · ") : ""),
            actions: acts(goTo("Ver pagos", "/app/membresias")),
          };
        }
        const d = await appApi<{ collected_today?: number }>("/dashboard");
        return { from: "bot", text: `Hoy se cobraron ${money(d.collected_today ?? 0)}.`, actions: acts(goTo("Ver pagos", "/app/membresias")) };
      },
    },
    {
      id: "ingresos", mod: "acceso", ok: () => !isInstr,
      keys: ["quien entro", "entraron", "entro hoy", "ingresaron", "ingresos de hoy", "ingresos hoy", "vinieron", "asistieron", "visitas de hoy", "cuanta gente vino", "accesos de hoy"],
      run: async () => {
        const d = await appApi<{ access_today?: number }>("/dashboard");
        const n = d.access_today ?? 0;
        return { from: "bot", text: n ? `Hoy ingresaron ${plural(n, "persona", "personas")} por el control de acceso.` : "Todavía no ingresó nadie hoy.", actions: acts(goTo("Ver accesos", "/app/acceso")) };
      },
    },
    {
      id: "adentro", mod: "acceso",
      keys: ["quien esta adentro", "quienes estan adentro", "esta adentro", "adentro", "aforo", "cuanta gente hay", "hay gente", "ahora en el club", "ocupacion"],
      run: async () => {
        const r = await appApi<{ count: number; capacity?: number | null; items?: { name: string }[] }>("/access/inside");
        const cap = r.capacity ? ` de ${r.capacity} de aforo` : "";
        if (!r.count) return { from: "bot", text: "No hay nadie adentro en este momento." };
        const names = (r.items || []).slice(0, 8).map((i) => `• ${i.name}`).join("\n");
        return { from: "bot", text: `Ahora hay ${plural(r.count, "persona", "personas")}${cap}.` + (names ? `\n${names}${r.count > 8 ? `\n… y ${r.count - 8} más.` : ""}` : ""), actions: acts(goTo("Ver accesos", "/app/acceso")) };
      },
    },
    {
      id: "denegados", mod: "acceso", ok: () => !isInstr,
      keys: ["denegado", "denegados", "rechazado", "rechazados", "no pudieron entrar", "no pudo entrar", "luz roja", "semaforo rojo", "bloqueado", "accesos rojos"],
      run: async () => {
        const r = await appApi<{ items: { at: string; member_name: string | null; result: string; reason_label?: string | null }[]; summary: { denegados: number; aviso: number; ok: number } }>("/access/events");
        const bad = r.items.filter((i) => i.result !== "OK" && i.result !== "OK_AVISO");
        if (!bad.length) return { from: "bot", text: `Hoy no hubo ingresos denegados (${r.summary.ok} entradas en verde).` };
        return {
          from: "bot",
          text: `Hoy hubo ${plural(bad.length, "ingreso denegado", "ingresos denegados")}:\n` + bad.slice(0, 6).map((i) => `• ${hhmm(i.at)} · ${i.member_name || "Sin identificar"}${i.reason_label ? ` — ${i.reason_label}` : ""}`).join("\n"),
          actions: acts(goTo("Ver accesos", "/app/acceso")),
        };
      },
    },
    {
      id: "clases", mod: "clases",
      keys: ["clases de hoy", "clases hoy", "clases de manana", "clases manana", "proxima clase", "proximas clases", "siguiente clase", "que clases hay", "agenda", "clases", "horarios de hoy", "turnos de hoy"],
      run: async (_r, t) => {
        const tomorrow = hit(t, "manana");
        const day = dayKey(tomorrow ? addDays(new Date(), 1) : new Date());
        const r = await appApi<{ items: { activity_name: string | null; starts_at: string; ends_at: string; status: string; booked: number; capacity: number; waitlist: number; instructor_name?: string | null }[] }>(`/class-sessions?from=${day}&to=${day}`);
        const now = new Date();
        let list = r.items.filter((s) => s.status !== "CANCELADA");
        if (!tomorrow) list = list.filter((s) => new Date(s.ends_at) >= now);
        if (!list.length) return { from: "bot", text: tomorrow ? "Mañana no hay clases programadas." : "No quedan clases para hoy.", actions: acts(goTo("Ver agenda", "/app/clases")) };
        return {
          from: "bot",
          text: `${tomorrow ? "Mañana" : "Hoy"} ${list.length === 1 ? "queda 1 clase" : `quedan ${list.length} clases`}:\n` +
            list.slice(0, 8).map((s) => `• ${hhmm(s.starts_at)} ${s.activity_name || "Clase"}${s.instructor_name ? ` · ${s.instructor_name}` : ""} — ${s.booked}/${s.capacity}${s.waitlist ? ` (+${s.waitlist} en espera)` : ""}`).join("\n") +
            (list.length > 8 ? `\n… y ${list.length - 8} más.` : ""),
          actions: acts(goTo("Ver agenda", "/app/clases")),
        };
      },
    },
    {
      id: "deudores", mod: "cobranza",
      keys: ["deudor", "deudores", "deben", "deuda", "deudas", "moroso", "morosos", "mora", "morosidad", "atrasados", "atrasadas", "cuotas vencidas", "cuota vencida", "cuota atrasada", "impagas", "sin pagar", "no pagaron", "adeudan", "quien debe", "cuanto me deben"],
      run: async () => {
        const [s, d] = await Promise.all([
          appApi<{ count: number; amount: number }>("/debtors/summary"),
          appApi<{ items: { full_name: string; overdue: number; days: number }[] }>("/debtors?sort=amount"),
        ]);
        if (!s.count) return { from: "bot", text: "No hay nadie con cuotas vencidas. Todo al día." };
        return {
          from: "bot",
          text: `Hay ${plural(s.count, "persona", "personas")} con cuotas vencidas, por ${money(s.amount)} en total.\nLos que más deben:\n` +
            d.items.slice(0, 5).map((i) => `• ${i.full_name}: ${money(i.overdue)} (${i.days} días)`).join("\n"),
          actions: acts(goTo("Ver deudores", "/app/cobranza")),
        };
      },
    },
    {
      id: "porvencer", mod: "membresias", ok: () => !isInstr,
      keys: ["por vencer", "vencen", "vence", "vencimiento", "vencimientos", "proximos vencimientos", "renovar", "renovaciones", "quien vence"],
      run: async () => {
        const r = await appApi<{ total: number; items: { member_name: string; plan_name: string; expires_on: string | null; days: number | null }[] }>("/memberships?state=POR_VENCER&limit=6");
        if (!r.total) return { from: "bot", text: `No hay cuotas por vencer en los próximos días.`, actions: acts(goTo("Ver vencimientos", "/app/membresias")) };
        return {
          from: "bot",
          text: `Hay ${plural(r.total, "cuota por vencer", "cuotas por vencer")}:\n` +
            r.items.map((i) => `• ${i.member_name} · ${i.plan_name}${i.expires_on ? ` — vence ${shortDate(i.expires_on)}` : ""}`).join("\n") +
            (r.total > r.items.length ? `\n… y ${r.total - r.items.length} más.` : ""),
          actions: acts(goTo("Ver vencimientos", "/app/membresias")),
        };
      },
    },
    {
      id: "aptos", mod: "salud",
      keys: ["apto", "aptos", "apto medico", "aptos medicos", "certificado", "sin apto", "ficha medica", "apto vencido"],
      run: async () => {
        const r = await appApi<{ counts: Record<string, number>; items: { name: string; apto: { state: string; valid_until?: string | null } }[] }>("/health/members?limit=6");
        const c = r.counts;
        const bad = (c.VENCIDO || 0) + (c.SIN_APTO || 0);
        const head = `Aptos: ${c.VIGENTE || 0} vigentes, ${c.POR_VENCER || 0} por vencer, ${c.VENCIDO || 0} vencidos y ${c.SIN_APTO || 0} sin apto.`;
        const list = r.items.filter((i) => i.apto.state === "VENCIDO" || i.apto.state === "SIN_APTO");
        return {
          from: "bot",
          text: head + (bad && list.length ? "\nPara revisar:\n" + list.map((i) => `• ${i.name} — ${i.apto.state === "VENCIDO" ? "vencido" : "sin apto"}`).join("\n") : ""),
          actions: acts(goTo("Ver aptos", "/app/salud")),
        };
      },
    },
    {
      id: "caja", mod: "caja",
      keys: ["caja abierta", "estado de la caja", "como esta la caja", "caja del dia", "efectivo en caja", "arqueo", "cuanto hay en caja", "mi caja"],
      run: async () => {
        const r = await appApi<{ session: null | { opened_at: string; opening_amount: number; totals?: { total_collected: number; expected_cash: number } } }>("/cash/current");
        if (!r.session) return { from: "bot", text: "No tenés una caja abierta. Podés abrirla desde Caja del día.", actions: acts(goTo("Ir a Caja", "/app/caja")) };
        const tt = r.session.totals;
        return {
          from: "bot",
          text: `Tu caja está abierta desde las ${hhmm(r.session.opened_at)}, con ${money(r.session.opening_amount)} de apertura.` +
            (tt ? `\nCobrado en el turno: ${money(tt.total_collected)}. Efectivo esperado en caja: ${money(tt.expected_cash)}.` : ""),
          actions: acts(goTo("Ver la caja", "/app/caja")),
        };
      },
    },
    {
      id: "riesgo", mod: "reportes", ok: () => isBoss,
      keys: ["en riesgo", "riesgo", "se van a ir", "desercion", "dejaron de venir", "no vienen", "hace dias que no vienen", "ausentes", "abandono", "retencion"],
      run: async () => {
        const r = await appApi<{ available: boolean; total?: number; items?: { name: string; days_since: number | null; reasons: string[] }[]; definition?: string }>("/reports/at-risk");
        if (!r.available) return { from: "bot", text: "Ese reporte necesita el control de acceso o las clases para saber quién viene.", actions: acts(goTo("Ver reportes", "/app/reportes")) };
        if (!r.total) return { from: "bot", text: `No hay ${MS} en riesgo de irse. Buen momento para festejar.` };
        return {
          from: "bot",
          text: `Hay ${plural(r.total, `${M} en riesgo`, `${MS} en riesgo`)} de dejar:\n` +
            (r.items || []).slice(0, 5).map((i) => `• ${i.name}${i.days_since != null ? ` — ${i.days_since} días sin venir` : ""}`).join("\n"),
          actions: acts(goTo("Ver reportes", "/app/reportes")),
        };
      },
    },
    {
      id: "buscar", mod: "socios",
      keys: ["buscar", "busca", "buscame", "ficha", "dni", "encontra", "donde esta", "datos de", "telefono de"],
      run: async (raw) => {
        const term = norm(raw).replace(/\b(buscar|busca|buscame|ficha|de|del|la|el|dni|encontra|donde|esta|datos|telefono|socio|socia|alumno|alumna|atleta|persona|cliente|mostrame|ver)\b/g, " ").replace(/\s+/g, " ").trim();
        return searchMembers(term || norm(raw));
      },
    },
  ];

  async function searchMembers(term: string): Promise<Msg> {
    if (term.length < 2) return { from: "bot", text: `Decime el nombre o el DNI. Por ejemplo: «buscar Pérez» o «dni 30123456».` };
    const r = await appApi<{ total: number; items: { id: number; full_name: string; dni?: string | null; plan_name?: string | null; state_label?: string; state_name?: string }[] }>(`/members?limit=5&q=${encodeURIComponent(term)}`);
    if (!r.total) return { from: "bot", text: `No encontré a nadie con «${term}». Probá con el apellido o con el DNI.` };
    return {
      from: "bot",
      text: `${r.total === 1 ? "Encontré a 1 persona" : `Encontré ${r.total} personas`}:\n` +
        r.items.map((i) => `• ${i.full_name}${i.dni ? ` (DNI ${i.dni})` : ""}${i.plan_name ? ` · ${i.plan_name}` : ""}${i.state_name ? ` · ${i.state_name}` : ""}`).join("\n") +
        (r.total > r.items.length ? `\n… hay ${r.total - r.items.length} más; afiná la búsqueda.` : ""),
      actions: r.items.slice(0, 3).map((i) => goTo(i.full_name.split(",")[0], `/app/socios/${i.id}`)),
    };
  }

  // -------------------------------------------------------------------- cómo hago…
  const HELP: Help[] = [
    {
      id: "baja-servicio", ok: () => user?.role === "ADMINISTRADOR",
      keys: ["dar de baja el servicio", "dar de baja el sistema", "baja del servicio", "baja del sistema", "darme de baja", "cancelar el servicio", "cancelar mi cuenta", "dejar de usar el sistema", "retirar la baja", "constancia de baja"],
      text: () => "Para dar de baja el servicio entrá a Configuración y tocá «Dar de baja el servicio» (también está al pie de la pantalla de ingreso). Lo hace el administrador, sin motivo y en dos pasos, y te da una constancia BAJA-AAAA-NNNN con fecha y hora para copiar o imprimir. El sistema NO se corta ese día: sigue funcionando hasta el final del período que ya pagaste, y antes de esa fecha podés «Retirar la baja». Después se desactiva y tus datos se conservan.",
      to: "/app/configuracion", label: "Ir a Configuración",
    },
    {
      id: "alta", mod: "socios", ok: () => !isInstr,
      keys: [`cargar ${M}`, "cargar un socio", "nuevo socio", "alta de", "dar de alta", "agregar socio", "nueva persona", "registrar socio", "inscribir", "anotar", "nuevo alumno", "agregar persona"],
      text: () => `Para dar de alta a un ${M}: entrá a ${moduleLabel("socios")} y tocá «Nueva persona». Cargás nombre, DNI y contacto, y desde la ficha le asignás el plan. Si es menor de edad, pide los datos del tutor.`,
      to: "/app/socios", label: `Ir a ${moduleLabel("socios")}`,
    },
    {
      id: "importar", mod: "socios", ok: () => isBoss,
      keys: ["importar", "excel", "planilla", "migrar", "cargar muchos", "subir lista", "pasar mis socios", "csv"],
      text: () => `Si ya tenés una lista en Excel: en ${moduleLabel("socios")} tocá «Importar desde Excel», bajá la plantilla, completala y subila. Te muestra una vista previa antes de confirmar.`,
      to: "/app/socios/importar", label: "Importar desde Excel",
    },
    {
      id: "cobrar", mod: "membresias", ok: () => !isInstr,
      keys: ["cobrar", "cobro", "cobrarle", "cobrar cuota", "registrar pago", "pago de cuota", "pagar", "pago", "recibo", "abonar", "pagó", "me pago"],
      text: () => `Para cobrar una cuota: tocá «Cobrar» arriba a la derecha, buscá a la persona, elegí qué cargos salda y el medio de pago (efectivo, transferencia, débito, crédito o Mercado Pago). Se genera el recibo para imprimir. También podés cobrar desde Vencimientos o desde Cobranza.`,
      to: "/app/membresias", label: "Ir a Planes y cuotas",
    },
    {
      id: "anular", mod: "membresias", ok: () => !isInstr,
      keys: ["anular cobro", "anular pago", "me equivoque", "cobre mal", "devolver", "devolucion", "reintegro", "error en un cobro", "borrar pago"],
      text: () => `Si te equivocaste con un cobro: en Planes y cuotas, solapa «Pagos», buscá el cobro y tocá «Anular cobro». Queda registrado quién lo anuló y la deuda vuelve a aparecer.`,
      to: "/app/membresias", label: "Ir a Pagos",
    },
    {
      id: "plan", mod: "membresias", ok: () => !isInstr,
      keys: ["asignar plan", "darle un plan", "plan", "abono", "membresia", "cambiar de plan", "renovar plan", "inscribirlo a un plan"],
      text: () => `Para asignarle un plan a ${M === "socio" ? "un socio" : `un ${M}`}: abrí su ficha y tocá «Asignar plan». Elegís el plan y la fecha de inicio y se generan los cargos. Para renovar, usá el botón de renovar del mismo plan en la ficha.`,
      to: "/app/socios", label: `Ir a ${moduleLabel("socios")}`,
    },
    {
      id: "precios", mod: "membresias", ok: () => role === "ADMINISTRADOR",
      keys: ["crear plan", "nuevo plan", "cambiar precio", "aumento", "subir precios", "precio de la cuota", "precios", "tarifa", "actualizar precios"],
      text: () => `Los planes se crean en Planes y cuotas, solapa «${moduleLabel("membresias").split(" y ")[0]}», con «Nuevo plan» (precio, duración, clases incluidas). Para actualizar un precio usá «Cambiar precio» en el plan: te deja elegir desde cuándo rige.`,
      to: "/app/membresias", label: "Ir a Planes",
    },
    {
      id: "congelar", mod: "membresias", ok: () => !isInstr,
      keys: ["congelar", "congelamiento", "pausar", "freeze", "licencia", "viaje", "lesion", "descongelar", "suspender cuota"],
      text: () => `Para congelar un plan: abrí la ficha de la persona y, en su plan vigente, tocá «Congelar» (elegís desde y hasta cuándo). Para volver antes, «Descongelar». Todos los congelamientos se ven en Planes y cuotas → Congelamientos.`,
      to: "/app/membresias", label: "Ver congelamientos",
    },
    {
      id: "deudores", mod: "cobranza", ok: () => !isInstr,
      keys: ["recordatorio", "recordatorios", "reclamar", "avisar deuda", "mensaje de deuda", "whatsapp", "link de pago", "plan de pagos", "cobranza", "reclamo"],
      text: () => `En Cobranza ves a los deudores ordenados por antigüedad. Desde ahí armás el mensaje con el monto, lo abrís en WhatsApp y queda marcado como enviado. También podés generar un link de pago de Mercado Pago o un plan de pagos en cuotas.`,
      to: "/app/cobranza", label: "Ir a Cobranza",
    },
    {
      id: "kiosco", mod: "acceso", ok: () => !isInstr,
      keys: ["kiosco", "qr", "carnet", "carnets", "tablet", "control de acceso", "como entran", "torniquete", "entrada", "semaforo", "ingreso por dni"],
      text: () => `El control de acceso se hace con el kiosco: en Control de acceso tocá «Abrir kiosco» y dejalo en una tablet en la entrada. Cada ${M} pasa su QR o escribe su DNI y ve el semáforo (verde pasa, rojo avisa el motivo). Los carnets con QR se imprimen desde la ficha.`,
      to: "/app/acceso", label: "Ir a Control de acceso",
    },
    {
      id: "clases", mod: "clases",
      keys: ["agregar clase", "crear clase", "armar la grilla", "grilla", "horarios", "cupo", "lista de espera", "reservar", "reserva", "asistencia", "tomar lista", "reservar un lugar"],
      text: () => isBoss
        ? `Los horarios fijos se arman en Clases → «Grilla fija» con «Agregar a la grilla» (actividad, día, hora, ${vocab("instructor")} y cupo); las actividades y ${vocab("spaces")} se cargan en «Actividades y espacios». Para reservar un lugar abrí la clase en la agenda y tocá «Reservar un lugar». La asistencia se toma en la misma clase.`
        : `En la agenda semanal abrís cada clase: ahí ves quién reservó, la lista de espera y tomás asistencia. Para anotar a alguien tocá «Reservar un lugar».`,
      to: "/app/clases", label: "Ir a Clases",
    },
    {
      id: "caja", mod: "caja", ok: () => !isInstr,
      keys: ["vender", "venta", "ventas", "producto", "productos", "stock", "abrir la caja", "cerrar la caja", "cierre de caja", "gasto", "gastos", "retiro"],
      text: () => `En Caja y ventas: «Venta rápida» para vender productos o servicios, «Caja del día» para abrir y cerrar tu caja (contás el efectivo y te muestra la diferencia), «Productos y stock» para el inventario y «Gastos» para cargar egresos.`,
      to: "/app/caja", label: "Ir a Caja y ventas",
    },
    {
      id: "salud", mod: "salud",
      keys: ["apto medico", "cargar apto", "declaracion de salud", "salud", "legajo", "habilitacion", "inspeccion", "planilla de cumplimiento", "par-q", "parq"],
      text: () => `En ${moduleLabel("salud")} ves quién tiene el ${vocab("cert")} vigente, por vencer o vencido. Para cargar uno, abrí la persona y tocá «Cargar». En «Legajo» guardás los documentos del local (habilitación, seguros) y en «Planilla» imprimís lo que pide la inspección.`,
      to: "/app/salud", label: `Ir a ${moduleLabel("salud")}`,
    },
    {
      id: "baja", mod: "bajas", ok: () => !isInstr,
      keys: ["dar de baja", "baja", "bajas", "se quiere ir", "cancelar membresia", "arrepentimiento", "darse de baja", "anonimizar", "borrar socio"],
      text: () => `Para dar de baja: abrí la ficha y tocá «Dar de baja» (o «Dar de baja el plan» si solo termina un plan). Cuando la persona lo pide desde la web, la solicitud llega a «Bajas» y hay que procesarla dentro de 2 días hábiles.`,
      to: "/app/bajas", label: "Ir a Bajas",
    },
    {
      id: "avisos", mod: "avisos", ok: () => !isInstr,
      keys: ["avisos", "mensajes", "campana de mensajes", "campanas", "plantilla", "plantillas", "cartelera", "comunicado", "mandar mensaje", "enviar mensaje", "cumpleanos"],
      text: () => `En Avisos y campañas tenés plantillas de mensajes, la cola de envíos (se mandan por WhatsApp con un toque, sin automatismos) y la cartelera que ven las personas en su portal.`,
      to: "/app/avisos", label: "Ir a Avisos",
    },
    {
      id: "reportes", mod: "reportes",
      keys: ["reporte", "reportes", "estadisticas", "informe", "ingresos del mes", "retencion", "balance", "numeros del club", "exportar"],
      text: () => `En Reportes ves deserción, retención, ingresos, asistencia y morosidad, con definición de cada número. La mayoría se puede exportar a Excel.`,
      to: "/app/reportes", label: "Ir a Reportes",
    },
    {
      id: "usuarios", mod: "usuarios",
      keys: ["usuario", "usuarios", "empleado", "empleados", "equipo", "rol", "roles", "permisos", "contrasena", "clave", "password", "recepcionista"],
      text: () => `En Usuarios creás a tu equipo y elegís el rol: Administrador (todo), Encargado (día a día y configuración operativa), Recepción (cobra, da de alta y controla ingresos) e Instructor (sus clases y asistencia). También ahí se restablece una contraseña.`,
      to: "/app/usuarios", label: "Ir a Usuarios",
    },
    {
      id: "config", mod: "configuracion",
      keys: ["configuracion", "configurar", "mercado pago", "mercadopago", "datos del club", "logo", "politicas", "gracia", "dias de gracia", "terminos", "condiciones", "rubro", "palabras"],
      text: () => `En Configuración cargás los datos del club, el rubro y las palabras del sistema, las reglas de cuotas y cobro (días de gracia, recargos), las reservas, el apto médico, Mercado Pago para links de pago y los textos legales.`,
      to: "/app/configuracion", label: "Ir a Configuración",
    },
    {
      id: "web", mod: "web_publica",
      keys: ["web", "pagina", "pagina del club", "clase de prueba", "alta online", "portal", "portal del socio", "link para compartir"],
      text: () => `La web del club muestra horarios, planes y permite pedir una clase de prueba o darse de alta online. El portal del ${M} le deja ver su QR, reservar y pagar. Los links están en Configuración.`,
      to: "/app/configuracion", label: "Ir a Configuración",
    },
    {
      id: "tema", keys: ["modo oscuro", "oscuro", "tema", "modo claro", "recorrido", "tutorial", "tour", "como funcionamos", "guia"],
      text: () => `El modo claro/oscuro se cambia abajo del menú de la izquierda. Ahí mismo está «¿Cómo funcionamos?», que vuelve a mostrar el recorrido guiado por el sistema.`,
    },
  ];

  const GREET = /^(hola|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal|ola)\b/;

  async function answer(raw: string): Promise<Msg> {
    const t = norm(raw);
    if (!t) return { from: "bot", text: "Escribime tu pregunta o tocá una de las sugerencias." };

    if (GREET.test(t) && t.split(" ").length <= 4) {
      return { from: "bot", text: "Hola. ¿En qué te ayudo? Tocá una sugerencia o escribime lo que necesites." };
    }
    if (hit(t, "gracias") || hit(t, "genial") || hit(t, "perfecto") || hit(t, "joya") || hit(t, "excelente")) {
      return { from: "bot", text: "De nada. Cualquier cosa, acá estoy." };
    }
    if (/^(chau|adios|hasta luego|nos vemos)\b/.test(t)) return { from: "bot", text: "Chau. Que tengas un buen día." };

    const howto = HOWTO.some((k) => hit(t, k));

    // DNI o número suelto: busca a la persona
    if (can("socios") && /^\d{6,9}$/.test(t.replace(/[.\s]/g, ""))) return searchMembers(t.replace(/[.\s]/g, ""));

    // puntaje de cada candidato; en empate gana la consulta de datos, salvo que la frase sea un «cómo hago…»
    let bestI: { it: Intent; s: number } | null = null;
    for (const it of INTENTS) {
      const s = score(t, it.keys);
      if (s > (bestI?.s ?? 0)) bestI = { it, s };
    }
    let bestH: { h: Help; s: number } | null = null;
    for (const h of HELP) {
      const s = score(t, h.keys);
      if (s > (bestH?.s ?? 0)) bestH = { h, s };
    }
    const useHelp = bestH && (!bestI || bestH.s > bestI.s || (howto && bestH.s >= bestI.s));

    if (useHelp && bestH) {
      const h = bestH.h;
      if (h.mod && !can(h.mod)) return denied(h.mod);
      if (h.ok && !h.ok()) return { from: "bot", text: "Esa tarea la hace otro rol del equipo. Pedísela a quien administra el club." };
      return { from: "bot", text: h.text(), actions: h.to && canGo(h.to) ? [goTo(h.label || "Ir", h.to)] : undefined };
    }
    if (bestI) {
      const it = bestI.it;
      if (!can(it.mod) || (it.ok && !it.ok())) return denied(it.mod);
      return it.run(raw, t);
    }

    // último recurso: si parece un nombre, lo busca entre las personas
    if (can("socios") && /^[a-z ]{3,40}$/.test(t) && t.split(" ").length <= 3) {
      const r = await searchMembers(t);
      if (r.actions && r.actions.length) return r;
    }
    return {
      from: "bot",
      text: "No te entendí del todo. Probá con algo como:\n" + examples().map((e) => `• ${e}`).join("\n"),
    };
  }

  function denied(mod: string): Msg {
    const name = mod === "bajas" ? "Bajas" : moduleLabel(mod);
    return { from: "bot", text: `Tu usuario no tiene acceso a «${name}», así que no puedo mostrarte eso. Si lo necesitás, pedíselo a quien administra el club.` };
  }

  // sugerencias: solo lo que el usuario puede ver
  const allSuggest: { q: string; ok: boolean }[] = [
    { q: "¿Qué tengo pendiente?", ok: true },
    { q: "Cuotas por vencer", ok: can("membresias") && !isInstr },
    { q: "¿Quiénes deben?", ok: can("cobranza") },
    { q: "¿Cuánto se cobró hoy?", ok: can("membresias") && !isInstr },
    { q: "¿Quién está adentro?", ok: can("acceso") },
    { q: "Clases de hoy", ok: can("clases") },
    { q: "Aptos vencidos", ok: can("salud") },
    { q: "Estado de mi caja", ok: can("caja") && !isInstr },
    { q: `¿Cómo cargo un ${M}?`, ok: can("socios") && !isInstr },
    { q: "¿Cómo cobro una cuota?", ok: can("membresias") && !isInstr },
  ];
  const suggestions = allSuggest.filter((s) => s.ok).map((s) => s.q);

  function examples(): string[] {
    const out: string[] = [];
    if (can("cobranza")) out.push("«¿quiénes deben?»");
    if (can("membresias") && !isInstr) out.push("«¿cuánto se cobró hoy?»");
    if (can("acceso")) out.push("«¿quién está adentro?»");
    if (can("clases")) out.push("«clases de mañana»");
    if (can("socios")) out.push("«buscar Pérez» o un DNI");
    out.push("«¿qué tengo pendiente?»", "«¿cómo congelo un plan?»");
    return out.slice(0, 5);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || typing) return;
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    try {
      const [reply] = await Promise.all([answer(q), new Promise((r) => setTimeout(r, 350))]);
      setMsgs((m) => [...m, reply]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "bot", text: e instanceof Error && e.message ? `No pude consultar eso: ${e.message}` : "No pude consultar eso ahora. Probá de nuevo en un momento." }]);
    } finally {
      setTyping(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  function go(to: string) {
    navigate(to);
    if (window.matchMedia("(max-width: 860px)").matches) setOpen(false);   // en el celular el panel tapa la pantalla
  }

  return (
    <>
      {!open && (
        <button type="button" className={`cl-assist-fab ${tuck ? "is-tucked" : ""}`} onClick={() => setOpen(true)} aria-label="Abrir el asistente" data-assistant="fab">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
          </svg>
          <span className="cl-assist-fab-text">Asistente</span>
        </button>
      )}
      {open && (
        <div className="cl-assist" role="dialog" aria-label="Asistente de Clubedo" data-assistant="panel">
          <div className="cl-assist-head">
            <ClubedoLogo size={32} />
            <div>
              <strong>Asistente</strong>
              <small>Cobros, ingresos, clases y ayuda</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar el asistente">×</button>
          </div>
          <div className="cl-assist-body" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`cl-assist-msg ${m.from}`}>
                <p>{m.text}</p>
                {m.actions && (
                  <div className="cl-assist-actions">
                    {m.actions.map((a) => (
                      <button type="button" key={a.to + a.label} onClick={() => go(a.to)}>{a.label} ›</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="cl-assist-msg bot"><p className="cl-assist-typing" aria-label="Escribiendo"><span /><span /><span /></p></div>}
            <div ref={endRef} />
          </div>
          <div className="cl-assist-suggest">
            {suggestions.map((s) => (
              <button type="button" key={s} onClick={() => send(s)} disabled={typing}>{s}</button>
            ))}
          </div>
          <form className="cl-assist-input" onSubmit={submit}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí tu pregunta…" aria-label="Tu pregunta" autoComplete="off" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default Assistant;
