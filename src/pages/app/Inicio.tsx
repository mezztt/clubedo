import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, getSessionUser, money, pathFor, useVocab } from "../../config";
import { Loading, PageHeader, useFlash, useRefreshKey } from "../../components/ui";
import Pendientes from "../../components/Pendientes";

interface Summary {
  date: string;
  members_active?: number;
  collected_today?: number;
  access_today?: number;
  classes_today?: number;
}

/** Inicio: saludo, resumen del día y el panel «Pendientes». Los números salen de los módulos que tiene el club. */
function Inicio() {
  const user = getSessionUser();
  const navigate = useNavigate();
  const { t } = useVocab();
  const refreshKey = useRefreshKey();
  const { show, fail, node: flash } = useFlash();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const load = () => appApi<Summary>("/dashboard/summary").then(setData).catch((e) => setError(e.message));
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [refreshKey, version]);

  async function updateNow() {
    setUpdating(true);
    try {
      await appApi("/dashboard/pending/run-daily");
      setVersion((v) => v + 1);
      show("Listo, se actualizó todo.");
    } catch (e) {
      fail(e);
    } finally {
      setUpdating(false);
    }
  }

  if (error) return <div className="cb-note cb-note-error">{error}</div>;
  if (!data) return <Loading />;

  const hour = new Date().getHours();
  const hello = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const canUpdate = ["ADMINISTRADOR", "ENCARGADO", "RECEPCION"].includes(user?.role || "");

  const kpis: { label: string; value: string; hint: string; module: string }[] = [];
  if (data.members_active !== undefined) kpis.push({ label: `${t("members", true)} activos`, value: String(data.members_active), hint: "Con su plan al día o por vencer", module: "socios" });
  if (data.collected_today !== undefined) kpis.push({ label: "Cobrado hoy", value: money(data.collected_today), hint: "Todos los medios de pago", module: "membresias" });
  if (data.access_today !== undefined) kpis.push({ label: "Ingresos de hoy", value: String(data.access_today), hint: "Personas que pasaron por el kiosco", module: "acceso" });
  if (data.classes_today !== undefined) kpis.push({ label: `${t("sessions", true)} de hoy`, value: String(data.classes_today), hint: user?.role === "INSTRUCTOR" ? "Las tuyas" : "Sin contar las canceladas", module: "clases" });

  return (
    <section className="products-page">
      <PageHeader eyebrow="INICIO" title={`${hello}, ${(user?.name || "").split(" ")[0]}`} subtitle="Así viene el día en el club.">
        {canUpdate && <button className="secondary-button" onClick={updateNow} disabled={updating}>{updating ? "Actualizando…" : "Actualizar ahora"}</button>}
      </PageHeader>
      {flash}

      <Pendientes />

      {kpis.length > 0 && (
        <div className="cb-kpis">
          {kpis.map((k) => (
            <button key={k.module} className="cb-kpi" onClick={() => canAccess(user, k.module) && navigate(pathFor(k.module))}>
              <span>{k.label}</span><strong>{k.value}</strong><small>{k.hint}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default Inicio;
