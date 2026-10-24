// Pasos del tutorial «¿Cómo funcionamos?» de Clubedo. Se filtran por los módulos que tiene el club y por el rol:
// solo se incluyen pantallas que esa persona realmente ve en su menú. Los textos usan el vocabulario del rubro.
import { canAccess, t } from "../../config";
import type { SessionUser } from "../../config";
import type { TourStep } from "./Tour";

const nav = (m: string) => `[data-tour="nav-${m}"]`;

export function tourSteps(user: SessionUser | null): TourStep[] {
  if (!user) return [];
  const can = (m: string) => canAccess(user, m);
  const steps: TourStep[] = [];
  const add = (cond: boolean, s: TourStep) => { if (cond) steps.push(s); };
  const role = user.role;
  const instructor = role === "INSTRUCTOR";

  add(true, {
    title: "Bienvenido a Clubedo",
    text: instructor
      ? `Acá ves tus ${t("sessions")}, tomás asistencia y cargás ${t("trainings")}. Te mostramos lo básico en un minuto.`
      : `Clubedo ordena ${t("members")}, cuotas y accesos. Te mostramos lo básico en un minuto.`,
  });
  add(true, { selector: '[data-tour="menu"]', title: "Menú lateral", text: "Acá están tus módulos, según tu plan y tu rol." });
  add(true, { selector: '[data-tour="pending"]', title: "Pendientes", text: "Lo que tenés que resolver hoy, con un clic. Si no hay nada, ves «Todo al día»." });
  add(can("socios") && !instructor, { selector: nav("socios"), title: `${t("members", true)}`, text: `Alta en 30 segundos: nombre, DNI, ${t("plan")} y cobro. También podés importarlos desde Excel.` });
  add(can("membresias"), { selector: nav("membresias"), title: "Cobrar", text: "Cobrá la cuota, imprimí el recibo interno y listo. El sistema te avisa qué vence y qué está atrasado." });
  add(can("acceso"), { selector: nav("acceso"), title: "Kiosco", text: `Abrí el kiosco en una tablet: la persona muestra su QR o dice su DNI y ves en verde, amarillo o rojo si puede entrar.` });
  add(can("clases"), { selector: nav("clases"), title: t("sessions", true), text: instructor
    ? `Tus ${t("sessions")} de hoy, con la lista de quién reservó. Tomá asistencia desde acá.`
    : `Armá la grilla semanal con cupos; ${t("members")} reservan y se anotan en lista de espera.` });
  add(can("reportes"), { selector: nav("reportes"), title: "Reportes", text: "Mirá quién se está yendo antes de que se vaya." });
  add(can("caja") && !can("reportes"), { selector: nav("caja"), title: "Caja", text: "Vendé productos, abrí y cerrá tu caja con el arqueo y anotá los gastos del día." });
  if (can("configuracion")) {
    add(true, { selector: nav("configuracion"), title: "Configuración", text: "Cambiá tu rubro, tus políticas y volvé a ver este recorrido cuando quieras desde el botón «¿Cómo funcionamos?»." });
  } else {
    add(true, { selector: '[data-tour="tour-help"]', title: "¿Cómo funcionamos?", text: "Si querés volver a ver este recorrido, tocá este botón cuando quieras." });
  }
  return steps;
}

/** Recorrido corto del portal del socio (se muestra la primera vez que entra) */
export function portalTourSteps(): TourStep[] {
  return [
    { selector: '[data-tour="portal-qr"]', title: "Tu QR", text: "Mostralo en la entrada del club para ingresar. Tocalo para verlo más grande." },
    { selector: '[data-tour="portal-reservas"]', title: "Reservá tus clases", text: "Elegí el día y el horario y reservá tu lugar. Si no podés ir, cancelá a tiempo." },
    { selector: '[data-tour="portal-pagos"]', title: "Pagá tu cuota", text: "Mirá lo que debés y pagalo con Mercado Pago, sin pasar por el mostrador." },
  ];
}

/** Recorrido del panel general de Mezztt (superadmin) */
export function adminTourSteps(): TourStep[] {
  const a = (p: string) => `[data-tour="admin-${p}"]`;
  return [
    { title: "Bienvenido al panel de Clubedo", text: "Desde acá administrás los gimnasios y clubes que usan Clubedo: qué tienen habilitado, cuánto pagan y cómo se factura. Te mostramos lo principal." },
    { selector: a("inicio"), title: "Inicio", text: "El resumen: cuántos sistemas hay, qué se espera cobrar este mes y cuánto ya entró." },
    { selector: a("sistemas"), title: "Sistemas", text: "Cada cliente es un sistema. Acá lo das de alta, elegís su rubro y sus módulos, el abono y podés resetear contraseñas." },
    { selector: a("pagos"), title: "Pagos", text: "Registrá lo que te paga cada cliente y mirá quién está al día y quién debe." },
    { selector: a("facturacion"), title: "Facturación", text: "Cotizaciones con pago inicial y abono mensual (más los planes trimestral y anual) y las facturas mensuales de cada sistema." },
    { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." },
    { selector: a("configuracion"), title: "Configuración", text: "Precios, enlaces de marca y copia de seguridad. Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido." },
  ];
}
