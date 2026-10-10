import { useState, useEffect } from 'react'
import { EstadoBadge } from './tableRegistroTrabajador'
import { getHorasDia, minToHHMM, horaCorta } from '../lib/calculosApi'
import { hoyLocal, getNombreDia } from '../lib/semana'

const tabular = { fontVariantNumeric: 'tabular-nums' }

// Minutos como HH:MM, o '—' si es 0 / no hay dato.
const hhmm = (min) => (min ? minToHHMM(min) : '—')

function sumarDia(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Modal para ver los registros de UN día de todos los empleados: sus 4
// marcas (entrada, salida a comer, regreso, salida) y lo calculado por el
// backend (GET /api/calculos/horas/dia). Se puede cambiar de día sin cerrar.
export default function ModalRegistrosDia({ fechaInicial, onClose }) {
  const [fecha, setFecha]       = useState(fechaInicial ?? hoyLocal())
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    getHorasDia(fecha)
      .then(r => { if (!cancelado) setRegistros(r) })
      .catch(e => { if (!cancelado) { setRegistros([]); setError(e.message) } })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [fecha])

  const conRegistro = registros.filter(r => r.marcas).length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 1000 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Registros del día · {getNombreDia(fecha)} {fecha}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Selector de día */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setFecha(f => sumarDia(f, -1))}>← Anterior</button>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={fecha}
              max={hoyLocal()}
              onChange={e => e.target.value && setFecha(e.target.value)}
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setFecha(f => sumarDia(f, 1))}
              disabled={fecha >= hoyLocal()}
            >
              Siguiente →
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setFecha(hoyLocal())}>Hoy</button>
            {!cargando && !error && (
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                {conRegistro} de {registros.length} empleados con registro
              </span>
            )}
          </div>

          {error && <div className="alert alert-error">Error al cargar: {error}</div>}

          {cargando ? (
            <p style={{ color: 'var(--text-muted)' }}>Cargando registros…</p>
          ) : registros.length === 0 && !error ? (
            <p style={{ color: 'var(--text-muted)' }}>No hay empleados con turno asignado.</p>
          ) : (
            <div className="table-container">
              <table className="table table-mobile-cards">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Entrada</th>
                    <th>Salida a comer</th>
                    <th>Regreso</th>
                    <th>Salida</th>
                    <th>Estado</th>
                    <th>Trabajadas</th>
                    <th>Comida</th>
                    <th>Extra</th>
                    <th>Faltantes</th>
                    <th>Retardo</th>
                    <th>Salida anticipada</th>
                    <th>Exceso comida</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map(r => (
                    <tr key={r.empleado_id}>
                      <td data-label="Empleado" style={{ fontWeight: 500 }}>
                        {r.nombre}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Turno {horaCorta(r.hora_inicio)} – {horaCorta(r.hora_fin)}
                        </div>
                      </td>
                      <td data-label="Entrada" style={tabular}>{horaCorta(r.marcas?.entrada)}</td>
                      <td data-label="Salida a comer" style={tabular}>{horaCorta(r.marcas?.salida_comida)}</td>
                      <td data-label="Regreso" style={tabular}>{horaCorta(r.marcas?.regreso_comida)}</td>
                      <td data-label="Salida" style={tabular}>{horaCorta(r.marcas?.salida)}</td>
                      <td data-label="Estado"><EstadoBadge estado={r.estado} /></td>
                      <td data-label="Trabajadas" style={tabular}>
                        {r.estado === 'completo' ? minToHHMM(r.minutos_trabajados) : '—'}
                      </td>
                      <td data-label="Comida" style={tabular}>{hhmm(r.minutos_comida)}</td>
                      <td data-label="Extra" style={{ ...tabular, color: r.minutos_extra > 0 ? 'var(--warning)' : undefined }}>
                        {hhmm(r.minutos_extra)}
                      </td>
                      <td data-label="Faltantes" style={{ ...tabular, color: r.minutos_faltantes > 0 ? 'var(--danger)' : undefined }}>
                        {r.estado === 'falta' || r.estado === 'completo' ? hhmm(r.minutos_faltantes) : '—'}
                      </td>
                      <td data-label="Retardo" style={tabular}>
                        {r.es_retardo
                          ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{r.retardo_minutos} min</span>
                          : '—'}
                      </td>
                      <td data-label="Salida anticipada" style={{ ...tabular, color: r.salida_anticipada_min > 0 ? 'var(--danger)' : undefined }}>
                        {hhmm(r.salida_anticipada_min)}
                      </td>
                      <td data-label="Exceso comida" style={{ ...tabular, color: r.exceso_comida_min > 0 ? 'var(--warning)' : undefined }}>
                        {hhmm(r.exceso_comida_min)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
