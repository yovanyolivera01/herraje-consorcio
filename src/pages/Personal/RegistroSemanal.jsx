import { useState, useEffect } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import TableRegistroTrabajador from '../../components/tableRegistroTrabajador'
import { getHorasEmpleado, minToHHMM } from '../../lib/calculosApi'
import {
  hoyLocal, getLunesDeSemana, getLunesAnterior, getLunesSiguiente,
  getDomingoDeSemana, descripcionSemana,
} from '../../lib/semana'

// ── Página principal ──────────────────────────────────────────
// Solo lectura: las 4 marcas del día (entrada, salida a comer, regreso y
// salida) las registra el reconocimiento facial; las horas se calculan en
// el backend (GET /api/calculos/horas/empleado/:id).
export default function RegistroSemanal() {
  const { empleados, cargando: cargandoEmpleados } = usePersonal()

  const [lunesFecha, setLunesFecha]       = useState(() => getLunesDeSemana(hoyLocal()))
  const [selectedEmpId, setSelectedEmpId] = useState(null)
  const [datos, setDatos]                 = useState(null)
  const [cargando, setCargando]           = useState(false)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    if (empleados.length > 0 && selectedEmpId === null) {
      setSelectedEmpId(empleados[0].empleado_id)
    }
  }, [empleados, selectedEmpId])

  useEffect(() => {
    if (selectedEmpId === null) return
    let cancelado = false
    setCargando(true)
    setError(null)
    getHorasEmpleado(selectedEmpId, lunesFecha, getDomingoDeSemana(lunesFecha))
      .then(d => { if (!cancelado) setDatos(d) })
      .catch(e => { if (!cancelado) { setDatos(null); setError(e.message) } })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [selectedEmpId, lunesFecha])

  const irAnterior  = () => setLunesFecha(prev => getLunesAnterior(prev))
  const irSiguiente = () => setLunesFecha(prev => getLunesSiguiente(prev))
  const irActual    = () => setLunesFecha(getLunesDeSemana(hoyLocal()))

  if (cargandoEmpleados) {
    return (
      <div className="page-body">
        <div className="empty-state"><p>Cargando empleados…</p></div>
      </div>
    )
  }

  if (empleados.length === 0) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <div className="empty-state-icon">👷</div>
          <h3>Sin empleados registrados</h3>
          <p>Primero da de alta empleados en la sección "Empleados".</p>
        </div>
      </div>
    )
  }

  const totales = datos?.totales

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Registro Semanal</div>
          <div className="page-subtitle">Entrada, comida y salida por día</div>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">Error al cargar: {error}</div>}

        {/* Navegación de semana */}
        <div className="p-week-nav">
          <button className="btn btn-outline btn-sm" onClick={irAnterior}>← Anterior</button>
          <div className="p-week-title">{descripcionSemana(lunesFecha)}</div>
          <button className="btn btn-outline btn-sm" onClick={irSiguiente}>Siguiente →</button>
          <button className="btn btn-outline btn-sm" onClick={irActual} title="Ir a la semana actual">
            Hoy
          </button>
        </div>

        {/* Tabs de empleados */}
        <div className="p-emp-tabs">
          {empleados.map(emp => (
            <button
              key={emp.empleado_id}
              className={`p-emp-tab${selectedEmpId === emp.empleado_id ? ' active' : ''}`}
              onClick={() => setSelectedEmpId(emp.empleado_id)}
            >
              {emp.nombre}
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)' }}>Cargando registros…</p>
          </div>
        ) : datos && (
          <>
            <TableRegistroTrabajador dias={datos.dias} />

            {/* Resumen del empleado */}
            <div className="p-summary-card">
              <div className="p-summary-item">
                <span className="p-summary-label">Trabajadas</span>
                <span className="p-summary-val">{minToHHMM(totales.minutos_trabajados)}</span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Esperadas</span>
                <span className="p-summary-val">{minToHHMM(totales.minutos_programados)}</span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Diferencia</span>
                <span
                  className="p-summary-val"
                  style={{ color: totales.minutos_diferencia >= 0 ? 'var(--success)' : 'var(--danger)' }}
                >
                  {totales.minutos_diferencia >= 0 ? '+' : ''}{minToHHMM(totales.minutos_diferencia)}
                </span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Horas extra</span>
                <span className="p-summary-val" style={{ color: totales.minutos_extra > 0 ? 'var(--warning)' : undefined }}>
                  {minToHHMM(totales.minutos_extra)}
                </span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Bono puntualidad</span>
                <span className="p-summary-val">
                  {totales.bono_puntualidad
                    ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Aplica</span>
                    : <span style={{ color: 'var(--danger)' }}>✗ No aplica</span>}
                </span>
              </div>
              {totales.motivo_bono && <div className="p-summary-motivo">{totales.motivo_bono}</div>}
            </div>
          </>
        )}
      </div>
    </>
  )
}
