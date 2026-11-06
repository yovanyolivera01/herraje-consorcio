// Captura de una partida de vidrio vendida POR PIEZA.
//
// El usuario escribe la medida (98x45 o 3-98x45), elige el tipo de vidrio y
// el precio por pieza. Al agregar, regresa por onAgregar una partida con el
// mismo formato que las partidas VIDRIO de NuevaCotizacion, más
// es_por_pieza = true y precio_pieza. Al guardarla con agregarPartida, el
// backend (sp_insertar_partida_vidrio → sp_insertar_partida_vidrio_por_pieza)
// recalcula los subtotales a partir de precio_pieza.
//
// Uso:
//   <InputPorPieza
//     tiposVidrio={tiposVidrio}
//     procesos={procesosCalc}          // opcional: procesos ya calculados
//     onAgregar={p => setPartidas(prev => [...prev, p])}
//   />
import { useMemo, useState } from 'react'
import BuscadorSelect from './BuscadorSelect'
import { parseNotacion } from '../lib/cotizacionUtils'

const r2 = n => Math.round(n * 100) / 100
const money = n => `$${Number(n).toFixed(2)}`
const nuevaKey = () => Date.now() + Math.random()

// Recuadro "Pieza pequeña" para capturar el precio c/u.
//   calculadoCU: precio c/u calculado (se muestra y sirve de placeholder)
//   etiqueta:    qué se calculó ('vidrio', 'maquila'...)
//   adicional:   monto que se suma al total por pieza (p. ej. procesos del vidrio)
export function PrecioPorPiezaBox({ calculadoCU, piezas, etiqueta = 'vidrio', adicional = 0, value, onChange }) {
  const precio = Number(value)
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: '#fffbeb', border: '1.5px solid #f59e0b' }}>
      <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>
        ⚠️ Pieza pequeña — {etiqueta} calculado: <strong>{money(calculadoCU)} c/u</strong>
      </div>
      <div style={{ fontSize: 12, color: '#78350f', marginBottom: 8 }}>
        Puedes cobrarla por pieza — precio c/u:
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#78350f' }}>$</span>
        <input
          type="number" min="0" step="0.01" inputMode="decimal"
          className="form-input"
          style={{ maxWidth: 140, margin: 0 }}
          placeholder={Number(calculadoCU).toFixed(2)}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            style={{ fontSize: 12, color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => onChange('')}
          >
            Restablecer
          </button>
        )}
      </div>
      {value && precio > 0 && (
        <div style={{ fontSize: 12, color: '#15803d', marginTop: 6, fontWeight: 600 }}>
          ✓ Se cobrará: {money(precio)} c/u × {piezas} pza
          {adicional > 0 ? ` + procesos ${money(adicional)}` : ''}
          {' '}= {money(r2(precio * piezas + adicional))}
        </div>
      )}
    </div>
  )
}

export default function InputPorPieza({
  tiposVidrio = [],
  procesos = [],
  onAgregar,
  disabled = false,
}) {
  const [notacion, setNotacion]           = useState('')
  const [tipoVidrioId, setTipoVidrioId]   = useState('')
  const [precioPieza, setPrecioPieza]     = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError]                 = useState('')

  const tiposActivos = tiposVidrio.filter(t => t.activo !== false)
  const tipo = tiposVidrio.find(t => t.id_tipo_vidrio === Number(tipoVidrioId))

  // Cálculo en vivo; null mientras falten datos o la medida no sea válida.
  const preview = useMemo(() => {
    const parsed = parseNotacion(notacion)
    const precio = parseFloat(precioPieza)
    if (parsed.error || !(precio > 0)) return null
    const { piezas, largo, ancho } = parsed
    const metros2           = Math.round(piezas * largo * ancho / 10000 * 1000) / 1000
    const subtotal_vidrio   = r2(precio * piezas)
    const subtotal_procesos = r2(procesos.reduce((s, pr) => s + Number(pr.subtotal ?? 0), 0))
    return {
      piezas, largo, ancho, metros2, precio,
      subtotal_vidrio, subtotal_procesos,
      subtotal_partida: r2(subtotal_vidrio + subtotal_procesos),
    }
  }, [notacion, precioPieza, procesos])

  const limpiar = () => {
    setNotacion('')
    setPrecioPieza('')
    setObservaciones('')
    setError('')
  }

  const handleAgregar = () => {
    const parsed = parseNotacion(notacion)
    if (parsed.error)  return setError(parsed.error)
    if (!tipoVidrioId) return setError('Selecciona un tipo de vidrio')
    if (!(parseFloat(precioPieza) > 0)) return setError('El precio por pieza debe ser mayor a 0')
    if (procesos.some(pc => pc.configVacio)) {
      return setError('Hay procesos con 0 lados seleccionados. Abre ⚙️ para configurarlos.')
    }

    onAgregar?.({
      _key:               nuevaKey(),
      tipo:               'VIDRIO',
      es_por_pieza:       true,
      id_tipo_vidrio:     Number(tipoVidrioId),
      tipoClaveLabel:     tipo?.clave ?? '',
      piezas:             preview.piezas,
      largo_cm:           preview.largo,
      ancho_cm:           preview.ancho,
      metros2:            preview.metros2,
      precio_pieza:       preview.precio,
      // precio por m² equivalente, solo informativo (igual que el SP)
      precio_m2_aplicado: preview.metros2 > 0 ? r2(preview.subtotal_vidrio / preview.metros2) : 0,
      subtotal_vidrio:    preview.subtotal_vidrio,
      subtotal_procesos:  preview.subtotal_procesos,
      subtotal_partida:   preview.subtotal_partida,
      es_hoja_completa:   false,
      procesos,
      precio_manual:      null,
      observaciones:      observaciones.trim(),
    })
    limpiar()
  }

  const onEnter = e => { if (e.key === 'Enter') handleAgregar() }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label required">Medida</label>
          <input
            className={`form-input cot-calc-input${error ? ' error' : ''}`}
            value={notacion}
            onChange={e => { setNotacion(e.target.value); setError('') }}
            onKeyDown={onEnter}
            placeholder="98x45  o  3-98x45"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
            disabled={disabled}
          />
          <div className="form-hint">largo×ancho  o  pzas-largo×ancho</div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label required">Tipo de vidrio</label>
          <BuscadorSelect
            value={tipoVidrioId}
            onChange={id => { setTipoVidrioId(id); setError('') }}
            options={tiposActivos.map(t => ({
              value: String(t.id_tipo_vidrio),
              label: `${t.clave}${t.descripcion ? ` — ${t.descripcion}` : ''}`,
            }))}
            placeholder="-- Tipo --"
            disabled={disabled}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label required">Precio por pieza</label>
          <input
            className="form-input"
            type="number" min="0" step="0.01" inputMode="decimal"
            value={precioPieza}
            onChange={e => { setPrecioPieza(e.target.value); setError('') }}
            onKeyDown={onEnter}
            placeholder="0.00"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
        <label className="form-label">Observaciones</label>
        <input
          className="form-input"
          value={observaciones}
          onChange={e => setObservaciones(e.target.value)}
          onKeyDown={onEnter}
          placeholder="Opcional"
          disabled={disabled}
        />
      </div>

      {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}

      {preview && (
        <div style={{ marginTop: 10, fontSize: 13, display: 'grid', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{preview.piezas} pza × {money(preview.precio)} · {preview.metros2} m²</span>
            <span>{money(preview.subtotal_vidrio)}</span>
          </div>
          {procesos.map((pr, i) => (
            <div key={pr.id_proceso ?? i} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>+ {pr.nombre}</span>
              <span>{money(pr.subtotal ?? 0)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px dashed #ccc', paddingTop: 3 }}>
            <span>Subtotal</span>
            <span>{money(preview.subtotal_partida)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 10, width: '100%' }}
        onClick={handleAgregar}
        disabled={disabled || !preview || !tipoVidrioId}
      >
        Agregar por pieza
      </button>
    </div>
  )
}
