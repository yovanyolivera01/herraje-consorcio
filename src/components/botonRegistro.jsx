import { useState, useEffect, useCallback } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { hoyMX, horaActualMX } from '../lib/utils'
import { getRegistroHoy, registroCheckIn, registroCheckOut } from '../lib/registro'

// compact: reduce el botón a un tamaño de sidebar/menú — el estilo .btn
// global (font-size 17px, padding 10px 20px) está pensado para el cuerpo
// de una página, no para un espacio angosto como el menú lateral.
export default function BotonRegistro({ id_empleado, id_turno, compact = false }) {
  const [registro, setRegistro] = useState(null) // null = sin marcar entrada hoy
  const [loading,  setLoading]  = useState(true)
  const [working,  setWorking]  = useState(false)
  const [error,    setError]    = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRegistroHoy(id_empleado)
      setRegistro(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id_empleado])

  useEffect(() => { if (id_empleado) cargar() }, [id_empleado, cargar])

  const handleEntrada = async () => {
    setWorking(true)
    setError(null)
    try {
      const nuevo = await registroCheckIn({
        id_empleado,
        id_turno,
        fecha:        hoyMX(),
        hora_entrada: horaActualMX(),
        created_at:   new Date().toISOString(),
      })
      setRegistro(nuevo)
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  const handleSalida = async () => {
    setWorking(true)
    setError(null)
    try {
      const actualizado = await registroCheckOut(registro.id_registro, horaActualMX())
      setRegistro(actualizado)
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  if (!id_empleado) return null

  if (loading) {
    return <button className="btn btn-outline" disabled>Cargando...</button>
  }

  const tamano = compact
    ? { width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 13 }
    : {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: compact ? 'stretch' : 'flex-start' }}>
      {!registro ? (
        <button
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...tamano }}
          onClick={handleEntrada}
          disabled={working}
        >
          <LogIn size={compact ? 14 : 16} />
          {working ? 'Registrando...' : 'Registrar entrada'}
        </button>
      ) : !registro.hora_salida ? (
        <button
          className="btn btn-outline"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            color: '#dc2626', borderColor: '#dc2626', ...tamano,
          }}
          onClick={handleSalida}
          disabled={working}
        >
          <LogOut size={compact ? 14 : 16} />
          {working ? 'Registrando...' : 'Registrar salida'}
        </button>
      ) : (
        <span className="badge badge-blue" style={compact ? { fontSize: 12, textAlign: 'center' } : undefined}>
          ✅ Entrada {registro.hora_llegada} · Salida {registro.hora_salida}
        </span>
      )}
      {error && <div className="form-error" style={compact ? { fontSize: 12 } : undefined}>❌ {error}</div>}
    </div>
  )
}
