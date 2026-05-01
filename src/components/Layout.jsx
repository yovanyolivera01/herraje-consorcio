import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
    { to: '/cot/empresas',     icon: '🏢', label: 'Empresas' },
    { to: '/cot/clientes',     icon: '👥', label: 'Clientes' },
    { to: '/cot/precios',      icon: '💲', label: 'Precios' },
  ]},
  { section: 'Cotizaciones', links: [
    { to: '/cot/nueva',              icon: '📋', label: 'Nueva cotizacion' },
    { to: '/cot/registrado',         icon: '🏢', label: 'Cliente registrado' },
    { to: '/cot/historial',          icon: '📊', label: 'Historial' },
  ]},
  { section: 'Pedidos', links: [
    { to: '/cot/pedidos-pendientes', icon: '⏳', label: 'Pendientes' },
    { to: '/cot/ventas',             icon: '✅', label: 'Historial de ventas' },
  ]},
]

// Nav reducido para empleados
const cotNavEmpleado = [
  { section: 'Cotizaciones', links: [
    { to: '/cot/nueva', icon: '📋', label: 'Nueva cotizacion' },
  ]},
  { section: 'Pedidos', links: [
    { to: '/cot/pedidos-pendientes', icon: '⏳', label: 'Pendientes' },
  ]},
]

const herrajeNavEmpleado = [
  { section: 'Ventas', links: [
    { to: '/ventas/nueva', icon: '🧾', label: 'Nueva venta' },
  ]},
]

// ── Navegacion del módulo de Personal ────────────────────────────────────
const personalNavItems = [
  { section: 'Empleados', links: [
    { to: '/personal/empleados', icon: '👷', label: 'Empleados' },
  ]},
  { section: 'Asistencia', links: [
    { to: '/personal/registro', icon: '🕐', label: 'Registro Semanal' },
    { to: '/personal/resumen',  icon: '📊', label: 'Resumen Semanal' },
  ]},
]

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { role, user, logout } = useAuth()

  // Bloquea el scroll del body cuando el drawer está abierto en móvil
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const esEmpleado = role === 'empleado'

  const isCot      = location.pathname.startsWith('/cot')
  const isPersonal = location.pathname.startsWith('/personal')
  const isHeraje   = !isCot && !isPersonal

  const sistemaActivo = isPersonal ? 'personal' : isCot ? 'vidrio' : 'herraje'
  const [expanded, setExpanded] = useState(sistemaActivo)

  // Sincroniza el acordeón con la ruta activa
  useEffect(() => { setExpanded(sistemaActivo) }, [sistemaActivo])

  const topbarTitle = isPersonal
    ? 'Gestión de Personal'
    : isCot ? 'Cotizacion de Vidrio' : 'Herraje Consorcio'

  const closeDrawer = () => setDrawerOpen(false)

  const toggleSystem = (key) => setExpanded(prev => prev === key ? '' : key)

  // Definición de sistemas para el acordeón
  const sistemas = [
    {
      key:   'herraje',
      icon:  '🚪',
      label: 'Herraje',
      items: esEmpleado ? herrajeNavEmpleado : herrajeNavItems,
    },
    {
      key:   'vidrio',
      icon:  '🪟',
      label: 'Vidrio',
      items: esEmpleado ? cotNavEmpleado : cotNavItems,
    },
    ...(!esEmpleado ? [{
      key:   'personal',
      icon:  '👷',
      label: 'Personal',
      items: personalNavItems,
    }] : []),
  ]

  return (
    <div className="layout">
      {drawerOpen && <div className="sidebar-overlay" onClick={closeDrawer} />}

      <aside className={`sidebar${drawerOpen ? ' sidebar-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">{isPersonal ? '👷' : isCot ? '🪟' : '🚪'}</span>
          <div className="sidebar-logo-text">
            <h1>{isPersonal ? 'Personal' : isCot ? 'Vidrio' : 'Herraje'}</h1>
            <p>Consorcio</p>
          </div>
        </div>

        {/* Acordeón de sistemas */}
        <nav className="sidebar-nav" style={{ paddingTop: 8 }}>
          {sistemas.map(({ key, icon, label, items }) => {
            const isActive = sistemaActivo === key
            const isOpen   = expanded === key
            return (
              <div key={key} style={{ marginBottom: 4 }}>
                {/* Cabecera del sistema */}
                <button
                  onClick={() => toggleSystem(key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', border: 'none', borderRadius: 8,
                    background: isActive ? 'var(--accent)' : isOpen ? 'var(--bg)' : 'transparent',
                    color: isActive ? 'white' : 'var(--text)',
                    cursor: 'pointer', fontSize: 14, fontWeight: isActive ? 700 : 600,
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                  <span style={{
                    fontSize: 11, transition: 'transform 0.2s',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    opacity: 0.6,
                  }}>▼</span>
                </button>

                {/* Links del sistema */}
                {isOpen && (
                  <div style={{ paddingLeft: 8, paddingTop: 2, paddingBottom: 4 }}>
                    {items.map(({ section, links }) => (
                      <div key={section}>
                        <div className="nav-section" style={{ paddingLeft: 14 }}>{section}</div>
                        {links.map(({ to, icon: lIcon, label: lLabel }) => (
                          <NavLink
                            key={to}
                            to={to}
                            className={({ isActive: a }) => `nav-link${a ? ' active' : ''}`}
                            onClick={closeDrawer}
                          >
                            <span className="nav-icon">{lIcon}</span>
                            <span className="nav-label">{lLabel}</span>
                          </NavLink>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{role === 'admin' ? '👑' : '👤'}</span>
              <span>{user?.nombre}</span>
            </span>
            <button
              onClick={logout}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              title="Cerrar sesión"
            >
              🚪 Salir
            </button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
