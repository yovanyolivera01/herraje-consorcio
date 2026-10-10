import { useState, useEffect } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import ModalRegistrosDia from '../../components/modalRegistrosDia'
import ModalRegistrosEmpleado from '../../components/modalRegistrosEmpleado'
import { getResumenHoras, getHorasEmpleado, minToHHMM, horaCorta } from '../../lib/calculosApi'
import {
  hoyLocal, getLunesDeSemana, getLunesAnterior, getLunesSiguiente,
  getDomingoDeSemana, descripcionSemana, getNombreDia,
} from '../../lib/semana'

const MESES = ['enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre']

const ESTADO_TEXTO = {
  completo: 'Completo', en_curso: 'En curso', en_comida: 'En comida',
  falta: 'Falta', pendiente: 'Pendiente', descanso: 'Descanso',
}

const tabular = { fontVariantNumeric: 'tabular-nums' }

// Valor resaltado con color si es > 0; si no, un guion atenuado.
function Resaltado({ valor, texto, color }) {
  return valor > 0
    ? <span style={{ color, fontWeight: 600 }}>{texto}</span>
    : <span style={{ color: 'var(--text-muted)' }}>—</span>
}

// ── Genera y descarga el CSV ──────────────────────────────────
// El detalle por día se pide al backend por empleado; los totales ya vienen
// en `resumenes`.
async function descargarCSV(lunes, empleados, resumenes) {
  const domingo = getDomingoDeSemana(lunes)
  const lineas = []
  lineas.push(`"REPORTE SEMANAL - ${descripcionSemana(lunes)}"`)
  lineas.push('')
  lineas.push('"Empleado","Teléfono","Día","Fecha","Entrada","Salida a comer","Regreso","Salida","Estado","Horas trabajadas","Horas extra","Retardo (min)"')

  for (const emp of empleados) {
    const { dias } = await getHorasEmpleado(emp.empleado_id, lunes, domingo)

    for (const dia of dias) {
      const d = new Date(dia.fecha + 'T12:00:00')
      lineas.push([
        `"${emp.nombre}"`,
        `"${emp.telefono ?? ''}"`,
        `"${getNombreDia(dia.fecha)}"`,
        `"${d.getDate()} de ${MESES[d.getMonth()]}"`,
        `"${dia.marcas ? horaCorta(dia.marcas.entrada) : ''}"`,
        `"${dia.marcas ? horaCorta(dia.marcas.salida_comida) : ''}"`,
        `"${dia.marcas ? horaCorta(dia.marcas.regreso_comida) : ''}"`,
        `"${dia.marcas ? horaCorta(dia.marcas.salida) : ''}"`,
        `"${ESTADO_TEXTO[dia.estado] ?? dia.estado}"`,
        `"${dia.estado === 'completo' ? minToHHMM(dia.minutos_trabajados) : ''}"`,
        `"${dia.minutos_extra > 0 ? minToHHMM(dia.minutos_extra) : ''}"`,
        `"${dia.es_retardo ? dia.retardo_minutos : ''}"`,
      ].join(','))
    }

    const res = resumenes[emp.empleado_id]
    if (res) {
      const dif = res.minutos_diferencia
      const vacio = '"—"'
      lineas.push([
        `"${emp.nombre} — TOTAL"`, `"${emp.telefono ?? ''}"`, vacio, vacio, vacio, vacio, vacio, vacio,
        `"Completos ${res.dias_completos}/${res.dias_laborales} · Faltas ${res.faltas}"`,
        `"${minToHHMM(res.minutos_trabajados)} / ${minToHHMM(res.minutos_programados)} (${dif >= 0 ? '+' : ''}${minToHHMM(dif)})"`,
        `"${minToHHMM(res.minutos_extra)}"`,
        `"${res.retardos} (${res.minutos_retardo} min)"`,
      ].join(','))
      lineas.push([
        `"${emp.nombre} — OTROS"`, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
        `"Faltantes ${minToHHMM(res.minutos_faltantes)} · Salidas anticipadas ${res.salidas_anticipadas} (${res.minutos_salida_anticipada} min)"`,
        `"Comida ${minToHHMM(res.minutos_comida)} · Exceso ${minToHHMM(res.minutos_exceso_comida)}"`,
        vacio, vacio,
      ].join(','))
      lineas.push([
        `"${emp.nombre} — BONO"`,
        vacio, vacio, vacio, vacio, vacio, vacio, vacio,
        `"${res.bono_puntualidad ? 'APLICA' : 'NO APLICA'}"`,
        `"${res.motivo_bono ?? ''}"`, vacio, vacio,
      ].join(','))
    }
    lineas.push('')
  }

  const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `reporte-${lunes}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Página principal ──────────────────────────────────────────
// Los totales se calculan en el backend (GET /api/calculos/horas/resumen).
export default function ResumenSemanal() {
  const { empleados, cargando: cargandoEmpleados } = usePersonal()

  const [lunesFecha, setLunesFecha] = useState(() => getLunesDeSemana(hoyLocal()))
  const [resumenes, setResumenes]   = useState({})   // { empleado_id: totales }
  const [cargando, setCargando]     = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [toast, setToast]           = useState(null)
  const [verDia, setVerDia]         = useState(false)
  const [empleadoSel, setEmpleadoSel] = useState(null) // empleado cuyo detalle se está viendo

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const cargar = async () => {
    setCargando(true)
    try {
      const filas = await getResumenHoras(lunesFecha, getDomingoDeSemana(lunesFecha))
      setResumenes(Object.fromEntries(filas.map(f => [f.empleado_id, f])))
    } catch (e) {
      showToast('Error al cargar: ' + e.message, 'error')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [lunesFecha])

  const irAnterior  = () => setLunesFecha(p => getLunesAnterior(p))
  const irSiguiente = () => setLunesFecha(p => getLunesSiguiente(p))
  const irActual    = () => setLunesFecha(getLunesDeSemana(hoyLocal()))

  const handleDescargar = async () => {
    setDescargando(true)
    try {
      await descargarCSV(lunesFecha, empleados, resumenes)
    } catch (e) {
      showToast('Error al descargar: ' + e.message, 'error')
    } finally {
      setDescargando(false)
    }
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
          <button className="btn btn-outline" onClick={() => setVerDia(true)}>
            📅 Registros por día
          </button>
          <button className="btn btn-outline" onClick={cargar} disabled={cargando}>
            {cargando ? 'Calculando…' : '↻ Actualizar resumen'}
          </button>
          <button className="btn btn-primary" onClick={handleDescargar} disabled={cargando || descargando}>
            {descargando ? 'Generando…' : '⬇ Descargar CSV'}
          </button>
        </div>
      </div>

      {verDia && <ModalRegistrosDia onClose={() => setVerDia(false)} />}
      {empleadoSel && (
        <ModalRegistrosEmpleado empleado={empleadoSel} lunes={lunesFecha} onClose={() => setEmpleadoSel(null)} />
      )}

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        {/* Navegación de semana */}
        <div className="p-week-nav">
          <button className="btn btn-outline btn-sm" onClick={irAnterior}>← Anterior</button>
          <div className="p-week-title">{descripcionSemana(lunesFecha)}</div>
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
                  <th>Faltas</th>
                  <th>Trabajadas</th>
                  <th>Esperadas</th>
                  <th>Diferencia</th>
                  <th>Extra</th>
                  <th>Faltantes</th>
                  <th>Retardos</th>
                  <th>Salidas anticipadas</th>
                  <th>Comida</th>
                  <th>Exceso comida</th>
                  <th>Bono puntualidad</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map(emp => {
                  const res = resumenes[emp.empleado_id]
                  if (!res) return (
                    <tr key={emp.empleado_id}>
                      <td data-label="Empleado" style={{ fontWeight: 500 }}>{emp.nombre}</td>
                      <td colSpan={12} style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        Sin turno asignado
                      </td>
                    </tr>
                  )

                  return (
                    <tr
                      key={emp.empleado_id}
                      onClick={() => setEmpleadoSel(emp)}
                      style={{ cursor: 'pointer' }}
                      title="Ver registros por día"
                    >
                      <td data-label="Empleado" style={{ fontWeight: 500, color: 'var(--accent)' }}>{emp.nombre}</td>
                      <td data-label="Días completos">
                        <span className="badge badge-blue">{res.dias_completos} / {res.dias_laborales}</span>
                      </td>
                      <td data-label="Faltas">
                        <Resaltado valor={res.faltas} texto={res.faltas} color="var(--danger)" />
                      </td>
                      <td data-label="Trabajadas" style={tabular}>{minToHHMM(res.minutos_trabajados)}</td>
                      <td data-label="Esperadas" style={{ ...tabular, color: 'var(--text-muted)' }}>
                        {minToHHMM(res.minutos_programados)}
                      </td>
                      <td data-label="Diferencia" style={tabular}>
                        <span style={{ color: res.minutos_diferencia >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {res.minutos_diferencia >= 0 ? '+' : ''}{minToHHMM(res.minutos_diferencia)}
                        </span>
                      </td>
                      <td data-label="Extra" style={tabular}>
                        <Resaltado valor={res.minutos_extra} texto={minToHHMM(res.minutos_extra)} color="var(--warning)" />
                      </td>
                      <td data-label="Faltantes" style={tabular}>
                        <Resaltado valor={res.minutos_faltantes} texto={minToHHMM(res.minutos_faltantes)} color="var(--danger)" />
                      </td>
                      <td data-label="Retardos" style={tabular}>
                        <Resaltado valor={res.retardos} texto={`${res.retardos} (${res.minutos_retardo} min)`} color="var(--danger)" />
                      </td>
                      <td data-label="Salidas anticipadas" style={tabular}>
                        <Resaltado
                          valor={res.salidas_anticipadas}
                          texto={`${res.salidas_anticipadas} (${res.minutos_salida_anticipada} min)`}
                          color="var(--danger)"
                        />
                      </td>
                      <td data-label="Comida" style={tabular}>
                        {res.minutos_comida > 0 ? minToHHMM(res.minutos_comida) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td data-label="Exceso comida" style={tabular}>
                        <Resaltado valor={res.minutos_exceso_comida} texto={minToHHMM(res.minutos_exceso_comida)} color="var(--warning)" />
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
                          )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          * Las horas esperadas dependen del turno de cada empleado (horario menos tiempo de comida)
          y solo cuentan los días laborales que ya transcurrieron.
        </p>
      </div>
    </>
  )
}
