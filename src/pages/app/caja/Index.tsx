import { PageHeader } from "../../../components/ui";
import { SubTabs, useSub, isManager } from "../../../components/c3/common";
import { moduleHint, moduleLabel } from "../../../config";
import Venta from "./Venta";
import CajaDia from "./CajaDia";
import Productos from "./Productos";
import Gastos from "./Gastos";
import Ventas from "./Ventas";

const BASE = "/app/caja";

/** Módulo «caja»: venta rápida, caja del día con arqueo, productos y stock, gastos e historial de ventas. */
function Index() {
  const [sub] = useSub(BASE, "venta");
  return (
    <section className="products-page">
      <PageHeader eyebrow="MÓDULO" title={moduleLabel("caja")} subtitle={moduleHint("caja")} />
      <SubTabs base={BASE} fallback="venta" options={[["venta", "Venta rápida"], ["caja", "Caja del día"], ["productos", isManager() ? "Productos y stock" : "Productos"], ["gastos", "Gastos"], ["ventas", "Ventas"]]} />
      {sub === "caja" ? <CajaDia /> : sub === "productos" ? <Productos /> : sub === "gastos" ? <Gastos /> : sub === "ventas" ? <Ventas /> : <Venta />}
    </section>
  );
}

export default Index;
