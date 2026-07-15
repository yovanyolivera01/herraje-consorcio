import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoVR from '../assets/images/logoVR.jpeg'
import {
  Truck, Package, ReceiptText, BarChart2,
  Layers, Settings2, Building2, Users, Tag,
  ClipboardList, Clock, CheckCircle2,
  HardHat, CalendarClock, ClipboardCheck,
  LogOut, Menu, ChevronDown, ChevronLeft, ChevronRight, Crown, User,
  Frame, DoorOpen, Hammer, Warehouse, Box,
  ShoppingCart, TrendingUp, Archive,
  CardSim, Moon, Sun,
} from 'lucide-react'

// ── Navegacion del sistema Herraje ────────────────────────────────────────
const herrajeNavItems = [
  { section: 'Proveedores', links: [{ to: '/proveedores', icon: <Truck size={16} />, label: 'Proveedores' }] },
  { section: 'Ventas', links: [
    { to: '/ventas/nueva',     icon: <ReceiptText size={16} />, label: 'Venta Herraje' },
  ]},
]

// ── Navegacion del sistema Cotizacion de Vidrio (solo catalogos) ─────────
const cotNavItems = [
  { section: 'Catalogos', links: [
    { to: '/cot/tipos-vidrio', icon: <Layers size={16} />,    label: 'Tipos de Vidrio' },
    { to: '/cot/procesos',     icon: <Settings2 size={16} />, label: 'Procesos' },
    { to: '/cot/empresas',     icon: <Building2 size={16} />, label: 'Empresas' },
    { to: '/cot/precios',      icon: <Tag size={16} />,       label: 'Precios' },
    { to: '/cot/clientes',     icon: <Users size={16} />,     label: 'Clientes' },
  ]},
]

const cotNavEmpleado = []

// ── Ventas ────────────────────────────────────────────────────────────────
const ventasNavItems = [
  { section: 'Ventas', links: [
    { to: '/cot/nueva',              icon: <ClipboardList size={16} />,  label: 'Nueva cotizacion' },
  //  { to: '/cot/registrado',         icon: <ClipboardCheck size={16} />, label: 'Cliente registrado' },
    { to: '/cot/pedidos-pendientes', icon: <Clock size={16} />,          label: 'Pendientes' },
  ]},
]

const ventasNavEmpleado = [
  { section: 'Ventas', links: [
    { to: '/cot/nueva',              icon: <ClipboardList size={16} />,  label: 'Nueva cotizacion' },
    { to: '/cot/pedidos-pendientes', icon: <Clock size={16} />,          label: 'Pendientes' },
  ]},
]

// ── Reportes ──────────────────────────────────────────────────────────────
const reportesNavItems = [
  { section: 'Reportes', links: [
    { to: '/cot/ventas',            icon: <CheckCircle2 size={16} />, label: 'Ventas netas' },
    { to: '/cot/reporte-vidrio',    icon: <Frame size={16} />,        label: 'Reporte Vidrio' },
    { to: '/cot/historial',         icon: <BarChart2 size={16} />,    label: 'Cotizaciones' },
    { to: '/cot/historial-maquila', icon: <Hammer size={16} />,       label: 'Historial de maquila' },
    { to: '/herraje/historial',     icon: <Box size={16} />,          label: 'Historial de herraje' },
  ]},
]

// ── Inventarios ───────────────────────────────────────────────────────────
const inventariosNavItems = [
  { section: 'Almacén', links: [
    { to: '/cot/inventario', icon: <Warehouse size={16} />, label: 'Inventario vidrio' },
    { to: '/productos',      icon: <Package size={16} />,   label: 'Inventario de herraje' },
  ]},
]

// ── Nav por rol: vendedor ─────────────────────────────────────────────────
const herrajeNavVendedor = [
  { section: 'Ventas herraje', links: [
    { to: '/ventas/nueva',     icon: <ReceiptText size={16} />, label: 'Nueva venta' },
    { to: '/ventas/historial', icon: <BarChart2 size={16} />,   label: 'Historial ventas' },
  ]},
]

const ventasNavVendedor = [
  { section: 'Ventas', links: [
    { to: '/cot/nueva',              icon: <ClipboardList size={16} />,  label: 'Nueva cotizacion' },
    { to: '/cot/registrado',         icon: <ClipboardCheck size={16} />, label: 'Cliente registrado' },
    { to: '/cot/pedidos-pendientes', icon: <Clock size={16} />,          label: 'Pendientes' },
  ]},
]

const reportesNavVendedor = [
  { section: 'Reportes', links: [
    { to: '/cot/historial', icon: <BarChart2 size={16} />,    label: 'Cotizaciones' },
    { to: '/cot/ventas',    icon: <CheckCircle2 size={16} />, label: 'Ventas netas' },
  ]},
]

// ── Nav por rol: almacen ──────────────────────────────────────────────────
const herrajeNavAlmacen = [
  { section: 'Historial', links: [
    { to: '/herraje/historial', icon: <Box size={16} />, label: 'Historial de herraje' },
  ]},
]

const ventasNavAlmacen = [
  { section: 'Ventas', links: [
    { to: '/cot/nueva',              icon: <ClipboardList size={16} />,  label: 'Nueva cotizacion' },
    { to: '/cot/registrado',         icon: <ClipboardCheck size={16} />, label: 'Cliente registrado' },
    { to: '/cot/pedidos-pendientes', icon: <Clock size={16} />,          label: 'Pendientes' },
    { to: '/ventas/nueva',           icon: <ReceiptText size={16} />,    label: 'Nueva venta' },
    { to: '/ventas/historial',       icon: <BarChart2 size={16} />,      label: 'Historial ventas' },
    { to: '/cot/ventas',             icon: <CheckCircle2 size={16} />,   label: 'Ventas netas' },
  ]},
]

const inventariosNavAlmacen = [
  { section: 'Almacén', links: [
    { to: '/cot/inventario', icon: <Warehouse size={16} />, label: 'Inventario vidrio' },
    { to: '/productos',      icon: <Package size={16} />,   label: 'Inventario de herraje' },
    { to: '/proveedores',    icon: <Truck size={16} />,      label: 'Proveedores' },
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

const EgresosNavItes =[
  {section:'Egresos',links: [
    {to:'/admin/usuarios',icon:<CardSim size={16}></CardSim>,label:'Registrar Egreso'},
  ]},
]


// ── Iconos de sistema ─────────────────────────────────────────────────────
const sistemaIconos = {
  herraje:     <DoorOpen size={18} />,
  vidrio:      <Frame size={18} />,
  ventas:      <ShoppingCart size={18} />,
  reportes:    <TrendingUp size={18} />,
  inventarios: <Archive size={18} />,
  personal:    <HardHat size={18} />,
  egresos:     <CardSim size={18}/>,
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1024
)
  const [busqueda, setBusqueda] = useState('')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')
  const location = useLocation()
  const { role, user, logout } = useAuth()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  useEffect(() => {
    const handleResize = () => setSidebarCollapsed(window.innerWidth >= 768 && window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const path       = location.pathname
  const isPersonal = path.startsWith('/personal')

  const ventasRoutes     = ['/cot/nueva', '/cot/registrado', '/cot/pedidos-pendientes']
  const reportesRoutes   = ['/cot/ventas', '/cot/reporte-vidrio', '/cot/historial', '/cot/historial-maquila', '/herraje/historial']
  const inventariosRoutes= ['/cot/inventario', '/productos']
  const vidrioRoutes     = ['/cot/tipos-vidrio', '/cot/procesos', '/cot/empresas', '/cot/precios', '/cot/clientes']

  const egresosRoutes = ['/admin/usuarios']

  const sistemaActivo = isPersonal
    ? 'personal'
    : ventasRoutes.some(r => path.startsWith(r))      ? 'ventas'
    : reportesRoutes.some(r => path.startsWith(r))    ? 'reportes'
    : inventariosRoutes.some(r => path.startsWith(r)) ? 'inventarios'
    : vidrioRoutes.some(r => path.startsWith(r))      ? 'vidrio'
    : egresosRoutes.some(r => path.startsWith(r))     ? 'egresos'
    : 'herraje'

  const [expanded, setExpanded] = useState(sistemaActivo)

  useEffect(() => { setExpanded(sistemaActivo) }, [sistemaActivo])

  const sistemaLabel = {
    herraje: 'Templados Consorcio', vidrio: 'Catalogos',
    ventas: 'Ventas', reportes: 'Reportes', inventarios: 'Almacén', personal: 'Personal', egresos: 'Egresos',
  }
  const topbarTitle = sistemaLabel[sistemaActivo] ?? 'Templados Consorcio'

  const closeDrawer = () => setDrawerOpen(false)
  const toggleSystem = (key) => setExpanded(prev => prev === key ? '' : key)

  const sistemas =
    role === 'admin' ? [
      { key: 'herraje',     label: 'Herraje',   items: herrajeNavItems },
      { key: 'ventas',      label: 'Ventas',    items: ventasNavItems },
      { key: 'reportes',    label: 'Reportes',  items: reportesNavItems },
      { key: 'inventarios', label: 'Almacén',   items: inventariosNavItems },
      { key: 'vidrio',      label: 'Catalogos', items: cotNavItems },
      { key: 'personal',    label: 'Personal',  items: personalNavItems },
      {key:  'egresos',     label: 'Egresos',   items: EgresosNavItes}
    ]
    : role === 'vendedor' ? [
      { key: 'ventas',   label: 'Ventas',   items: ventasNavVendedor },
      { key: 'reportes', label: 'Reportes', items: reportesNavVendedor },
      { key: 'herraje',  label: 'Herraje',  items: herrajeNavVendedor },
    ]
    : role === 'almacen' ? [
      { key: 'herraje',     label: 'Herraje',   items: herrajeNavAlmacen },
      { key: 'ventas',      label: 'Ventas',    items: ventasNavAlmacen },
      { key: 'inventarios', label: 'Almacén',   items: inventariosNavAlmacen },
      { key: 'vidrio',      label: 'Catalogos', items: cotNavItems },
    ]
    : []

  const q = busqueda.trim().toLowerCase()
  const sistemasFiltrados = q
    ? sistemas
        .map(s => ({
          ...s,
          items: s.items
            .map(({ section, links }) => ({
              section,
              links: links.filter(l => l.label.toLowerCase().includes(q)),
            }))
            .filter(({ links }) => links.length > 0),
        }))
        .filter(s => s.items.length > 0 || s.label.toLowerCase().includes(q))
    : sistemas

  return (
    <div className={`layout${sidebarCollapsed ? ' layout-collapsed' : ''}`}>
      {drawerOpen && <div className="sidebar-overlay" onClick={closeDrawer} />}

      <aside className={`sidebar${drawerOpen ? ' sidebar-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo" style={{ justifyContent: 'center', padding: '12px 10px' }}>
          {sidebarCollapsed
            ? <span className="sidebar-logo-icon">{sistemaIconos[sistemaActivo]}</span>
            : <img src={logoVR} alt="Vidreria Rosales" style={{ maxWidth: '100%', width: 100, borderRadius: 6, display: 'block' }} />
          }
        </div>

        {/* Buscador */}
        {!sidebarCollapsed && (
          <div style={{ padding: '0 10px 8px' }}>
            <input
              type="text"
              placeholder="Buscar módulo..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '6px 10px', borderRadius: 7, fontSize: 13,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', outline: 'none',
              }}
            />
          </div>
        )}

        {/* Acordeón de sistemas */}
        <nav className="sidebar-nav" style={{ paddingTop: 4 }}>
          {(q ? sistemasFiltrados : sistemas).map(({ key, label, items }) => {
            const isActive = sistemaActivo === key
            const isOpen   = q ? true : expanded === key
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

        <div style={{ padding: '0 10px 4px' }}>
          <button
            onClick={logout}
            title="Cerrar sesión"
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: 8, padding: sidebarCollapsed ? '8px 0' : '8px 14px',
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'none', cursor: 'pointer', color: 'var(--danger, #dc2626)',
              fontSize: 13, fontWeight: 600,
            }}
          >
            <LogOut size={15} />
            {!sidebarCollapsed && 'Cerrar sesión'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '4px 10px 10px' }}>
          <button
            className="sidebar-collapse-btn"
            style={{ flex: 1, margin: 0 }}
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Expandir menú' : 'Compactar menú'}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
          <button
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6,
              background: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s', flexShrink: 0,
            }}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
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
              <span>{user?.nombre ?? user?.user_metadata?.nombre ?? user?.email?.split('@')[0]}</span>
            </span>
            <button
              onClick={() => setDarkMode(d => !d)}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center',
              }}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
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
