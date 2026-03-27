import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from '../lib/api'

const AppContext = createContext()

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
      setProveedores(provs)
      setProductos(prods)
      setVentas(vents)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

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
    if (!res.error) setProveedores(await api.getProveedores())
    return res
  }

  const updateProveedor = async (codigo, data) => {
    const res = await wrap(api.updateProveedor)(codigo, data)
    if (!res.error) setProveedores(await api.getProveedores())
    return res
  }

  const deleteProveedor = async (codigo) => {
    const res = await wrap(api.deleteProveedor)(codigo)
    if (!res.error) setProveedores(await api.getProveedores())
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

  const updateProducto = async (codigo, data) => {
    const res = await wrap(api.updateProducto)(codigo, data)
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
