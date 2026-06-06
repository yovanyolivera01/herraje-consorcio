import { createContext, useContext, useState, useEffect } from 'react'

const USUARIOS = {
  '129': { role: 'admin',    nombre: 'Super Usuario' },
  '130': { role: 'vendedor', nombre: 'Vendedor' },
  '131': { role: 'almacen',  nombre: 'Almacén' },
  '132': { role: 'rh',       nombre: 'Recursos Humanos' },
}

// ── Rutas permitidas por rol (null = acceso total) ─────────────────────────
export const PERMISOS = {
  admin: null,

  vendedor: [
    '/ventas/nueva',
    '/ventas/historial',
    '/cot/nueva',
    '/cot/registrado',
    '/cot/pedidos-pendientes',
    '/cot/historial',
    '/cot/ventas',
  ],

  almacen: [
    '/herraje/historial',
    '/ventas/nueva',
    '/ventas/historial',
    '/cot/nueva',
    '/cot/registrado',
    '/cot/pedidos-pendientes',
    '/cot/ventas',
    '/proveedores',
    '/productos',
    '/cot/inventario',
    '/cot/tipos-vidrio',
    '/cot/procesos',
    '/cot/empresas',
    '/cot/precios',
    '/cot/clientes',
  ],

  rh: [
    '/personal/empleados',
    '/personal/registro',
    '/personal/resumen',
  ],
}

export const HOME_POR_ROL = {
  admin:    '/proveedores',
  vendedor: '/cot/nueva',
  almacen:  '/cot/nueva',
  rh:       '/personal/empleados',
}

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [role,    setRole]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = sessionStorage.getItem('hc_user')
    if (saved) {
      const parsed = JSON.parse(saved)
      setUser(parsed)
      setRole(parsed.role)
    }
    setLoading(false)
  }, [])

  const login = (usuario, password) => {
    const u = USUARIOS[usuario]
    if (!u || password !== usuario) throw new Error('Credenciales incorrectas')
    const session = { usuario, ...u }
    sessionStorage.setItem('hc_user', JSON.stringify(session))
    setUser(session)
    setRole(u.role)
    return session
  }

  const logout = () => {
    sessionStorage.removeItem('hc_user')
    setUser(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
