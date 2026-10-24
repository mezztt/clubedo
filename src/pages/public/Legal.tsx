import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_BRAND, APP_NAME } from "../../config";
import { InstagramLink, MezzttLink, ClubedoLogo, PoweredBy, useBrandLinks, useLightPage } from "../../components/Brand";

/**
 * Textos legales públicos (sin login): /legal/terminos y /legal/privacidad.
 * Son textos generales del servicio; no reemplazan el asesoramiento de un profesional (ver LEGAL.md).
 */
const UPDATED = "octubre de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="lg-section"><h2>{title}</h2>{children}</section>;
}

function Contact() {
  const links = useBrandLinks();
  return (
    <p className="lg-contact">
      Escribinos por el Instagram de <MezzttLink />
      <InstagramLink href={links.mezztt_instagram_url} label={`Instagram de ${APP_BRAND}`} />
    </p>
  );
}

function Terminos() {
  return (
    <>
      <p className="lg-lead">
        Estas son las condiciones para usar {APP_NAME}. Están escritas en lenguaje simple. Si usás el sistema, entendemos que las aceptás.
      </p>
      <Section title="1. Qué es Clubedo">
        <p>{APP_NAME} es un sistema de gestión para gimnasios, boxes, estudios de pilates y yoga, natación, artes marciales y clubes: socios, planes y cuotas, cobranza, control de acceso, clases y reservas, rutinas, aptos médicos, comisiones, caja y reportes, según los módulos que cada club contrate.</p>
      </Section>
      <Section title="2. Quién presta el servicio">
        <p>El servicio lo presta {APP_BRAND}, que desarrolla y mantiene el sistema. El cliente es el gimnasio, estudio o club que lo contrata, y es quien decide qué personas de su equipo tienen usuario y qué datos de sus socios carga.</p>
      </Section>
      <Section title="3. Cuenta y contraseñas">
        <ul>
          <li>Cada usuario es personal. No compartas tu contraseña.</li>
          <li>El club es responsable de lo que se hace con los usuarios que crea y de darlos de baja cuando alguien deja de trabajar con él.</li>
          <li>Si creés que alguien entró con tu usuario, cambiá la contraseña y avisanos.</li>
        </ul>
      </Section>
      <Section title="4. Uso permitido">
        <ul>
          <li>El sistema es para la actividad del club. No se puede usar para fines ilegales ni para cargar datos de personas sin tener derecho a hacerlo.</li>
          <li>No está permitido intentar entrar a datos de otros clientes, copiar el sistema ni afectar su funcionamiento.</li>
          <li>{APP_NAME} es una herramienta de registro y organización: no reemplaza a un profesional de la salud ni da indicaciones. El apto médico es un dato que carga el club.</li>
        </ul>
      </Section>
      <Section title="5. Lo que Clubedo no hace">
        <ul>
          <li><b>No emite facturas</b> ni comprobantes fiscales de ARCA. Los recibos y tickets que imprime son documentos internos y dicen «Documento no válido como factura».</li>
          <li><b>No certifica</b> que el club cumpla las leyes. Avisa los vencimientos (póliza, habilitación, DEA, aptos) que el club carga, nada más.</li>
          <li><b>No cobra por su cuenta.</b> Si el club quiere cobrar online, conecta su propia cuenta de Mercado Pago y el dinero va directo a esa cuenta.</li>
          <li><b>No envía WhatsApp ni mails.</b> Arma el texto y abre el enlace en el dispositivo de la persona del club, que lo envía a mano.</li>
          <li><b>No reconoce personas por huella ni por rostro.</b> El ingreso es con código QR o DNI.</li>
        </ul>
      </Section>
      <Section title="6. Botón de baja y de arrepentimiento">
        <p>Las páginas públicas del club tienen un botón de baja y, cuando el club vende online, un botón de arrepentimiento, conforme a la Disposición 954/2025 (que reemplazó a las Res. 424/2020 y 316/2018). {APP_NAME} registra el pedido y entrega un código de constancia; qué se hace con el período ya pagado y las devoluciones lo decide el club, con asesoramiento profesional.</p>
      </Section>
      <Section title="7. Abono y baja del servicio">
        <ul>
          <li>El servicio tiene un pago inicial y un abono mensual según los módulos contratados, acordados con {APP_BRAND} antes de empezar.</li>
          <li>Podés pedir la baja cuando quieras, por los mismos medios por los que te contactás con nosotros, sin trámites adicionales.</li>
          <li>Si el abono queda impago, el acceso puede suspenderse después de avisarte. Los datos no se borran por eso.</li>
        </ul>
      </Section>
      <Section title="8. Tus datos son tuyos">
        <p>Los datos que el club carga en el sistema son del club (y de las personas a las que se refieren, según la ley). Podés pedirnos una copia en cualquier momento, también al darte de baja. Cómo los cuidamos está explicado en la <Link to="/legal/privacidad">Política de privacidad</Link>.</p>
      </Section>
      <Section title="9. Disponibilidad">
        <p>Trabajamos para que el sistema esté disponible todo el tiempo y hacemos copias de seguridad, pero no podemos garantizar que nunca haya cortes: pueden existir interrupciones por mantenimiento, por fallas de internet o de los proveedores de alojamiento.</p>
      </Section>
      <Section title="10. Responsabilidad">
        <p>{APP_BRAND} responde por el funcionamiento del sistema dentro de lo razonable. No responde por los datos mal cargados, por las decisiones tomadas con esos datos, ni por el uso del sistema fuera de estas condiciones. Los textos legales que acompañan al sistema son de ayuda general: el contrato con los socios, las cláusulas de mora y permanencia, y las obligaciones del club las define el club con su abogado o abogada. La relación con sus socios es del club.</p>
      </Section>
      <Section title="11. Cambios">
        <p>Podemos mejorar el sistema y actualizar estas condiciones. Si el cambio es importante, te avisamos antes.</p>
      </Section>
      <Section title="12. Ley aplicable">
        <p>Estas condiciones se rigen por las leyes de la República Argentina.</p>
      </Section>
      <Section title="13. Contacto"><Contact /></Section>
    </>
  );
}

function Privacidad() {
  return (
    <>
      <p className="lg-lead">
        Acá te contamos qué datos personales se guardan en {APP_NAME}, para qué se usan y qué derechos tenés, según la Ley 25.326 de Protección de Datos Personales.
      </p>
      <Section title="1. Quién es responsable de los datos">
        <ul>
          <li>El <b>gimnasio, estudio o club</b> que usa {APP_NAME} es el responsable de su base de datos: decide qué datos carga y para qué.</li>
          <li><b>{APP_BRAND}</b> presta el software y guarda esos datos por cuenta del club. No los usa para otra cosa.</li>
        </ul>
      </Section>
      <Section title="2. Qué datos se guardan y para qué">
        <ul>
          <li><b>Socios y alumnos:</b> nombre, DNI, teléfono, email, fecha de nacimiento, plan, pagos, asistencia e ingresos. Sirven para cobrar, controlar el acceso y organizar las clases.</li>
          <li><b>Menores de edad:</b> además se guarda el nombre, DNI y teléfono de la persona responsable, que acepta las condiciones en su nombre.</li>
          <li><b>Equipo y usuarios:</b> nombre, email, rol y, si dan clases, matrícula y comisiones.</li>
          <li><b>Uso del sistema:</b> se registra quién hace las acciones sensibles (anular un pago, permitir un ingreso excepcional, ver una ficha de salud), para cuidar la confidencialidad.</li>
        </ul>
      </Section>
      <Section title="3. Datos de salud">
        <ul>
          <li>El apto médico, las lesiones y las medidas corporales son <b>datos sensibles</b> (Ley 25.326). Se guardan lo mínimo necesario: fecha, vigencia y una observación corta. No se guarda la imagen del certificado ni diagnósticos.</li>
          <li>Recepción solo ve si el apto está vigente o vencido. Las observaciones las ven el encargado, el administrador y el instructor de ese alumno, y cada lectura queda registrada.</li>
        </ul>
      </Section>
      <Section title="4. Ingreso al club">
        <p>El ingreso se hace con código QR o DNI. {APP_NAME} <b>no usa huella ni reconocimiento facial</b>. El kiosco no muestra montos ni deudas: si hay algo para resolver, indica que pases por recepción.</p>
      </Section>
      <Section title="5. Si te asociás o pagás por la web">
        <p>Te pedimos nombre, DNI, teléfono y, si querés, email. Esos datos los recibe el club, solo para gestionar tu alta y avisarte. Si pagás online, el pago se hace en Mercado Pago: {APP_NAME} no ve ni guarda los datos de tu tarjeta.</p>
      </Section>
      <Section title="6. Mensajes">
        <p>{APP_NAME} no envía mensajes por su cuenta. Arma el texto y el personal del club lo envía a mano desde su propio WhatsApp o correo.</p>
      </Section>
      <Section title="7. No se venden ni se ceden">
        <p>Los datos no se venden, no se alquilan y no se entregan a terceros para publicidad. Solo se comparten cuando lo exige la ley o una orden judicial, o con los proveedores técnicos necesarios para que el sistema funcione (alojamiento), que están obligados a mantener la confidencialidad.</p>
      </Section>
      <Section title="8. Tus derechos">
        <p>Podés pedir <b>acceso</b> a tus datos, que se <b>rectifiquen</b> o <b>actualicen</b> si están mal, y que se <b>supriman</b> cuando corresponda. Al suprimir, se borran los datos personales y se conservan los importes sin identificarte.</p>
        <p>El pedido se hace ante el club donde entrenás, que es el responsable de la base. Si no sabés a quién dirigirte, escribinos y te orientamos.</p>
      </Section>
      <Section title="9. Seguridad">
        <p>Las contraseñas se guardan cifradas, la conexión es segura (https), cada club ve solo sus propios datos y se hacen copias de seguridad. Ningún sistema es infalible: si detectamos un problema que afecte tus datos, se lo avisamos al responsable.</p>
      </Section>
      <Section title="10. Cookies y seguimiento">
        <p>{APP_NAME} no usa cookies de publicidad ni rastreadores de terceros. Solo guarda en tu navegador lo necesario para mantener tu sesión y tu preferencia de modo claro u oscuro.</p>
      </Section>
      <Section title="11. Órgano de control">
        <p className="lg-quote">La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>
      </Section>
      <Section title="12. Contacto"><Contact /></Section>
    </>
  );
}

const DOCS = {
  terminos: { title: "Términos y condiciones", other: "privacidad", otherLabel: "Política de privacidad", Body: Terminos },
  privacidad: { title: "Política de privacidad", other: "terminos", otherLabel: "Términos y condiciones", Body: Privacidad },
} as const;

function Legal({ doc }: { doc: keyof typeof DOCS }) {
  useLightPage();
  const d = DOCS[doc];
  useEffect(() => { document.title = `${d.title} · ${APP_NAME}`; window.scrollTo(0, 0); }, [d.title]);
  return (
    <div className="cw-page lg-page">
      <header className="lg-top">
        <div className="lg-wrap lg-top-row">
          <span className="lg-brand"><ClubedoLogo size={34} /><strong>{APP_NAME}</strong></span>
          <button type="button" className="lg-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>‹ Volver</button>
        </div>
      </header>
      <main className="lg-wrap">
        <article className="cw-card lg-card">
          <span className="cw-step-label">Legales</span>
          <h1>{d.title}</h1>
          <p className="lg-updated">Última actualización: {UPDATED}</p>
          <d.Body />
          <p className="lg-also">Leé también: <Link to={`/legal/${d.other}`}>{d.otherLabel}</Link></p>
        </article>
      </main>
      <footer className="cw-foot"><PoweredBy /></footer>
    </div>
  );
}

export default Legal;
