import { useState, useEffect } from 'react'
import { getEmpleadoInfo } from '../lib/empleado'
import { descripcionTurno } from '../lib/turno'

const dinero = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Dato({ etiqueta, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{etiqueta}</div>
      <div style={{ fontWeight: 500 }}>{children || '—'}</div>
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 8px', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>{titulo}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 16px' }}>
        {children}
      </div>
    </div>
  )
}

// Modal de solo lectura con la información completa de un empleado:
// datos personales, dirección, puesto y turno. Los datos vienen de la vista
// v_empleado_info (GET /api/personal/empleados/:id/info).
export default function ModalInfoEmpleado({ empleado, onClose }) {
  const [info, setInfo]         = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    let cancelado = false
    getEmpleadoInfo(empleado.empleado_id)
      .then(d => { if (!cancelado) setInfo(d) })
      .catch(e => { if (!cancelado) setError(e.message) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [empleado.empleado_id])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Información del empleado</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {cargando && <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>}
          {error && <div className="alert alert-error">Error al cargar: {error}</div>}

          {info && (
            <>
              <Seccion titulo="Datos personales">
                <Dato etiqueta="Nombre">{info.nombre_completo}</Dato>
                <Dato etiqueta="Teléfono">{info.telefono}</Dato>
                <Dato etiqueta="Fecha de registro">{info.fecha_registro}</Dato>
                <Dato etiqueta="Estado">{info.estado}</Dato>
                <Dato etiqueta="Rostro registrado">{info.tiene_rostro ? 'Sí' : 'No'}</Dato>
              </Seccion>

              <Seccion titulo="Dirección">
                <Dato etiqueta="Calle">{info.calle}</Dato>
                <Dato etiqueta="Colonia">{info.colonia}</Dato>
                <Dato etiqueta="Ciudad">{info.ciudad}</Dato>
                <Dato etiqueta="Código postal">{info.cp}</Dato>
              </Seccion>

              <Seccion titulo="Puesto">
                <Dato etiqueta="Puesto">{info.puesto}</Dato>
                <Dato etiqueta="Sueldo (semana laboral)">{info.sueldo_puesto != null && dinero(info.sueldo_puesto)}</Dato>
                <Dato etiqueta="Pago por hora extra">{info.tarifa_hora_extra != null && dinero(info.tarifa_hora_extra)}</Dato>
              </Seccion>

              <Seccion titulo="Turno">
                {info.id_turno ? (
                  <>
                    <Dato etiqueta="Horario">{descripcionTurno(info)}</Dato>
                    <Dato etiqueta="Tolerancia">{`${info.tolerancia} min`}</Dato>
                    <Dato etiqueta="Comida">{`${info.minutos_comida ?? 60} min`}</Dato>
                  </>
                ) : (
                  <Dato etiqueta="Horario">Sin turno asignado</Dato>
                )}
              </Seccion>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
