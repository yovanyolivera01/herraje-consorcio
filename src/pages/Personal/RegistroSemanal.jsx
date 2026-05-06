import { useState, useEffect, useCallback } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import {
  getOrCreateSemana, getRegistrosSemana, upsertRegistro, upsertResumen,
  calcularResumenSemanal, calcularDia,
  getLunesDeSemana, getLunesAnterior, getLunesSiguiente,
  getDiasDeSemana, minToHHMM,
} from '../../lib/personalApi'

// ── Helper: fecha de hoy (hora local, no UTC) ─────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Badge de estado ───────────────────────────────────────────
function EstadoBadge({ estado }) {
  if (estado === 'COMPLETO')         return <span className="p-badge p-badge-ok">✓ Completo</span>
  if (estado === 'SALIDA_PENDIENTE') return <span className="p-badge p-badge-warn">⚠ Pendiente</span>
  return <span className="p-badge p-badge-gray">Ausente</span>
}

// ── Fila de un día ────────────────────────────────────────────
function FilaDia({ dia, empId, semanaId, registro, onChange }) {
  const [entrada, setEntrada]   = useState(registro?.hora_entrada ?? '')
  const [salida,  setSalida]    = useState(registro?.hora_salida  ?? '')
  const [saving,  setSaving]    = useState(false)
  const [saved,   setSaved]     = useState(false)

  // Sync al montar (carga inicial) o cuando el empleado/semana cambian (via key prop).
  // NO sobreescribir si el usuario ya escribió algo en el campo.
  useEffect(() => {
    if (entrada === '') setEntrada(registro?.hora_entrada ?? '')
    if (salida  === '') setSalida(registro?.hora_salida  ?? '')
    setSaving(false)
    setSaved(false)
  }, [registro])

  const guardar = useCallback(async (nuevaEntrada, nuevaSalida) => {
    setSaving(true)
    setSaved(false)
    try {
      const reg = await upsertRegistro(empId, semanaId, dia.fecha, nuevaEntrada, nuevaSalida)
      onChange(reg)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // silencioso, el usuario puede reintentar
    } finally {
      setSaving(false)
    }
  }, [empId, semanaId, dia.fecha, onChange])

  const calc = calcularDia(entrada, salida, dia.nombreDia)

  const handleBlur = () => {
    const origEntrada = registro?.hora_entrada ?? ''
    const origSalida  = registro?.hora_salida  ?? ''
    if (entrada !== origEntrada || salida !== origSalida) {
      guardar(entrada, salida)
    }
  }

  return (
    <tr>
      <td data-label="Día" className="p-dia-col" translate="no">
        <span className="p-dia-nombre">{dia.nombreDia.slice(0, 3)}</span>
        <span className="p-dia-num">{dia.numeroDia}</span>
      </td>
      <td data-label="Entrada">
        <input
          type="time"
          className="p-time-input"
          value={entrada}
          onChange={e => setEntrada(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td data-label="Salida">
        <input
          type="time"
          className="p-time-input"
          value={salida}
          onChange={e => setSalida(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td data-label="Estado">
        <EstadoBadge estado={calc.estado} />
      </td>
      <td data-label="Horas" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {calc.minutosTrabajados !== null ? minToHHMM(calc.minutosTrabajados) : '—'}
      </td>
      <td data-label="Extra" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {calc.totalExtra > 0
          ? <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{minToHHMM(calc.totalExtra)}</span>
          : '—'
        }
      </td>
      <td style={{ width: 32, textAlign: 'center', fontSize: 13 }}>
        {saving && <span style={{ color: 'var(--text-muted)' }}>⟳</span>}
        {saved  && <span style={{ color: 'var(--success)'   }}>✓</span>}
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function RegistroSemanal() {
  const { empleados, cargando: cargandoEmpleados } = usePersonal()

  const [lunesFecha, setLunesFecha]         = useState(() => getLunesDeSemana(todayStr()))
  const [semana, setSemana]                 = useState(null)
  const [registros, setRegistros]           = useState([])
  const [cargandoSemana, setCargandoSemana] = useState(false)
  const [selectedEmpId, setSelectedEmpId]   = useState(null)
  const [toast, setToast]                   = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Cuando hay empleados y no hay uno seleccionado, seleccionar el primero
  useEffect(() => {
    if (empleados.length > 0 && selectedEmpId === null) {
      setSelectedEmpId(empleados[0].empleado_id)
    }
  }, [empleados, selectedEmpId])

  // Cargar / crear semana y sus registros cuando cambia el lunes
  useEffect(() => {
    async function cargar() {
      setCargandoSemana(true)
      try {
        const sem  = await getOrCreateSemana(lunesFecha)
        const regs = await getRegistrosSemana(sem.semana_id)
        setSemana(sem)
        setRegistros(regs)
      } catch (e) {
        showToast('Error al cargar la semana: ' + e.message, 'error')
      } finally {
        setCargandoSemana(false)
      }
    }
    cargar()
  }, [lunesFecha])

  const irAnterior  = () => setLunesFecha(prev => getLunesAnterior(prev))
  const irSiguiente = () => setLunesFecha(prev => getLunesSiguiente(prev))
  const irActual    = () => setLunesFecha(getLunesDeSemana(todayStr()))

  // Cuando un registro cambia (guardado), actualizar el estado local y el resumen
  const handleRegistroChange = useCallback(async (newReg) => {
    setRegistros(prev => {
      const existe = prev.find(r => r.empleado_id === newReg.empleado_id && r.fecha === newReg.fecha)
      return existe
        ? prev.map(r => (r.empleado_id === newReg.empleado_id && r.fecha === newReg.fecha) ? newReg : r)
        : [...prev, newReg]
    })

    // Recalcular y guardar resumen del empleado
    setRegistros(prev => {
      const empRegs = [...prev.filter(r => r.empleado_id === newReg.empleado_id)]
      const existe  = empRegs.find(r => r.fecha === newReg.fecha)
      const lista   = existe
        ? empRegs.map(r => r.fecha === newReg.fecha ? newReg : r)
        : [...empRegs, newReg]
      const resumen = calcularResumenSemanal(lista)
      if (semana) {
        upsertResumen(newReg.empleado_id, semana.semana_id, resumen).catch(() => {})
      }
      return prev // no cambiar aquí, ya se hizo arriba
    })
  }, [semana])

  const dias = getDiasDeSemana(lunesFecha)

  // Registros del empleado seleccionado
  const empRegistros = registros.filter(r => r.empleado_id === selectedEmpId)
  const resumen      = calcularResumenSemanal(empRegistros)
  const diferencia   = resumen.minutos_trabajados - resumen.minutos_esperados

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

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Registro Semanal</div>
          <div className="page-subtitle">Entrada y salida por día</div>
        </div>
      </div>

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        {/* Navegación de semana */}
        <div className="p-week-nav">
          <button className="btn btn-outline btn-sm" onClick={irAnterior}>← Anterior</button>
          <div className="p-week-title">
            {semana ? semana.descripcion : lunesFecha}
          </div>
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

        {cargandoSemana ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)' }}>Cargando registros…</p>
          </div>
        ) : (
          <>
            {/* Tabla de horarios */}
            <div className="table-container">
              <table className="table p-timesheet">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Estado</th>
                    <th>Horas</th>
                    <th>Extra</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map(dia => {
                    const reg = empRegistros.find(r => r.fecha === dia.fecha)
                    return (
                      <FilaDia
                        key={`${selectedEmpId}-${semana?.semana_id}-${dia.fecha}`}
                        dia={dia}
                        empId={selectedEmpId}
                        semanaId={semana?.semana_id}
                        registro={reg}
                        onChange={handleRegistroChange}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumen del empleado */}
            <div className="p-summary-card">
              <div className="p-summary-item">
                <span className="p-summary-label">Trabajadas</span>
                <span className="p-summary-val">{minToHHMM(resumen.minutos_trabajados)}</span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Esperadas</span>
                <span className="p-summary-val">{minToHHMM(resumen.minutos_esperados)}</span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Diferencia</span>
                <span
                  className="p-summary-val"
                  style={{ color: diferencia >= 0 ? 'var(--success)' : 'var(--danger)' }}
                >
                  {diferencia >= 0 ? '+' : '-'}{minToHHMM(diferencia)}
                </span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Horas extra</span>
                <span className="p-summary-val" style={{ color: resumen.minutos_extra > 0 ? 'var(--warning)' : undefined }}>
                  {minToHHMM(resumen.minutos_extra)}
                </span>
              </div>
              <div className="p-summary-item">
                <span className="p-summary-label">Bono puntualidad</span>
                <span className="p-summary-val">
                  {resumen.bono_puntualidad
                    ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Aplica</span>
                    : <span style={{ color: 'var(--danger)' }}>✗ No aplica</span>
                  }
                </span>
              </div>
              {resumen.motivo_bono && (
                <div className="p-summary-motivo">
                  {resumen.motivo_bono}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
