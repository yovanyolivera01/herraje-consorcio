import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Truck, Package, ReceiptText, BarChart2,
  Layers, Settings2, Building2, Users, Tag,
  ClipboardList, Clock, CheckCircle2,
  HardHat, CalendarClock, ClipboardCheck,
  LogOut, Menu, ChevronDown, ChevronLeft, ChevronRight, Crown, User,
  Frame, DoorOpen, Hammer, Warehouse, Box,
} from 'lucide-react'

// ── Navegacion del sistema Herraje ────────────────────────────────────────
const herrajeNavItems = [
  { section: 'Proveedores', links: [{ to: '/proveedores', icon: <Truck size={16} />, label: 'Proveedores' }] },
  { section: 'Productos',   links: [
    { to: '/productos',             icon: <Package size={16} />, label: 'Inventario' },
    { to: '/productos-generales',   icon: <Box size={16} />,     label: 'Productos generales' },
  ]},
  { section: 'Ventas', links: [
    { to: '/ventas/nueva',     icon: <ReceiptText size={16} />, label: 'Nueva venta' },
    { to: '/ventas/historial', icon: <BarChart2 size={16} />,  label: 'Historial' },
  ]},
]

// ── Navegacion del sistema Cotizacion de Vidrio ───────────────────────────
const cotNavItems = [
  { section: 'Catalogos', links: [
    { to: '/cot/tipos-vidrio', icon: <Layers size={16} />,    label: 'Tipos de Vidrio' },
    { to: '/cot/procesos',     icon: <Settings2 size={16} />, label: 'Procesos' },
    { to: '/cot/empresas',     icon: <Building2 size={16} />, label: 'Empresas' },
    { to: '/cot/clientes',     icon: <Users size={16} />,     label: 'Clientes' },
    { to: '/cot/precios',      icon: <Tag size={16} />,       label: 'Precios' },
  ]},
  { section: 'Cotizaciones', links: [
    { to: '/cot/nueva',      icon: <ClipboardList size={16} />,  label: 'Nueva cotizacion' },
    { to: '/cot/registrado', icon: <ClipboardCheck size={16} />, label: 'Cliente registrado' },
    { to: '/cot/historial',  icon: <BarChart2 size={16} />,      label: 'Historial' },
  ]},
  { section: 'Pedidos', links: [
    { to: '/cot/pedidos-pendientes', icon: <Clock size={16} />,        label: 'Pendientes' },
    { to: '/cot/ventas',             icon: <CheckCircle2 size={16} />, label: 'Historial de ventas' },
  ]},
  { section: 'Maquila', links: [
    { to: '/cot/maquila/historial', icon: <BarChart2 size={16} />, label: 'Historial' },
  ]},
  { section: 'Inventario', links: [
    { to: '/cot/inventario', icon: <Warehouse size={16} />, label: 'Inventario de vidrio' },
  ]},
]

const cotNavEmpleado = [
  { section: 'Cotizaciones', links: [
    { to: '/cot/nueva', icon: <ClipboardList size={16} />, label: 'Nueva cotizacion' },
  ]},
  { section: 'Pedidos', links: [
    { to: '/cot/pedidos-pendientes', icon: <Clock size={16} />, label: 'Pendientes' },
  ]},
]

const herrajeNavEmpleado = [
  { section: 'Ventas', links: [
    { to: '/ventas/nueva', icon: <ReceiptText size={16} />, label: 'Nueva venta' },
  ]},
]

const personalNavItems = [
  { section: 'Empleados', links: [
    { to: '/personal/empleados', icon: <HardHat size={16} />, label: 'Empleados' },
  ]},
  { section: 'Asistencia', links: [
    { to: '/personal/registro', icon: <CalendarClock size={16} />, label: 'Registro Semanal' },
    { to: '/personal/resumen',  icon: <BarChart2 size={16} />,     label: 'Resumen Semanal' },
  ]},
]

// ── Iconos de sistema ─────────────────────────────────────────────────────
const sistemaIconos = {
  herraje:  <DoorOpen size={18} />,
  vidrio:   <Frame size={18} />,
  personal: <HardHat size={18} />,
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const { role, user, logout } = useAuth()

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const esEmpleado = role === 'empleado'
  const isCot      = location.pathname.startsWith('/cot')
  const isPersonal = location.pathname.startsWith('/personal')

  const sistemaActivo = isPersonal ? 'personal' : isCot ? 'vidrio' : 'herraje'
  const [expanded, setExpanded] = useState(sistemaActivo)

  useEffect(() => { setExpanded(sistemaActivo) }, [sistemaActivo])

  const topbarTitle = isPersonal
    ? 'Gestión de Personal'
    : isCot ? 'Cotizacion de Vidrio' : 'Templados Consorcio'

  const closeDrawer = () => setDrawerOpen(false)
  const toggleSystem = (key) => setExpanded(prev => prev === key ? '' : key)

  const sistemas = [
    { key: 'herraje',  label: 'Herraje',  items: esEmpleado ? herrajeNavEmpleado : herrajeNavItems },
    { key: 'vidrio',   label: 'Vidrio',   items: esEmpleado ? cotNavEmpleado     : cotNavItems },
    ...(!esEmpleado ? [{ key: 'personal', label: 'Personal', items: personalNavItems }] : []),
  ]

  return (
    <div className={`layout${sidebarCollapsed ? ' layout-collapsed' : ''}`}>
      {drawerOpen && <div className="sidebar-overlay" onClick={closeDrawer} />}

      <aside className={`sidebar${drawerOpen ? ' sidebar-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">
            {sistemaIconos[sistemaActivo]}
          </span>
          <div className="sidebar-logo-text">
            <h1>{isPersonal ? 'Personal' : isCot ? 'Vidrio' : 'Herraje'}</h1>
            <p>Consorcio</p>
          </div>
        </div>

        {/* Acordeón de sistemas */}
        <nav className="sidebar-nav" style={{ paddingTop: 8 }}>
          {sistemas.map(({ key, label, items }) => {
            const isActive = sistemaActivo === key
            const isOpen   = expanded === key
            return (
              <div key={key} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => toggleSystem(key)}
                  title={sidebarCollapsed ? label : undefined}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    gap: sidebarCollapsed ? 0 : 10,
                    padding: sidebarCollapsed ? '10px 0' : '10px 14px',
                    border: 'none', borderRadius: 8,
                    background: isActive ? 'var(--accent)' : isOpen ? 'var(--bg)' : 'transparent',
                    color: isActive ? 'white' : 'var(--text)',
                    cursor: 'pointer', fontSize: 14, fontWeight: isActive ? 700 : 600,
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.75 }}>
                    {sistemaIconos[key]}
                  </span>
                  {!sidebarCollapsed && (
                    <>
                      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                      <ChevronDown
                        size={14}
                        style={{
                          transition: 'transform 0.2s',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          opacity: 0.5,
                        }}
                      />
                    </>
                  )}
                </button>

                {isOpen && (
                  <div style={{ paddingLeft: 8, paddingTop: 2, paddingBottom: 4 }}>
                    {items.map(({ section, links }) => (
                      <div key={section}>
                        <div className="nav-section" style={{ paddingLeft: 14 }}>{section}</div>
                        {links.map(({ to, icon, label: lLabel }) => (
                          <NavLink
                            key={to}
                            to={to}
                            className={({ isActive: a }) => `nav-link${a ? ' active' : ''}`}
                            onClick={closeDrawer}
                            title={sidebarCollapsed ? lLabel : undefined}
                          >
                            <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}>
                              {icon}
                            </span>
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

        <button
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? 'Expandir menú' : 'Compactar menú'}
        >
          {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <button
            className="hamburger"
            onClick={() => setDrawerOpen(o => !o)}
            aria-label="Abrir menu"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Menu size={20} />
          </button>
          <span className="topbar-title">{topbarTitle}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              {role === 'admin'
                ? <Crown size={13} style={{ color: '#f59e0b' }} />
                : <User size={13} />
              }
              <span>{user?.nombre}</span>
            </span>
            <button
              onClick={logout}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
              title="Cerrar sesión"
            >
              <LogOut size={13} />
              Salir
            </button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
