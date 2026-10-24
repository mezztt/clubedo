import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  appApi, canAccess, getSessionUser, initVocab, moduleLabel, MENU_SECTIONS, MODULE_ICONS, pathFor, ROLE_LABELS,
  RUBRO_SHORT, THEME_KEY, TOKEN_KEY, USER_KEY, VOCAB_KEY, longDate, useVocab,
} from "../../config";
import type { SessionUser } from "../../config";
import NotificationsBell from "../../components/NotificationsBell";
import { ClubedoLogo, SidebarSignature } from "../../components/Brand";
import Assistant from "../../components/Assistant";
import CobrarModal from "../../components/c1/CobrarModal";
import Tour, { startTour } from "../../components/tour/Tour";
import { tourSteps } from "../../components/tour/steps";

interface MemberHit { id: number; full_name: string; dni?: string | null }

/** Buscador rápido de personas (por nombre o DNI) en la barra de arriba */
function QuickSearch() {
  const navigate = useNavigate();
  const { t } = useVocab();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MemberHit[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems([]); return; }
    const timer = window.setTimeout(() => {
      appApi<{ items?: MemberHit[] }>(`/members?limit=8&q=${encodeURIComponent(term)}`)
        .then((r) => { setItems(r.items || []); setOpen(true); }).catch(() => setItems([]));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="cb-quick-search" ref={box} data-tour="search">
      <span aria-hidden="true">⌕</span>
      <input placeholder={`Buscar ${t("member")} por nombre o DNI…`} value={q} onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)} aria-label={`Buscar ${t("member")}`} />
      {open && q.trim().length >= 2 && (
        <div className="cb-quick-results">
          {items.length === 0 ? <button type="button" disabled><small>Sin resultados</small></button> : items.map((p) => (
            <button key={p.id} type="button" onClick={() => { setOpen(false); setQ(""); navigate(`/app/socios/${p.id}`); }}>
              <span><strong>{p.full_name}</strong></span>
              <small>{p.dni ? `DNI ${p.dni}` : ""}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(getSessionUser());
  const [clock, setClock] = useState(new Date());
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);   // en el celular el menú se abre con un botón
  const [cobrar, setCobrar] = useState(false);
  useVocab();                                         // vuelve a pintar el menú si cambian las palabras del rubro

  // refresca módulos, rol y rubro por si los cambiaron desde el panel general
  useEffect(() => {
    appApi<SessionUser>("/auth/me")
      .then((me) => {
        localStorage.setItem(USER_KEY, JSON.stringify(me));
        if (!localStorage.getItem(VOCAB_KEY)) initVocab(me.rubro);
        setUser(me);
      })
      .catch(() => {});
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // el kiosco no usa el sistema: va a su pantalla
  useEffect(() => {
    if (user?.role === "KIOSCO") navigate("/kiosco", { replace: true });
  }, [user, navigate]);

  // si el módulo no está contratado o el rol no lo ve, vuelve al inicio
  useEffect(() => {
    if (!user) return;
    const m = location.pathname.split("/")[2];
    if (m && m !== "bajas" && MODULE_ICONS[m] && !canAccess(user, m)) navigate("/app", { replace: true });
  }, [user, location.pathname, navigate]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const sections = MENU_SECTIONS.map((s) => ({ ...s, items: s.items.filter((m) => canAccess(user, m)) })).filter((s) => s.items.length);
  const labelFor = (m: string) => (m === "bajas" ? "Bajas" : moduleLabel(m));
  const seg = location.pathname.split("/")[2] || "inicio";
  const current = MODULE_ICONS[seg] ? seg : "inicio";

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(VOCAB_KEY);
    window.location.href = "/";
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className={`app-layout ${menuOpen ? "cb-menu-open" : ""}`}>
      {menuOpen && <button type="button" className="cb-menu-backdrop" aria-label="Cerrar el menú" onClick={() => setMenuOpen(false)} />}
      <aside className="sidebar" id="cb-sidebar">
        <div className="sidebar-brand">
          <ClubedoLogo size={40} />
          <div className="sidebar-brand-text">
            <strong>{user?.company_name || "Clubedo"}</strong>
            <span>Clubedo · {user?.rubro ? RUBRO_SHORT[user.rubro] : "Club"}</span>
          </div>
        </div>
        <nav className="sidebar-nav" data-tour="menu">
          {sections.map((s) => (
            <div key={s.section}>
              {sections.length > 1 && <div className="nav-section">{s.section}</div>}
              {s.items.map((m) => (
                <button key={m} data-tour={`nav-${m}`} className={`nav-item ${current === m ? "active" : ""}`} onClick={() => navigate(pathFor(m))}>
                  <span aria-hidden="true"><Icon name={MODULE_ICONS[m]} /></span>
                  <span className="nav-item-text">{labelFor(m)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="cb-user-mini">
            <strong>{user?.name}</strong>
            <span>{ROLE_LABELS[user?.role || ""] || user?.role}</span>
          </div>
          <button className="logout-button" data-tour="theme" onClick={toggleTheme} style={{ marginBottom: 6 }}>
            <span className="nav-item-text with-icon"><Icon name={theme === "dark" ? "sun" : "moon"} size={15} />{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <button className="logout-button" data-tour="tour-help" onClick={startTour} style={{ marginBottom: 6 }}><span className="nav-item-text with-icon"><Icon name="help" size={15} />¿Cómo funcionamos?</span></button>
          <button className="logout-button" onClick={logout}><span className="nav-item-text with-icon"><Icon name="logout" size={15} />Cerrar sesión</span></button>
          <SidebarSignature />
        </div>
      </aside>
      {user && user.role !== "KIOSCO" && <Assistant user={user} />}
      {user && <Tour steps={tourSteps(user)} storageKey={`clubedo_${user.role.toLowerCase()}_${user.id ?? "x"}`} />}
      <div className="main-area">
        <header className="cb-topbar">
          <button type="button" className="cb-menu-button" aria-label="Abrir el menú" aria-expanded={menuOpen} aria-controls="cb-sidebar"
            onClick={() => setMenuOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="cb-topbar-when">
            <span className="cb-topbar-date">{longDate(clock)}</span>
            <strong className="cb-topbar-clock">{clock.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}</strong>
          </div>
          <div className="cb-topbar-right">
            {canAccess(user, "socios") && <QuickSearch />}
            {canAccess(user, "membresias") && user?.role !== "INSTRUCTOR" && (
              <button type="button" className="primary-button" data-tour="cobrar" style={{ padding: "8px 14px" }} onClick={() => setCobrar(true)}>Cobrar</button>
            )}
            <span data-tour="bell" className="cb-tour-wrap"><NotificationsBell onNew={() => setRefreshKey((k) => k + 1)} /></span>
          </div>
        </header>
        {cobrar && <CobrarModal onClose={() => setCobrar(false)} onDone={() => setRefreshKey((k) => k + 1)} />}
        <main className="page-content">
          {/* refreshKey: cuando llega un aviso nuevo, las pantallas se recargan solas */}
          <Outlet context={{ refreshKey }} />
        </main>
      </div>
    </div>
  );
}

export default ClientLayout;
