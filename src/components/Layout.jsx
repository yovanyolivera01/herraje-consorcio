import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

// ── Navegacion del sistema Herraje ────────────────────────────────────────
const herrajeNavItems = [
  { section: 'Proveedores', links: [{ to: '/proveedores', icon: '🏭', label: 'Proveedores' }] },
  { section: 'Productos',   links: [{ to: '/productos',   icon: '📦', label: 'Inventario' }] },
  { section: 'Ventas', links: [
    { to: '/ventas/nueva',     icon: '🧾', label: 'Nueva venta' },
    { to: '/ventas/historial', icon: '📊', label: 'Historial' },
  ]},
]

// ── Navegacion del sistema Cotizacion de Vidrio ───────────────────────────
const cotNavItems = [
  { section: 'Catalogos', links: [
    { to: '/cot/tipos-vidrio', icon: '🔩', label: 'Tipos de Vidrio' },
    { to: '/cot/procesos',     icon: '⚙️', label: 'Procesos' },
    { to: '/cot/clientes',     icon: '👥', label: 'Clientes' },
    { to: '/cot/precios',      icon: '💲', label: 'Precios' },
  ]},
  { section: 'Cotizaciones', links: [
    { to: '/cot/nueva',     icon: '📋', label: 'Nueva cotizacion' },
    { to: '/cot/historial', icon: '📊', label: 'Historial' },
  ]},
]

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isCot       = location.pathname.startsWith('/cot')
  const navItems    = isCot ? cotNavItems : herrajeNavItems
  const topbarTitle = isCot ? 'Cotizacion de Vidrio' : 'Herraje Consorcio'

  const closeDrawer = () => setDrawerOpen(false)

  const switchToHeraje = () => { navigate('/proveedores'); closeDrawer() }
  const switchToVidrio = () => { navigate('/cot/nueva');   closeDrawer() }

  return (
    <div className="layout">
      {drawerOpen && <div className="sidebar-overlay" onClick={closeDrawer} />}

      <aside className={`sidebar${drawerOpen ? ' sidebar-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">{isCot ? '🔩' : '🔧'}</span>
          <div className="sidebar-logo-text">
            <h1>{isCot ? 'Cotizacion' : 'Herraje'}</h1>
            <p>{isCot ? 'de Vidrio' : 'Consorcio'}</p>
          </div>
        </div>

        {/* Navegacion */}
        <nav className="sidebar-nav">
          {navItems.map(({ section, links }) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {links.map(({ to, icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={closeDrawer}
                >
                  <span className="nav-icon">{icon}</span>
                  <span className="nav-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Selector de sistema */}
        <div className="system-switcher">
          <div className="system-switcher-label">Sistema activo</div>
          <div className="system-switcher-btns">
            <button
              className={`system-btn${!isCot ? ' system-btn-active' : ''}`}
              onClick={switchToHeraje}
              title="Ir a Herraje Consorcio"
            >
              🔧 Herraje
            </button>
            <button
              className={`system-btn${isCot ? ' system-btn-active' : ''}`}
              onClick={switchToVidrio}
              title="Ir a Cotizacion de Vidrio"
            >
              🔩 Vidrio
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <button
            className="hamburger"
            onClick={() => setDrawerOpen(o => !o)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <span className="topbar-title">{topbarTitle}</span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
