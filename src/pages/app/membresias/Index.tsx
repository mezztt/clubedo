import { useState } from "react";
import { PageHeader, Tabs } from "../../../components/ui";
import { canAccess, getSessionUser, moduleLabel, useVocab } from "../../../config";
import Vencimientos from "./Vencimientos";
import Planes from "./Planes";
import Pagos from "./Pagos";
import Congelamientos from "./Congelamientos";
import "../../../c1.css";

type Tab = "vencimientos" | "planes" | "pagos" | "congelamientos";

/** Módulo «membresías»: vencimientos, planes, pagos y congelamientos. */
function Index() {
  const { t } = useVocab();
  const user = getSessionUser();
  const [tab, setTab] = useState<Tab>(() => {
    try { return (sessionStorage.getItem("c1_mem_tab") as Tab) || "vencimientos"; } catch { return "vencimientos"; }
  });
  const change = (v: Tab) => { setTab(v); try { sessionStorage.setItem("c1_mem_tab", v); } catch { /* sin storage */ } };
  const tabs: [Tab, string][] = [["vencimientos", "Vencimientos"], ["planes", t("plans", true)], ["pagos", "Pagos"], ["congelamientos", "Congelamientos"]];
  return (
    <section className="products-page">
      <PageHeader eyebrow="CUOTAS" title={moduleLabel("membresias")} subtitle={`Qué vence, cuánto cuesta cada ${t("plan")} y todo lo que se cobró.`} />
      <Tabs<Tab> value={tab} onChange={change} options={tabs} />
      <div style={{ marginTop: 14 }}>
        {tab === "vencimientos" && <Vencimientos canCobranza={canAccess(user, "cobranza")} />}
        {tab === "planes" && <Planes admin={user?.role === "ADMINISTRADOR"} />}
        {tab === "pagos" && <Pagos />}
        {tab === "congelamientos" && <Congelamientos />}
      </div>
    </section>
  );
}

export default Index;
