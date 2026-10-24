import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { THEME_KEY, initVocab, getSessionUser } from "./config";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Panel general (Mezztt)
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import Sistemas from "./pages/admin/Sistemas";
import Pagos from "./pages/admin/Pagos";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminSettings from "./pages/admin/AdminSettings";
import MailCenter from "./pages/admin/MailCenter";

// Sistema del club: núcleo
import ClientLayout from "./pages/app/ClientLayout";
import Inicio from "./pages/app/Inicio";
import Usuarios from "./pages/app/Usuarios";
import Configuracion from "./pages/app/Configuracion";
import Bajas from "./pages/app/Bajas";

// Módulos cobrables: cada uno tiene su carpeta (pages/app/<modulo>/Index.tsx) y una ruta comodín /app/<modulo>/*,
// así quien completa un módulo agrega sus subpantallas dentro de su Index sin tocar este archivo.
import Recibo from "./pages/print/Recibo";
import Carnets from "./pages/print/Carnets";
import PrintVenta from "./pages/print/PrintVenta";
import PrintCaja from "./pages/print/PrintCaja";
import Socios from "./pages/app/socios/Index";
import Membresias from "./pages/app/membresias/Index";
import Cobranza from "./pages/app/cobranza/Index";
import Acceso from "./pages/app/acceso/Index";
import Clases from "./pages/app/clases/Index";
import Entrenamiento from "./pages/app/entrenamiento/Index";
import Salud from "./pages/app/salud/Index";
import Instructores from "./pages/app/instructores/Index";
import Caja from "./pages/app/caja/Index";
import Reportes from "./pages/app/reportes/Index";
import Avisos from "./pages/app/avisos/Index";
import Eventos from "./pages/app/eventos/Index";

// Kiosco y webs públicas
import Kiosco from "./pages/kiosco/Index";
import WebPublica from "./pages/public/web_publica/Index";
import WebSocio from "./pages/public/web_socio/Index";
import ClubLegal from "./pages/public/ClubLegal";
import Legal from "./pages/public/Legal";

function App() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    initVocab(getSessionUser()?.rubro);
    // las páginas públicas se ven siempre en claro (lo fuerza useLightPage)
    if (/^\/(c|legal)\//.test(window.location.pathname)) return;
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* PANEL GENERAL (Mezztt) */}
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/sistemas" element={<Sistemas />} />
          <Route path="/admin/pagos" element={<Pagos />} />
          <Route path="/admin/facturacion" element={<AdminBilling />} />
          <Route path="/admin/correos" element={<MailCenter />} />
          <Route path="/admin/configuracion" element={<AdminSettings />} />
        </Route>

        {/* SISTEMA DEL CLUB */}
        <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
          <Route path="/app" element={<Inicio />} />
          <Route path="/app/bajas" element={<Bajas />} />
          <Route path="/app/usuarios" element={<Usuarios />} />
          <Route path="/app/configuracion" element={<Configuracion />} />
          <Route path="/app/socios/*" element={<Socios />} />
          <Route path="/app/membresias/*" element={<Membresias />} />
          <Route path="/app/cobranza/*" element={<Cobranza />} />
          <Route path="/app/acceso/*" element={<Acceso />} />
          <Route path="/app/clases/*" element={<Clases />} />
          <Route path="/app/entrenamiento/*" element={<Entrenamiento />} />
          <Route path="/app/salud/*" element={<Salud />} />
          <Route path="/app/instructores/*" element={<Instructores />} />
          <Route path="/app/caja/*" element={<Caja />} />
          <Route path="/app/reportes/*" element={<Reportes />} />
          <Route path="/app/avisos/*" element={<Avisos />} />
          <Route path="/app/eventos/*" element={<Eventos />} />
        </Route>

        {/* KIOSCO DE INGRESO (usuario KIOSCO, pantalla completa) */}
        <Route path="/print/recibo/:id" element={<ProtectedRoute><Recibo /></ProtectedRoute>} />
        <Route path="/print/carnets" element={<ProtectedRoute><Carnets /></ProtectedRoute>} />
        <Route path="/print/venta/:id" element={<ProtectedRoute><PrintVenta /></ProtectedRoute>} />
        <Route path="/print/caja/:id" element={<ProtectedRoute><PrintCaja /></ProtectedRoute>} />
        <Route path="/kiosco/*" element={<ProtectedRoute><Kiosco /></ProtectedRoute>} />

        {/* PÁGINAS PÚBLICAS DEL CLUB: condiciones, baja y arrepentimiento existen siempre */}
        <Route path="/c/:slug/condiciones" element={<ClubLegal page="condiciones" />} />
        <Route path="/c/:slug/baja" element={<ClubLegal page="baja" />} />
        <Route path="/c/:slug/arrepentimiento" element={<ClubLegal page="arrepentimiento" />} />
        <Route path="/c/:slug/socio/*" element={<WebSocio />} />
        <Route path="/c/:slug/*" element={<WebPublica />} />
        <Route path="/c/:slug" element={<WebPublica />} />

        {/* LEGALES DEL SISTEMA (sin login) */}
        <Route path="/legal/terminos" element={<Legal doc="terminos" />} />
        <Route path="/legal/privacidad" element={<Legal doc="privacidad" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
