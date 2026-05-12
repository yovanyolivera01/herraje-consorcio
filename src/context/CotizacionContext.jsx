import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from '../lib/cotizacionApi'
import * as empApi from '../lib/empresasApi'
import * as maqApi from '../lib/maquilaApi'
import * as invApi from '../lib/inventarioVidrioApi'
import * as prodApi from '../lib/productosGeneralesApi'
import { supabaseConfigured } from '../lib/supabase'

const CotizacionContext = createContext()

// ── Provider ──────────────────────────────────────────────────────────────
export function CotizacionProvider({ children }) {
  const [tonos,          setTonos]          = useState([])
  const [espesores,      setEspesores]      = useState([])
  const [tiposVidrio,    setTiposVidrio]    = useState([])
  const [nivelesPrecio,  setNivelesPrecio]  = useState([])
  const [precios,        setPrecios]        = useState([])
  const [clientes,       setClientes]       = useState([])
  const [procesos,                setProcesos]                = useState([])
  const [preciosProceso,          setPreciosProceso]          = useState([])
  const [preciosProcesoEspecial,  setPreciosProcesoEspecial]  = useState([])
  const [unidades,                setUnidades]                = useState([])
  const [empresas,       setEmpresas]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [t, e, tv, np, pv, cl, pr, un, pp, ppe, em] = await Promise.all([
        api.getTonos(),
        api.getEspesores(),
        api.getTiposVidrio(),
        api.getNivelesPrecio(),
        api.getPreciosVidrio(),
        api.getClientes(),
        api.getProcesos(),
        api.getUnidadesCobro(),
        api.getPreciosProceso(),
        api.getPreciosProcesoEspecial(),
        empApi.getEmpresas(),
      ])
      setTonos(t)
      setEspesores(e)
      setTiposVidrio(tv)
      setNivelesPrecio(np)
      setPrecios(pv)
      setClientes(cl)
      setProcesos(pr)
      setUnidades(un)
      setPreciosProceso(pp)
      setPreciosProcesoEspecial(ppe)
      setEmpresas(em)
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
      const msg = err.message || 'Error desconocido'
      if (msg.includes('violates foreign key') || msg.includes('RESTRICT'))
        return { error: 'Operacion no permitida: el registro tiene dependencias activas' }
      if (msg.includes('unique') || msg.includes('duplicate'))
        return { error: 'Ya existe un registro con esos datos (combinacion duplicada)' }
      return { error: msg }
    }
  }

  // ── Tonos ─────────────────────────────────────────────────────────────────
  const addTono = async (data) => {
    const res = await wrap(api.createTono)(data)
    if (!res.error) setTonos(await api.getTonos())
    return res
  }
  const editTono = async (id, data) => {
    const res = await wrap(api.updateTono)(id, data)
    if (!res.error) setTonos(await api.getTonos())
    return res
  }

  // ── Espesores ─────────────────────────────────────────────────────────────
  const addEspesor = async (data) => {
    const res = await wrap(api.createEspesor)(data)
    if (!res.error) setEspesores(await api.getEspesores())
    return res
  }
  const editEspesor = async (id, data) => {
    const res = await wrap(api.updateEspesor)(id, data)
    if (!res.error) setEspesores(await api.getEspesores())
    return res
  }

  // ── Tipos de vidrio ───────────────────────────────────────────────────────
  const addTipoVidrio = async (data) => {
    const res = await wrap(api.createTipoVidrio)(data)
    if (!res.error) setTiposVidrio(await api.getTiposVidrio())
    return res
  }
  const editTipoVidrio = async (id, data) => {
    const res = await wrap(api.updateTipoVidrio)(id, data)
    if (!res.error) setTiposVidrio(await api.getTiposVidrio())
    return res
  }

  // ── Precios ───────────────────────────────────────────────────────────────
  const guardarPrecio = async (data) => {
    const res = await wrap(api.guardarPrecio)(data)
    if (!res.error) setPrecios(await api.getPreciosVidrio())
    return res
  }

  // ── Clientes ──────────────────────────────────────────────────────────────
  const addCliente = async (data) => {
    const res = await wrap(api.createCliente)(data)
    if (!res.error) setClientes(await api.getClientes())
    return res
  }
  const editCliente = async (id, data) => {
    const res = await wrap(api.updateCliente)(id, data)
    if (!res.error) setClientes(await api.getClientes())
    return res
  }

  // ── Procesos ──────────────────────────────────────────────────────────────
  const addProceso = async (data) => {
    const res = await wrap(api.createProceso)(data)
    if (!res.error) setProcesos(await api.getProcesos())
    return res
  }
  const editProceso = async (id, data) => {
    const res = await wrap(api.updateProceso)(id, data)
    if (!res.error) setProcesos(await api.getProcesos())
    return res
  }
  const guardarPreciosProceso = async (id_proceso, precios) => {
    const res = await wrap(api.guardarPreciosProceso)(id_proceso, precios)
    if (!res.error) setPreciosProceso(await api.getPreciosProceso())
    return res
  }
  const guardarPreciosProcesoEspecial = async (id_proceso, precios) => {
    const res = await wrap(api.guardarPreciosProcesoEspecial)(id_proceso, precios)
    if (!res.error) setPreciosProcesoEspecial(await api.getPreciosProcesoEspecial())
    return res
  }

  // ── Empresas ──────────────────────────────────────────────────────────────
  const addEmpresa = async (data) => {
    const res = await wrap(empApi.createEmpresa)(data)
    if (!res.error) setEmpresas(await empApi.getEmpresas())
    return res
  }
  const editEmpresa = async (id, data) => {
    const res = await wrap(empApi.updateEmpresa)(id, data)
    if (!res.error) setEmpresas(await empApi.getEmpresas())
    return res
  }
  const vincularClienteEmpresa = async (id_cliente, id_empresa) => {
    const res = await wrap(empApi.vincularClienteEmpresa)(id_cliente, id_empresa)
    if (!res.error) setClientes(await api.getClientes())
    return res
  }
  const guardarPrecioEmpresa           = async (payload) => wrap(empApi.guardarPrecioEmpresa)(payload)
  const guardarPrecioClienteRegistrado = async (payload) => wrap(empApi.guardarPrecioClienteRegistrado)(payload)
  const getDocumentoEmpresa            = wrap(empApi.getDocumentoEmpresa)

  // ── Maquila ───────────────────────────────────────────────────────────────
  const iniciarCotizacionMaquila       = wrap(maqApi.iniciarCotizacionMaquila)
  const agregarPartidaMaquila          = wrap(maqApi.agregarPartidaMaquila)
  const eliminarPartidaMaquila         = wrap(maqApi.eliminarPartidaMaquila)
  const finalizarCotizacionMaquila     = wrap(maqApi.finalizarCotizacionMaquila)
  const getTicketMaquila               = wrap(maqApi.getTicketMaquila)
  const getCotizacionesMaquila         = wrap(maqApi.getCotizacionesMaquila)
  const getDetalleCotizacionMaquila    = wrap(maqApi.getDetalleCotizacionMaquila)
  const reabrirCotizacion              = wrap(maqApi.reabrirCotizacion)
  const convertirMaquilaAPedido        = wrap(maqApi.convertirMaquilaAPedido)
  const getPedidosPendientesMaquila    = wrap(maqApi.getPedidosPendientesMaquila)
  const getDetallePedidoMaquila        = wrap(maqApi.getDetallePedidoMaquila)
  const entregarPartidaMaquila         = wrap(maqApi.entregarPartidaMaquila)
  const marcarAnticipoLiquidadoMaquila = wrap(maqApi.marcarAnticipoLiquidado)

  // ── Inventario ────────────────────────────────────────────────────────────
  const getInventarioVidrio       = wrap(invApi.getInventarioVidrio)
  const registrarInventarioVidrio = wrap(invApi.registrarInventarioVidrio)
  const ajustarInventario         = wrap(invApi.ajustarInventario)
  const getMovimientosInventario  = wrap(invApi.getMovimientosInventario)

  // ── Productos Generales ───────────────────────────────────────────────────
  const getProductosGenerales = wrap(prodApi.getProductosGenerales)
  const createProductoGeneral = wrap(prodApi.createProductoGeneral)
  const updateProductoGeneral = wrap(prodApi.updateProductoGeneral)

  // ── Cotizaciones ──────────────────────────────────────────────────────────
  const iniciarCotizacion  = wrap(api.iniciarCotizacion)
  const agregarPartida     = wrap(api.agregarPartida)
  const finalizarCotizacion = async (id, total) => {
    const res = await wrap(api.finalizarCotizacion)(id, total)
    return res
  }
  const cancelarCotizacion = wrap(api.cancelarCotizacion)
  const getCotizaciones    = wrap(api.getCotizaciones)
  const getDetalleCotizacion = wrap(api.getDetalleCotizacion)

  // ── Precio lookup ─────────────────────────────────────────────────────────
  const getPrecioVidrio = (id_tipo_vidrio, id_nivel_precio) => {
    const found = precios.find(
      p => p.id_tipo_vidrio === id_tipo_vidrio && p.id_nivel_precio === id_nivel_precio
    )
    return found ? Number(found.precio_m2) : null
  }

  const getPrecioProceso = (id_proceso, id_nivel_precio, id_espesor) => {
    const found = preciosProceso.find(
      p => p.id_proceso === id_proceso &&
           p.id_nivel_precio === id_nivel_precio &&
           (id_espesor === null ? true : p.id_espesor === id_espesor)
    )
    return found ? Number(found.precio_unitario) : null
  }

  const getPrecioProcesoEspecial = (id_proceso, id_nivel_precio) => {
    const found = preciosProcesoEspecial.find(
      p => p.id_proceso === id_proceso && p.id_nivel_precio === id_nivel_precio
    )
    return found ? Number(found.precio_unitario) : null
  }

  const barrenos = procesos.filter(p => p.activo && p.tipo === 'BARRENO')
  const saques   = procesos.filter(p => p.activo && p.tipo === 'SAQUE')

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 14,
      background: '#f0f4f8', color: '#718096',
    }}>
      <div style={{ fontSize: 44 }}>🔩</div>
      <div style={{ fontSize: 15, fontWeight: 500 }}>Cargando Cotizacion de Vidrio...</div>
    </div>
  )

  if (error) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 14,
      background: '#f0f4f8', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 44 }}>❌</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#991b1b' }}>Error de conexion</div>
      <div style={{ fontSize: 13, color: '#718096', maxWidth: 420 }}>{error}</div>
      <button
        onClick={loadAll}
        style={{ padding: '8px 20px', background: '#1e3a5f', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14 }}
      >
        Reintentar
      </button>
    </div>
  )

  return (
    <CotizacionContext.Provider value={{
      tonos, espesores, tiposVidrio, nivelesPrecio, precios, clientes, procesos, preciosProceso, preciosProcesoEspecial, unidades, empresas, barrenos, saques,
      addTono,      editTono,
      addEspesor,   editEspesor,
      addTipoVidrio, editTipoVidrio,
      guardarPrecio,
      addCliente,   editCliente,
      addProceso,   editProceso,   guardarPreciosProceso, guardarPreciosProcesoEspecial,
      addEmpresa,   editEmpresa,   vincularClienteEmpresa,
      guardarPrecioEmpresa, guardarPrecioClienteRegistrado,
      getPreciosEmpresa:           empApi.getPreciosEmpresa,
      getPreciosClienteRegistrado: empApi.getPreciosClienteRegistrado,
      getEmpresaDeCliente:         empApi.getEmpresaDeCliente,
      getDocumentoEmpresa,
      iniciarCotizacion, agregarPartida, finalizarCotizacion, cancelarCotizacion,
      getCotizaciones, getDetalleCotizacion,
      getPrecioVidrio, getPrecioProceso, getPrecioProcesoEspecial,
      iniciarCotizacionMaquila, agregarPartidaMaquila, eliminarPartidaMaquila,
      finalizarCotizacionMaquila, getTicketMaquila, getCotizacionesMaquila,
      getDetalleCotizacionMaquila, reabrirCotizacion, convertirMaquilaAPedido,
      getPedidosPendientesMaquila, getDetallePedidoMaquila,
      entregarPartidaMaquila, marcarAnticipoLiquidadoMaquila,
      getInventarioVidrio, registrarInventarioVidrio, ajustarInventario, getMovimientosInventario,
      getProductosGenerales, createProductoGeneral, updateProductoGeneral,
      recargar: loadAll,
    }}>
      {children}
    </CotizacionContext.Provider>
  )
}

export const useCotizacion = () => useContext(CotizacionContext)
