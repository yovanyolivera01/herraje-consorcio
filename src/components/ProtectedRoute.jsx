import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PERMISOS, HOME_POR_ROL } from '../context/AuthContext'

// Conservados para compatibilidad con imports existentes
export const ADMIN_HOME    = '/proveedores'
export const EMPLEADO_HOME = '/cot/nueva'

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

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  const permitidas = PERMISOS[role]
  if (permitidas !== null && permitidas !== undefined) {
    const allowed = permitidas.some(r => location.pathname.startsWith(r))
    if (!allowed) return <Navigate to={HOME_POR_ROL[role] ?? '/cot/nueva'} replace />
  }

  return children
}
