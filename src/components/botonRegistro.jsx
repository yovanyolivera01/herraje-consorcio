import { useState, useEffect, useCallback } from 'react'
import { hoyMX } from '../lib/utils'
import { getRegistroHoy, registroCheckIn, registroCheckOut } from '../lib/registro'

const TZ_MX = 'America/Mexico_City'

// Hora actual en zona horaria de México, formato HH:mm:ss (compatible con
// la columna TIME de la tabla registro).
function horaActualMX() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_MX, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
}

export default function BotonRegistro({ id_empleado, id_turno }) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      {!registro ? (
        <button className="btn btn-primary" onClick={handleEntrada} disabled={working}>
          {working ? 'Registrando...' : '🟢 Registrar entrada'}
        </button>
      ) : !registro.hora_salida ? (
        <button className="btn btn-outline" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={handleSalida} disabled={working}>
          {working ? 'Registrando...' : '🔴 Registrar salida'}
        </button>
      ) : (
        <span className="badge badge-blue">
          ✅ Entrada {registro.hora_llegada} · Salida {registro.hora_salida}
        </span>
      )}
      {error && <div className="form-error">❌ {error}</div>}
    </div>
  )
}
