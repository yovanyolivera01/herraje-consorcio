import { minToHHMM, horaCorta } from '../lib/calculosApi'
import { getNombreDia, getNumeroDia } from '../lib/semana'

const ESTADOS = {
  completo:  { clase: 'p-badge-ok',   texto: '✓ Completo' },
  en_curso:  { clase: 'p-badge-warn', texto: '⚠ En curso' },
  en_comida: { clase: 'p-badge-warn', texto: '🍽 En comida' },
  falta:     { clase: 'p-badge-no',   texto: '✗ Falta' },
  pendiente: { clase: 'p-badge-gray', texto: 'Pendiente' },
  descanso:  { clase: 'p-badge-gray', texto: 'Descanso' },
}

export function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] ?? ESTADOS.pendiente
  return <span className={`p-badge ${e.clase}`}>{e.texto}</span>
}

const tabular = { fontVariantNumeric: 'tabular-nums' }

const sumar = (dias, campo) => dias.reduce((acc, d) => acc + (d[campo] ?? 0), 0)

// Minutos como HH:MM, o '—' si no hay nada que mostrar (0 o sin dato).
const hhmm = (min) => (min ? minToHHMM(min) : '—')

// Minutos resaltados con un color cuando son > 0 (retardo, extra, etc.).
function Resaltado({ minutos, color, formato = hhmm }) {
  return minutos > 0
    ? <span style={{ color, fontWeight: 600 }}>{formato(minutos)}</span>
    : '—'
}

// Tabla de registros de un trabajador: una fila por día con sus 4 marcas
// (entrada, salida a comer, regreso, salida) y lo calculado por el backend.
// `dias` es el arreglo `dias` de GET /api/calculos/horas/empleado/:id; con
// él se calcula también la fila de totales.
export default function TableRegistroTrabajador({ dias }) {
  const cerrados = dias.filter(d => d.estado === 'completo')
  const retardos = dias.filter(d => d.es_retardo).length

  return (
    <div className="table-container">
      <table className="table p-timesheet">
        <thead>
          <tr>
            <th>Día</th>
            <th>Entrada</th>
            <th>Salida a comer</th>
            <th>Regreso</th>
            <th>Salida</th>
            <th>Estado</th>
            <th>Programadas</th>
            <th>Comida</th>
            <th>Trabajadas</th>
            <th>Extra</th>
            <th>Faltantes</th>
            <th>Retardo</th>
            <th>Salida anticipada</th>
            <th>Exceso comida</th>
          </tr>
        </thead>
        <tbody>
          {dias.map(dia => (
            <tr key={dia.fecha}>
              <td data-label="Día" className="p-dia-col" translate="no">
                <span className="p-dia-nombre">{getNombreDia(dia.fecha).slice(0, 3)}</span>
                <span className="p-dia-num">{getNumeroDia(dia.fecha)}</span>
              </td>
              <td data-label="Entrada" style={tabular}>{horaCorta(dia.marcas?.entrada)}</td>
              <td data-label="Salida a comer" style={tabular}>{horaCorta(dia.marcas?.salida_comida)}</td>
              <td data-label="Regreso" style={tabular}>{horaCorta(dia.marcas?.regreso_comida)}</td>
              <td data-label="Salida" style={tabular}>{horaCorta(dia.marcas?.salida)}</td>
              <td data-label="Estado"><EstadoBadge estado={dia.estado} /></td>
              <td data-label="Programadas" style={tabular}>{hhmm(dia.minutos_programados)}</td>
              <td data-label="Comida" style={tabular}>{hhmm(dia.minutos_comida)}</td>
              <td data-label="Trabajadas" style={tabular}>
                {dia.estado === 'completo' ? minToHHMM(dia.minutos_trabajados) : '—'}
              </td>
              <td data-label="Extra" style={tabular}>
                <Resaltado minutos={dia.minutos_extra} color="var(--warning)" />
              </td>
              <td data-label="Faltantes" style={tabular}>
                <Resaltado minutos={dia.minutos_faltantes} color="var(--danger)" />
              </td>
              <td data-label="Retardo" style={tabular}>
                {dia.es_retardo
                  ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{dia.retardo_minutos} min</span>
                  : '—'}
              </td>
              <td data-label="Salida anticipada" style={tabular}>
                <Resaltado minutos={dia.salida_anticipada_min} color="var(--danger)" />
              </td>
              <td data-label="Exceso comida" style={tabular}>
                <Resaltado minutos={dia.exceso_comida_min} color="var(--warning)" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700 }}>
            <td data-label="Día">Total</td>
            <td colSpan={4} data-label="Días completos">{cerrados.length} días completos</td>
            <td data-label="Estado">—</td>
            <td data-label="Programadas" style={tabular}>{hhmm(sumar(dias, 'minutos_programados'))}</td>
            <td data-label="Comida" style={tabular}>{hhmm(sumar(dias, 'minutos_comida'))}</td>
            <td data-label="Trabajadas" style={tabular}>{minToHHMM(sumar(dias, 'minutos_trabajados'))}</td>
            <td data-label="Extra" style={tabular}>{hhmm(sumar(dias, 'minutos_extra'))}</td>
            <td data-label="Faltantes" style={tabular}>{hhmm(sumar(dias, 'minutos_faltantes'))}</td>
            <td data-label="Retardo" style={tabular}>
              {retardos > 0 ? `${retardos} (${sumar(dias.filter(d => d.es_retardo), 'retardo_minutos')} min)` : '—'}
            </td>
            <td data-label="Salida anticipada" style={tabular}>{hhmm(sumar(dias, 'salida_anticipada_min'))}</td>
            <td data-label="Exceso comida" style={tabular}>{hhmm(sumar(dias, 'exceso_comida_min'))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
