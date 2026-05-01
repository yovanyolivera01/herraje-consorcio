import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Rutas a las que el empleado tiene acceso
const EMPLEADO_ROUTES = ['/cot/nueva', '/cot/pedidos-pendientes', '/ventas/nueva']

// Página de inicio según rol
export const EMPLEADO_HOME = '/cot/nueva'
export const ADMIN_HOME    = '/proveedores'

export default function ProtectedRoute({ children }) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f0f4f8', color: '#718096',
      flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 36 }}>🔩</div>
      <div style={{ fontSize: 14 }}>Verificando sesión...</div>
    </div>
  )

  // No autenticado → login
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  // Admin → acceso total
  if (role === 'admin') return children

  // Empleado → solo rutas permitidas
  const allowed = EMPLEADO_ROUTES.some(r => location.pathname.startsWith(r))
  if (!allowed) return <Navigate to={EMPLEADO_HOME} replace />

  return children
}
