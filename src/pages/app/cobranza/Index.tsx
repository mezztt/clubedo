import { useState } from "react";
import { PageHeader, Tabs } from "../../../components/ui";
import { moduleLabel } from "../../../config";
import Deudores from "./Deudores";
import Recordatorios from "./Recordatorios";
import PlanesPago from "./PlanesPago";
import "../../../c1.css";

type Tab = "deudores" | "recordatorios" | "planes";

/** Módulo «cobranza»: deudores con antigüedad, recordatorios con mensaje listo y planes de pago. */
function Index() {
  const [tab, setTab] = useState<Tab>("deudores");
  return (
    <section className="products-page">
      <PageHeader eyebrow="CUOTAS" title={moduleLabel("cobranza")} subtitle="Quién debe y hace cuánto, con el mensaje de WhatsApp listo para enviar. El sistema no envía nada solo." />
      <Tabs<Tab> value={tab} onChange={setTab} options={[["deudores", "Deudores"], ["recordatorios", "Recordatorios del día"], ["planes", "Planes de pago"]]} />
      <div style={{ marginTop: 14 }}>
        {tab === "deudores" && <Deudores />}
        {tab === "recordatorios" && <Recordatorios />}
        {tab === "planes" && <PlanesPago />}
      </div>
    </section>
  );
}

export default Index;
