import { Route, Routes } from "react-router-dom";
import Lista from "./Lista";
import Ficha from "./Ficha";
import Importar from "./Importar";
import "../../../c1.css";

/** Módulo «socios»: lista, ficha, importación. */
function Index() {
  return (
    <Routes>
      <Route index element={<Lista />} />
      <Route path="importar" element={<Importar />} />
      <Route path=":id" element={<Ficha />} />
    </Routes>
  );
}

export default Index;
