import { createContext, useContext, useState, useEffect } from 'react'

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
    '/personal',
  ],
}

export const HOME_POR_ROL = {
  admin:    '/proveedores',
  vendedor: '/cot/nueva',
  almacen:  '/cot/nueva',
  rh:       '/personal/empleados',
}

const SESSION_KEY = 'hc_user_v2'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [role,    setRole]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      setUser(parsed)
      setRole(parsed.rol)
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const res = await fetch('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message ?? 'Credenciales incorrectas')
    }
    const userData = await res.json()
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    setUser(userData)
    setRole(userData.rol)
    return userData
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
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
