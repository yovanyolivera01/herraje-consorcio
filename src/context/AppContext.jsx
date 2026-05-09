import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from '../lib/api'
import { supabaseConfigured } from '../lib/supabase'

const AppContext = createContext()

// ── Setup screen (faltan variables de entorno) ────────────────────────────
function SetupScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 16,
      background: '#f0f4f8', padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48 }}>🔧</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a5f' }}>
        Configuración requerida
      </div>
      <div style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: '20px 28px', maxWidth: 520, textAlign: 'left',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <p style={{ marginBottom: 14, fontSize: 14, color: '#4a5568' }}>
          Crea el archivo <code style={{ background: '#f0f4f8', padding: '2px 6px', borderRadius: 4 }}>.env</code> en la raíz del proyecto con tus credenciales de Supabase:
        </p>
        <pre style={{
          background: '#1e3a5f', color: '#e2e8f0', padding: '14px 16px',
          borderRadius: 8, fontSize: 12.5, lineHeight: 1.7, overflowX: 'auto',
        }}>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}</pre>
        <p style={{ marginTop: 14, fontSize: 13, color: '#718096' }}>
          Encuéntralos en tu panel de Supabase →{' '}
          <strong>Settings → API → Project URL y anon public key</strong>.
        </p>
        <p style={{ marginTop: 10, fontSize: 13, color: '#718096' }}>
          Después reinicia el servidor: <code style={{ background: '#f0f4f8', padding: '2px 6px', borderRadius: 4 }}>npm run dev</code>
        </p>
      </div>
    </div>
  )
}

// ── Loading screen ────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 14,
      background: '#f0f4f8', color: '#718096',
    }}>
      <div style={{ fontSize: 44 }}>⚙️</div>
      <div style={{ fontSize: 15, fontWeight: 500 }}>Conectando con la base de datos…</div>
    </div>
  )
}

// ── Error screen ──────────────────────────────────────────────────────────
function ErrorScreen({ message, onRetry }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 14,
      background: '#f0f4f8', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 44 }}>❌</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#991b1b' }}>
        Error de conexión
      </div>
      <div style={{ fontSize: 13, color: '#718096', maxWidth: 420 }}>{message}</div>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 20px', background: '#1e3a5f', color: 'white',
          border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14,
        }}
      >
        Reintentar
      </button>
    </div>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [proveedores, setProveedores] = useState([])
  const [productos,   setProductos]   = useState([])
  const [ventas,      setVentas]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [provs, prods, vents] = await Promise.all([
        api.getProveedores(),
        api.getProductos(),
        api.getVentas(),
      ])
      setProveedores(provs.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
      setProductos(prods)
      setVentas(vents)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (supabaseConfigured) loadAll() }, [loadAll])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const wrap = (fn) => async (...args) => {
    try {
      const result = await fn(...args)
      return { data: result }
    } catch (err) {
      // Traducir errores de FK a mensajes legibles
      const msg = err.message || 'Error desconocido'
      if (msg.includes('violates foreign key') || msg.includes('RESTRICT'))
        return { error: 'Operación no permitida: el registro tiene dependencias activas' }
      return { error: msg }
    }
  }

  // ── Proveedores ──────────────────────────────────────────────────────────
  const addProveedor = async (data) => {
    const res = await wrap(api.createProveedor)(data)
    if (!res.error) setProveedores((await api.getProveedores()).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    return res
  }

  const updateProveedor = async (codigo, data) => {
    const res = await wrap(api.updateProveedor)(codigo, data)
    if (!res.error) setProveedores((await api.getProveedores()).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    return res
  }

  const deleteProveedor = async (codigo) => {
    const res = await wrap(api.deleteProveedor)(codigo)
    if (!res.error) setProveedores((await api.getProveedores()).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    if (res.error?.includes('dependencias'))
      return { error: 'No se puede eliminar: el proveedor tiene productos activos' }
    return res
  }

  // ── Productos ────────────────────────────────────────────────────────────
  const addProducto = async (data) => {
    const res = await wrap(api.createProducto)(data)
    if (!res.error) setProductos(await api.getProductos())
    return res
  }

  const updateProducto = async (productoId, data) => {
    const res = await wrap(api.updateProducto)(productoId, data)
    if (!res.error) setProductos(await api.getProductos())
    return res
  }

  const deleteProducto = async (codigo) => {
    const res = await wrap(api.deleteProducto)(codigo)
    if (!res.error) setProductos(await api.getProductos())
    if (res.error?.includes('dependencias'))
      return { error: 'No se puede eliminar: el producto tiene ventas registradas' }
    return res
  }

  const ajustarExistencias = async (productoId, delta, tipo, nota) => {
    const res = await wrap(api.ajustarExistencias)(productoId, delta, tipo, nota)
    if (!res.error) setProductos(await api.getProductos())
    return res
  }

  // ── Ventas ───────────────────────────────────────────────────────────────
  const addVenta = async (partidas) => {
    const res = await wrap(api.createVenta)(partidas)
    if (!res.error) {
      // Refrescar stock y historial en paralelo
      const [prods, vents] = await Promise.all([api.getProductos(), api.getVentas()])
      setProductos(prods)
      setVentas(vents)
    }
    return res
  }

  const getDetalleVenta = async (ventaId) => wrap(api.getDetalleVenta)(ventaId)

  // ── Render ───────────────────────────────────────────────────────────────
  if (!supabaseConfigured) return <SetupScreen />
  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen message={error} onRetry={loadAll} />

  return (
    <AppContext.Provider value={{
      proveedores, addProveedor, updateProveedor, deleteProveedor,
      productos,   addProducto,  updateProducto,  deleteProducto, ajustarExistencias,
      ventas,      addVenta,     getDetalleVenta,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
