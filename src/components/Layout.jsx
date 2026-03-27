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
      { to: '/ventas/nueva', icon: '🧾', label: 'Nueva venta' },
      { to: '/ventas/historial', icon: '📊', label: 'Historial' },
    ],
  },
]

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Herraje</h1>
          <p>Consorcio</p>
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
                >
                  <span className="nav-icon">{icon}</span>
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
