import { useState, useEffect } from 'react'
import TableRegistroTrabajador from './tableRegistroTrabajador'
import { getHorasEmpleado } from '../lib/calculosApi'
import { getDomingoDeSemana, descripcionSemana } from '../lib/semana'

// Modal con los registros día por día de UN empleado en una semana (lunes a
// domingo): 4 marcas + cálculos, con fila de totales. Los datos vienen de
// GET /api/calculos/horas/empleado/:id.
export default function ModalRegistrosEmpleado({ empleado, lunes, onClose }) {
  const [dias, setDias]         = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    getHorasEmpleado(empleado.empleado_id, lunes, getDomingoDeSemana(lunes))
      .then(d => { if (!cancelado) setDias(d.dias) })
      .catch(e => { if (!cancelado) setError(e.message) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [empleado.empleado_id, lunes])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 1100 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Registros · {empleado.nombre}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{descripcionSemana(lunes)}</p>

          {error && <div className="alert alert-error">Error al cargar: {error}</div>}

          {cargando
            ? <p style={{ color: 'var(--text-muted)' }}>Cargando registros…</p>
            : !error && <TableRegistroTrabajador dias={dias} />}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
