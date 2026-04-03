import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  {
    section: 'Proveedores',
    links: [{ to: '/proveedores', icon: '🏭', label: 'Proveedores' }],
  },
  {
    section: 'Productos',
    links: [{ to: '/productos', icon: '📦', label: 'Inventario' }],
  },
  {
    section: 'Ventas',
    links: [
      { to: '/ventas/nueva',     icon: '🧾', label: 'Nueva venta' },
      { to: '/ventas/historial', icon: '📊', label: 'Historial'   },
    ],
  },
]

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className="layout">

      {/* Overlay oscuro cuando el menú está abierto en móvil */}
      {drawerOpen && (
        <div className="sidebar-overlay" onClick={closeDrawer} />
      )}

      <aside className={`sidebar${drawerOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🔧</span>
          <div className="sidebar-logo-text">
            <h1>Herraje</h1>
            <p>Consorcio</p>
          </div>
        </div>
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
      </aside>

      <main className="main-content">
        {/* Barra superior — solo visible en móvil */}
        <div className="topbar">
          <button
            className="hamburger"
            onClick={() => setDrawerOpen(o => !o)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <span className="topbar-title">Herraje Consorcio</span>
        </div>
        <Outlet />
      </main>

    </div>
  )
}
