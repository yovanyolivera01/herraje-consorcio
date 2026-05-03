import { useState, useEffect } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import {
  getOrCreateSemana, getRegistrosSemana, upsertResumen,
  calcularResumenSemanal, calcularDia,
  getLunesDeSemana, getLunesAnterior, getLunesSiguiente,
  getDiasDeSemana, minToHHMM,
} from '../../lib/personalApi'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Genera y descarga el CSV ──────────────────────────────────
function descargarCSV(semana, empleados, registrosPorEmp, resumenesPorEmp) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre']

  const lineas = []
  lineas.push(`"REPORTE SEMANAL - ${semana.descripcion}"`)
  lineas.push('')
  lineas.push('"Empleado","Teléfono","Día","Fecha","Entrada","Salida","Estado","Horas trabajadas","Horas extra"')

  for (const emp of empleados) {
    const regs    = registrosPorEmp[emp.empleado_id] ?? []
    const dias    = getDiasDeSemana(semana.fecha_inicio)
    const resumen = resumenesPorEmp[emp.empleado_id]

    for (const dia of dias) {
      const reg = regs.find(r => r.fecha === dia.fecha)
      const calc = calcularDia(reg?.hora_entrada, reg?.hora_salida, dia.nombreDia)

      const estado = {
        COMPLETO:         'Completo',
        SALIDA_PENDIENTE: 'Salida pendiente',
        AUSENTE:          'Ausente',
      }[calc.estado]

      const d = new Date(dia.fecha + 'T12:00:00')
      const fechaLegible = `${d.getDate()} de ${meses[d.getMonth()]}`

      lineas.push([
        `"${emp.nombre}"`,
        `"${emp.telefono}"`,
        `"${dia.nombreDia}"`,
        `"${fechaLegible}"`,
        `"${reg?.hora_entrada ?? ''}"`,
        `"${reg?.hora_salida  ?? ''}"`,
        `"${estado}"`,
        `"${calc.minutosTrabajados !== null ? minToHHMM(calc.minutosTrabajados) : ''}"`,
        `"${calc.totalExtra > 0 ? minToHHMM(calc.totalExtra) : ''}"`,
      ].join(','))
    }

    // Fila de totales del empleado
    if (resumen) {
      const dif = resumen.minutos_trabajados - resumen.minutos_esperados
      lineas.push([
        `"${emp.nombre} — TOTAL"`,
        `"${emp.telefono}"`,
        '"—"',
        '"—"',
        '"—"',
        '"—"',
        `"Días completos: ${resumen.dias_con_registro_completo}"`,
        `"${minToHHMM(resumen.minutos_trabajados)} / ${minToHHMM(resumen.minutos_esperados)} (${dif >= 0 ? '+' : '-'}${minToHHMM(dif)})"`,
        `"${minToHHMM(resumen.minutos_extra)}"`,
      ].join(','))
      lineas.push([
        `"${emp.nombre} — BONO"`,
        '"—"', '"—"', '"—"', '"—"', '"—"',
        `"${resumen.bono_puntualidad ? 'APLICA' : 'NO APLICA'}"`,
        `"${resumen.motivo_bono ?? ''}"`,
        '"—"',
      ].join(','))
    }
    lineas.push('')
  }

  const csv  = lineas.join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `reporte-${semana.fecha_inicio}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Página principal ──────────────────────────────────────────
export default function ResumenSemanal() {
  const { empleados, cargando: cargandoEmpleados } = usePersonal()

  const [lunesFecha, setLunesFecha]         = useState(() => getLunesDeSemana(todayStr()))
  const [semana, setSemana]                 = useState(null)
  const [registros, setRegistros]           = useState([])
  const [resumenes, setResumenes]           = useState({})   // { empId: resumenObj }
  const [cargando, setCargando]             = useState(false)
  const [calculando, setCalculando]         = useState(false)
  const [toast, setToast]                   = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      try {
        const sem  = await getOrCreateSemana(lunesFecha)
        const regs = await getRegistrosSemana(sem.semana_id)
        setSemana(sem)
        setRegistros(regs)

        // Calcular resúmenes localmente desde los registros
        const mapa = {}
        for (const emp of empleados) {
          const empRegs = regs.filter(r => r.empleado_id === emp.empleado_id)
          mapa[emp.empleado_id] = calcularResumenSemanal(empRegs)
        }
        setResumenes(mapa)
      } catch (e) {
        showToast('Error al cargar: ' + e.message, 'error')
      } finally {
        setCargando(false)
      }
    }
    if (empleados.length > 0) cargar()
  }, [lunesFecha, empleados])

  const irAnterior  = () => setLunesFecha(p => getLunesAnterior(p))
  const irSiguiente = () => setLunesFecha(p => getLunesSiguiente(p))
  const irActual    = () => setLunesFecha(getLunesDeSemana(todayStr()))

  const handleCalcular = async () => {
    if (!semana) return
    setCalculando(true)
    try {
      const mapa = {}
      for (const emp of empleados) {
        const empRegs = registros.filter(r => r.empleado_id === emp.empleado_id)
        const res     = calcularResumenSemanal(empRegs)
        await upsertResumen(emp.empleado_id, semana.semana_id, res)
        mapa[emp.empleado_id] = res
      }
      setResumenes(mapa)
      showToast('Resumen actualizado correctamente ✅')
    } catch (e) {
      showToast('Error al calcular: ' + e.message, 'error')
    } finally {
      setCalculando(false)
    }
  }

  const handleDescargar = () => {
    if (!semana) return
    const regPorEmp = {}
    for (const emp of empleados) {
      regPorEmp[emp.empleado_id] = registros.filter(r => r.empleado_id === emp.empleado_id)
    }
    descargarCSV(semana, empleados, regPorEmp, resumenes)
  }

  if (cargandoEmpleados) {
    return <div className="page-body"><div className="empty-state"><p>Cargando…</p></div></div>
  }

  if (empleados.length === 0) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
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
          <div className="page-title">Resumen Semanal</div>
          <div className="page-subtitle">Totales, horas extra y bono de puntualidad</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-outline"
            onClick={handleCalcular}
            disabled={calculando || cargando}
          >
            {calculando ? 'Calculando…' : '↻ Actualizar resumen'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDescargar}
            disabled={cargando || !semana}
          >
            ⬇ Descargar CSV
          </button>
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
          <button className="btn btn-outline btn-sm" onClick={irActual}>Hoy</button>
        </div>

        {cargando ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)' }}>Cargando registros…</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Días completos</th>
                  <th>Trabajadas</th>
                  <th>Esperadas</th>
                  <th>Diferencia</th>
                  <th>Extra</th>
                  <th>Bono puntualidad</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map(emp => {
                  const res = resumenes[emp.empleado_id]
                  if (!res) return (
                    <tr key={emp.empleado_id}>
                      <td data-label="Empleado" style={{ fontWeight: 500 }}>{emp.nombre}</td>
                      <td colSpan={6} style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        Sin datos — haz clic en "Actualizar resumen"
                      </td>
                    </tr>
                  )

                  const dif = res.minutos_trabajados - res.minutos_esperados
                  return (
                    <tr key={emp.empleado_id}>
                      <td data-label="Empleado" style={{ fontWeight: 500 }}>{emp.nombre}</td>
                      <td data-label="Días completos">
                        <span className="badge badge-blue">{res.dias_con_registro_completo} / 6</span>
                      </td>
                      <td data-label="Trabajadas" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {minToHHMM(res.minutos_trabajados)}
                      </td>
                      <td data-label="Esperadas" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                        {minToHHMM(res.minutos_esperados)}
                      </td>
                      <td data-label="Diferencia" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ color: dif >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {dif >= 0 ? '+' : '-'}{minToHHMM(dif)}
                        </span>
                      </td>
                      <td data-label="Extra" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {res.minutos_extra > 0
                          ? <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{minToHHMM(res.minutos_extra)}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                      <td data-label="Bono">
                        {res.bono_puntualidad
                          ? <span className="p-badge p-badge-ok">✓ Aplica</span>
                          : (
                            <span title={res.motivo_bono ?? ''}>
                              <span className="p-badge p-badge-no">✗ No</span>
                              {res.motivo_bono && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {res.motivo_bono}
                                </div>
                              )}
                            </span>
                          )
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          * Semana completa esperada: 57 h 30 min (Lun–Vie 10 h/día + Sáb 7.5 h)
        </p>
      </div>
    </>
  )
}
