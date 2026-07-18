import { useState } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Modal genérico de proceso normal ─────────────────────────────────────
function ProcesoModal({ proceso, onClose, onSave }) {
  const { unidades, nivelesPrecio, espesores, preciosProceso, procesos } = useCotizacion()
  const [form, setForm] = useState({
    nombre:          proceso?.nombre          ?? '',
    id_unidad_cobro: proceso?.id_unidad_cobro ?? '',
  })
  const [preciosGrid, setPreciosGrid] = useState(() => {
    const map = {}
    if (proceso?.id_proceso) {
      preciosProceso
        .filter(p => p.id_proceso === proceso.id_proceso)
        .forEach(p => { map[`${p.id_espesor}_${p.id_nivel_precio}`] = String(p.precio_unitario) })
    }
    return map
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (!form.id_unidad_cobro) e.id_unidad_cobro = 'Selecciona una unidad de cobro'
    const nombreNorm = form.nombre.trim().toLowerCase()
    const duplicado = procesos.find(p =>
      (p.tipo === 'PROCESO' || !p.tipo) &&
      p.nombre.toLowerCase() === nombreNorm &&
      (!proceso || p.id_proceso !== proceso.id_proceso)
    )
    if (duplicado) e.nombre = 'Ya existe un proceso con ese nombre'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const preciosArray = Object.entries(preciosGrid)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0)
      .map(([key, precio]) => {
        const [id_espesor, id_nivel_precio] = key.split('_').map(Number)
        return { id_espesor, id_nivel_precio, precio_unitario: Number(precio) }
      })
    await onSave({
      nombre:          form.nombre.trim(),
      id_unidad_cobro: Number(form.id_unidad_cobro),
      preciosNivel:    preciosArray,
      tipo:            'PROCESO',
    })
    setSaving(false)
  }

  const nivelesActivos   = nivelesPrecio.filter(n => n.activo !== false && !n.es_hoja_completa)
  const espesoresActivos = espesores.filter(e => e.activo !== false)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{proceso ? 'Editar proceso' : 'Nuevo proceso'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Nombre del proceso</label>
              <input
                className={`form-input${errors.nombre ? ' error' : ''}`}
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Ej. Pulido de canto, Biselado..."
                autoFocus
              />
              {errors.nombre && <div className="form-error">{errors.nombre}</div>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Unidad de cobro</label>
                <select
                  className={`form-select${errors.id_unidad_cobro ? ' error' : ''}`}
                  value={form.id_unidad_cobro}
                  onChange={set('id_unidad_cobro')}
                >
                  <option value="">-- Seleccionar --</option>
                  {unidades.filter(u => ['M2', 'ML'].includes(u.nombre?.toUpperCase())).map(u => (
                    <option key={u.id_unidad_cobro} value={u.id_unidad_cobro}>{u.nombre} — {u.descripcion}</option>
                  ))}
                </select>
                {errors.id_unidad_cobro && <div className="form-error">{errors.id_unidad_cobro}</div>}
              </div>
            </div>

            {nivelesActivos.length > 0 && espesoresActivos.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                  Precios por nivel de cliente y espesor ($)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>
                          Espesor
                        </th>
                        {nivelesActivos.map(n => (
                          <th key={n.id_nivel_precio} style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                            {n.nombre}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {espesoresActivos.map((esp, i) => (
                        <tr key={esp.id_espesor} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {esp.etiqueta}
                          </td>
                          {nivelesActivos.map(n => {
                            const key = `${esp.id_espesor}_${n.id_nivel_precio}`
                            return (
                              <td key={n.id_nivel_precio} style={{ padding: '4px 6px' }}>
                                <input
                                  className="form-input"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  style={{ textAlign: 'right', padding: '5px 8px', fontSize: 14, minWidth: 80 }}
                                  value={preciosGrid[key] ?? ''}
                                  onChange={e => setPreciosGrid(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="0.00"
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="form-hint" style={{ marginTop: 6 }}>
                  Deja vacío los espesores que no apliquen.
                </div>
              </div>
            )}

            <div className="alert alert-warning" style={{ marginTop: 12 }}>
              💡 Para procesos por <strong>m²</strong>: se multiplica por los metros cuadrados de la partida.<br />
              Para procesos por <strong>ml</strong>: se multiplica por el perimetro (largo + ancho) × 2 ÷ 100.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : proceso ? 'Guardar cambios' : 'Crear proceso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Barreno ─────────────────────────────────────────────────────────
function BarrenoModal({ barreno, onClose, onSave }) {
  const { unidades, nivelesPrecio, preciosProcesoEspecial, procesos } = useCotizacion()
  const [form, setForm] = useState({
    diametro_mm: barreno?.diametro_mm ?? '',
    nombre:      barreno?.nombre      ?? '',
  })
  const [preciosGrid, setPreciosGrid] = useState(() => {
    const map = {}
    if (barreno?.id_proceso) {
      preciosProcesoEspecial
        .filter(p => p.id_proceso === barreno.id_proceso)
        .forEach(p => { map[String(p.id_nivel_precio)] = String(p.precio_unitario) })
    }
    return map
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const nivelesActivos = nivelesPrecio.filter(n => n.activo !== false && !n.es_hoja_completa)

  const validate = () => {
    const e = {}
    if (!form.diametro_mm || isNaN(Number(form.diametro_mm)) || Number(form.diametro_mm) <= 0)
      e.diametro_mm = 'Ingresa el diámetro en mm'
    const computedNombre = (form.nombre.trim() || `Barreno ${form.diametro_mm}mm`).toLowerCase()
    const duplicado = procesos.find(p =>
      p.tipo === 'BARRENO' &&
      p.nombre.toLowerCase() === computedNombre &&
      (!barreno || p.id_proceso !== barreno.id_proceso)
    )
    if (duplicado) e.diametro_mm = 'Ya existe un barreno con ese diámetro/nombre'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    // Auto-seleccionar unidad "pieza/pza" o la primera disponible
    const unidadPieza = unidades.find(u =>
      /pieza|pza|pzas/i.test(u.nombre) || /pieza|pza|pzas/i.test(u.descripcion ?? '')
    ) ?? unidades[0]
    const preciosArray = Object.entries(preciosGrid)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0)
      .map(([id_nivel_precio, precio]) => ({
        id_nivel_precio: Number(id_nivel_precio),
        precio_unitario: Number(precio),
      }))
    const label = form.nombre.trim() || `Barreno ${form.diametro_mm}mm`
    await onSave({
      nombre:          label,
      diametro_mm:     Number(form.diametro_mm),
      id_unidad_cobro: unidadPieza?.id_unidad_cobro ?? null,
      tipo:            'BARRENO',
      precio_unitario: 0,
      preciosEspecial: preciosArray,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{barreno ? 'Editar barreno' : 'Nuevo barreno'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Diámetro (mm)</label>
                <input
                  className={`form-input${errors.diametro_mm ? ' error' : ''}`}
                  type="number" step="0.5" min="0"
                  value={form.diametro_mm}
                  onChange={set('diametro_mm')}
                  placeholder="Ej. 6, 8, 10, 12..."
                  autoFocus
                />
                {errors.diametro_mm && <div className="form-error">{errors.diametro_mm}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Etiqueta (opcional)</label>
                <input
                  className="form-input"
                  value={form.nombre}
                  onChange={set('nombre')}
                  placeholder={`Barreno ${form.diametro_mm || '?'}mm`}
                />
                <div className="form-hint">Si vacío, se usará "Barreno {form.diametro_mm || '?'}mm"</div>
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 13, color: '#0369a1', marginBottom: 8 }}>
              🔩 Los barrenos se cobran <strong>por cantidad</strong> — precio unitario × número de barrenos que el cliente pide.
            </div>

            {nivelesActivos.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                  Precio por nivel de cliente ($ por barreno)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                        Nivel
                      </th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                        Precio unitario ($)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {nivelesActivos.map((n, i) => (
                      <tr key={n.id_nivel_precio} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{n.nombre}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <input
                            className="form-input"
                            type="number" step="0.01" min="0"
                            style={{ textAlign: 'right', padding: '5px 8px', fontSize: 14, maxWidth: 120, marginLeft: 'auto', display: 'block' }}
                            value={preciosGrid[String(n.id_nivel_precio)] ?? ''}
                            onChange={e => setPreciosGrid(prev => ({ ...prev, [String(n.id_nivel_precio)]: e.target.value }))}
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="form-hint" style={{ marginTop: 6 }}>
                  El precio se cobra por cada barreno × la cantidad de barrenos que el cliente pide.
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : barreno ? 'Guardar cambios' : 'Crear barreno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Saque ───────────────────────────────────────────────────────────
function SaqueModal({ saque, onClose, onSave }) {
  const { unidades, nivelesPrecio, preciosProcesoEspecial, procesos } = useCotizacion()
  const [form, setForm] = useState({
    nombre:      saque?.nombre      ?? '',
    descripcion: saque?.descripcion ?? '',
  })
  const [preciosGrid, setPreciosGrid] = useState(() => {
    const map = {}
    if (saque?.id_proceso) {
      preciosProcesoEspecial
        .filter(p => p.id_proceso === saque.id_proceso)
        .forEach(p => { map[String(p.id_nivel_precio)] = String(p.precio_unitario) })
    }
    return map
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const nivelesActivos = nivelesPrecio.filter(n => n.activo !== false && !n.es_hoja_completa)

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    const duplicado = procesos.find(p =>
      p.tipo === 'SAQUE' &&
      p.nombre.toLowerCase() === form.nombre.trim().toLowerCase() &&
      (!saque || p.id_proceso !== saque.id_proceso)
    )
    if (duplicado) e.nombre = 'Ya existe un nivel de saque con ese nombre'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    // Auto-seleccionar unidad "servicio/serv" o la primera disponible
    const unidadServ = unidades.find(u =>
      /serv|global|fijo/i.test(u.nombre) || /serv|global|fijo/i.test(u.descripcion ?? '')
    ) ?? unidades[0]
    const preciosArray = Object.entries(preciosGrid)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0)
      .map(([id_nivel_precio, precio]) => ({
        id_nivel_precio: Number(id_nivel_precio),
        precio_unitario: Number(precio),
      }))
    await onSave({
      nombre:          form.nombre.trim(),
      id_unidad_cobro: unidadServ?.id_unidad_cobro ?? null,
      tipo:            'SAQUE',
      precio_unitario: 0,
      preciosEspecial: preciosArray,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{saque ? 'Editar nivel de saque' : 'Nuevo nivel de saque'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Nombre / Complejidad</label>
              <input
                className={`form-input${errors.nombre ? ' error' : ''}`}
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Ej. Simple, Complejo, Muy complejo..."
                autoFocus
              />
              {errors.nombre && <div className="form-error">{errors.nombre}</div>}
            </div>
            <div style={{ padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 13, color: '#0369a1', marginBottom: 8 }}>
              ✂️ El saque se cobra como <strong>monto fijo por trabajo</strong> según la complejidad — sin importar m² ni metros lineales.
            </div>

            {nivelesActivos.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                  Precio por nivel de cliente ($ monto fijo del saque)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 13 }}>Nivel</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 13 }}>Precio ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nivelesActivos.map((n, i) => (
                      <tr key={n.id_nivel_precio} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{n.nombre}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <input
                            className="form-input"
                            type="number" step="0.01" min="0"
                            style={{ textAlign: 'right', padding: '5px 8px', fontSize: 14, maxWidth: 120, marginLeft: 'auto', display: 'block' }}
                            value={preciosGrid[String(n.id_nivel_precio)] ?? ''}
                            onChange={e => setPreciosGrid(prev => ({ ...prev, [String(n.id_nivel_precio)]: e.target.value }))}
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="form-hint" style={{ marginTop: 6 }}>
                  El saque se cobra como monto fijo según la complejidad del trabajo.
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : saque ? 'Guardar cambios' : 'Crear nivel de saque'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Extra ───────────────────────────────────────────────────────────
function ExtraModal({ extra, onClose, onSave }) {
  const { unidades, nivelesPrecio, preciosProcesoEspecial, procesos } = useCotizacion()
  const [form, setForm] = useState({
    nombre: extra?.nombre ?? '',
  })
  const [preciosGrid, setPreciosGrid] = useState(() => {
    const map = {}
    if (extra?.id_proceso) {
      preciosProcesoEspecial
        .filter(p => p.id_proceso === extra.id_proceso)
        .forEach(p => { map[String(p.id_nivel_precio)] = String(p.precio_unitario) })
    }
    return map
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const nivelesActivos = nivelesPrecio.filter(n => n.activo !== false && !n.es_hoja_completa)

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    const duplicado = procesos.find(p =>
      p.tipo === 'EXTRA' &&
      p.nombre.toLowerCase() === form.nombre.trim().toLowerCase() &&
      (!extra || p.id_proceso !== extra.id_proceso)
    )
    if (duplicado) e.nombre = 'Ya existe un extra con ese nombre'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const unidadPieza = unidades.find(u =>
      /pieza|pza|pzas/i.test(u.nombre) || /pieza|pza|pzas/i.test(u.descripcion ?? '')
    ) ?? unidades[0]
    const preciosArray = Object.entries(preciosGrid)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0)
      .map(([id_nivel_precio, precio]) => ({
        id_nivel_precio: Number(id_nivel_precio),
        precio_unitario: Number(precio),
      }))
    await onSave({
      nombre:          form.nombre.trim(),
      id_unidad_cobro: unidadPieza?.id_unidad_cobro ?? null,
      tipo:            'EXTRA',
      precio_unitario: 0,
      preciosEspecial: preciosArray,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{extra ? 'Editar extra' : 'Nuevo extra'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Nombre del extra</label>
              <input
                className={`form-input${errors.nombre ? ' error' : ''}`}
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Ej. Película de seguridad, Sellado perimetral..."
                autoFocus
              />
              {errors.nombre && <div className="form-error">{errors.nombre}</div>}
            </div>
            <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#15803d', marginBottom: 8 }}>
              ✨ Los extras se cobran como <strong>monto fijo por cantidad</strong> — precio unitario × número de unidades que el cliente pide.
            </div>

            {nivelesActivos.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                  Precio por nivel de cliente ($)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 13 }}>Nivel</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 13 }}>Precio unitario ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nivelesActivos.map((n, i) => (
                      <tr key={n.id_nivel_precio} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{n.nombre}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <input
                            className="form-input"
                            type="number" step="0.01" min="0"
                            style={{ textAlign: 'right', padding: '5px 8px', fontSize: 14, maxWidth: 120, marginLeft: 'auto', display: 'block' }}
                            value={preciosGrid[String(n.id_nivel_precio)] ?? ''}
                            onChange={e => setPreciosGrid(prev => ({ ...prev, [String(n.id_nivel_precio)]: e.target.value }))}
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="form-hint" style={{ marginTop: 6 }}>
                  El precio se cobra por unidad × la cantidad que el cliente pide.
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : extra ? 'Guardar cambios' : 'Crear extra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Pagina Procesos ───────────────────────────────────────────────────────
export default function Procesos() {
  const {
    procesos, barrenos, saques, extras,
    addProceso, editProceso, guardarPreciosProceso, guardarPreciosProcesoEspecial,
  } = useCotizacion()

  const [tab,    setTab]    = useState('procesos') // 'procesos' | 'barrenos' | 'saques' | 'extras'
  const [modal,  setModal]  = useState(null)
  const [toast,  setToast]  = useState(null)
  const [search, setSearch] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Guardar proceso normal ────────────────────────────────────────────────
  const handleSaveProceso = async (form) => {
    const { preciosNivel = [], ...procesoData } = form
    const res = modal.type === 'create'
      ? await addProceso(procesoData)
      : await editProceso(modal.data.id_proceso, procesoData)
    if (res.error) { showToast(res.error, 'error'); return }
    if (preciosNivel.length > 0) {
      const id = modal.type === 'create' ? res.data.id_proceso : modal.data.id_proceso
      const { error: pErr } = await guardarPreciosProceso(id, preciosNivel)
      if (pErr) { showToast(pErr, 'error'); return }
    }
    showToast(modal.type === 'create' ? 'Proceso creado ✅' : 'Proceso actualizado ✅')
    setModal(null)
  }

  // ── Guardar barreno / saque / extra ─────────────────────────────────────
  const handleSaveEspecial = async (form) => {
    const { preciosEspecial = [], ...procesoData } = form
    const res = modal.type === 'create'
      ? await addProceso(procesoData)
      : await editProceso(modal.data.id_proceso, procesoData)
    if (res.error) { showToast(res.error, 'error'); return }
    const id = modal.type === 'create' ? res.data.id_proceso : modal.data.id_proceso
    if (preciosEspecial.length > 0) {
      const { error: pErr } = await guardarPreciosProcesoEspecial(id, preciosEspecial)
      if (pErr) { showToast(pErr, 'error'); return }
    }
    const tipo = procesoData.tipo === 'BARRENO' ? 'Barreno' : procesoData.tipo === 'EXTRA' ? 'Extra' : 'Saque'
    showToast(modal.type === 'create' ? `${tipo} creado ✅` : `${tipo} actualizado ✅`)
    setModal(null)
  }

  const handleToggleActivo = async (proceso) => {
    const { error } = await editProceso(proceso.id_proceso, { activo: !proceso.activo })
    if (error) showToast(error, 'error')
    else showToast(proceso.activo ? 'Desactivado' : 'Activado ✅')
  }

  // ── Lista según el tab activo ─────────────────────────────────────────────
  const procesosNormales = procesos.filter(p => p.tipo === 'PROCESO' || !p.tipo)
  const tipoDelTab = tab === 'barrenos' ? 'BARRENO' : tab === 'saques' ? 'SAQUE' : tab === 'extras' ? 'EXTRA' : null
  const listaAllTab = tab === 'procesos'
    ? procesosNormales
    : procesos.filter(p => p.tipo === tipoDelTab)

  const filtered = listaAllTab.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const tabLabel = tab === 'procesos' ? 'proceso' : tab === 'barrenos' ? 'barreno' : tab === 'saques' ? 'nivel de saque' : 'extra'

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Procesos Adicionales</div>
          <div className="page-subtitle">Procesos, barrenos, saques y extras configurables por nivel</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ type: 'create' })}
        >
          + {tab === 'procesos' ? 'Nuevo proceso' : tab === 'barrenos' ? 'Nuevo barreno' : tab === 'saques' ? 'Nuevo nivel de saque' : 'Nuevo extra'}
        </button>
      </div>

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '2px solid var(--border)' }}>
          {[
            { key: 'procesos', icon: '⚙️', label: 'Procesos', count: procesosNormales.length },
            { key: 'barrenos', icon: '🔩', label: 'Barrenos', count: procesos.filter(p => p.tipo === 'BARRENO').length },
            { key: 'saques',   icon: '✂️', label: 'Saques',   count: procesos.filter(p => p.tipo === 'SAQUE').length },
            { key: 'extras',   icon: '✨', label: 'Extras',   count: procesos.filter(p => p.tipo === 'EXTRA').length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch('') }}
              style={{
                padding: '8px 18px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 14, fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '3px solid var(--accent)' : '3px solid transparent',
                marginBottom: -2, transition: 'all 0.15s',
              }}
            >
              {t.icon} {t.label}
              <span style={{
                marginLeft: 6, fontSize: 11, background: tab === t.key ? 'var(--accent)' : 'var(--border)',
                color: tab === t.key ? 'white' : 'var(--text-muted)',
                borderRadius: 10, padding: '1px 6px',
              }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Descripción del tab */}
        {tab === 'barrenos' && (
          <div className="alert alert-warning" style={{ marginBottom: 14 }}>
            🔩 <strong>Barrenos:</strong> se cobran por cantidad de barrenos. Configura el precio unitario por nivel de cliente y diámetro (mm). En la cotización el usuario indica cuántos barrenos lleva la pieza.
          </div>
        )}
        {tab === 'saques' && (
          <div className="alert alert-warning" style={{ marginBottom: 14 }}>
            ✂️ <strong>Saques:</strong> se cobran como monto fijo según la complejidad del trabajo. Configura los niveles de complejidad con su precio por nivel de cliente.
          </div>
        )}
        {tab === 'extras' && (
          <div className="alert alert-warning" style={{ marginBottom: 14 }}>
            ✨ <strong>Extras:</strong> se cobran como monto fijo por cantidad. Configura cada extra con su precio por nivel de cliente.
          </div>
        )}

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder={`Buscar ${tabLabel}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>Limpiar</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{tab === 'procesos' ? '⚙️' : tab === 'barrenos' ? '🔩' : tab === 'saques' ? '✂️' : '✨'}</div>
            <h3>{search ? 'Sin resultados' : `Sin ${tabLabel}s registrados`}</h3>
            <p>{search ? 'Intenta con otro termino' : `Haz clic en "+ Nuevo ${tabLabel}" para comenzar`}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>
                    {tab === 'barrenos' ? 'Diámetro' : 'Nombre'}
                  </th>
                  {tab === 'procesos' && <th>Unidad de cobro</th>}
                  {tab === 'barrenos' && <th>Etiqueta</th>}
                  {tab === 'extras'   && <th></th>}
                  <th>Estado</th>
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id_proceso} style={{ opacity: p.activo ? 1 : 0.55 }}>
                    <td data-label={tab === 'barrenos' ? 'Diámetro' : 'Nombre'} style={{ fontWeight: 600 }}>
                      {tab === 'barrenos'
                        ? <span>{p.diametro_mm} mm</span>
                        : p.nombre
                      }
                    </td>
                    {tab === 'procesos' && (
                      <td data-label="Unidad">
                        <span className="badge badge-blue">{p.unidad_cobro?.nombre ?? '—'}</span>
                        {p.unidad_cobro?.descripcion && (
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 6 }}>
                            {p.unidad_cobro.descripcion}
                          </span>
                        )}
                      </td>
                    )}
                    {tab === 'barrenos' && (
                      <td data-label="Etiqueta" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {p.nombre}
                      </td>
                    )}
                    <td data-label="Estado">
                      <span className={`badge ${p.activo ? 'badge-green' : 'badge-gray'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="">
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="btn-icon" title="Editar" onClick={() => setModal({ type: 'edit', data: p })}>✏️</button>
                        <button className="btn-icon" title={p.activo ? 'Desactivar' : 'Activar'} onClick={() => handleToggleActivo(p)}>
                          {p.activo ? '🔕' : '✅'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {modal?.type === 'create' && tab === 'procesos' && (
        <ProcesoModal proceso={null} onClose={() => setModal(null)} onSave={handleSaveProceso} />
      )}
      {modal?.type === 'edit' && tab === 'procesos' && (
        <ProcesoModal proceso={modal.data} onClose={() => setModal(null)} onSave={handleSaveProceso} />
      )}
      {modal?.type === 'create' && tab === 'barrenos' && (
        <BarrenoModal barreno={null} onClose={() => setModal(null)} onSave={handleSaveEspecial} />
      )}
      {modal?.type === 'edit' && tab === 'barrenos' && (
        <BarrenoModal barreno={modal.data} onClose={() => setModal(null)} onSave={handleSaveEspecial} />
      )}
      {modal?.type === 'create' && tab === 'saques' && (
        <SaqueModal saque={null} onClose={() => setModal(null)} onSave={handleSaveEspecial} />
      )}
      {modal?.type === 'edit' && tab === 'saques' && (
        <SaqueModal saque={modal.data} onClose={() => setModal(null)} onSave={handleSaveEspecial} />
      )}
      {modal?.type === 'create' && tab === 'extras' && (
        <ExtraModal extra={null} onClose={() => setModal(null)} onSave={handleSaveEspecial} />
      )}
      {modal?.type === 'edit' && tab === 'extras' && (
        <ExtraModal extra={modal.data} onClose={() => setModal(null)} onSave={handleSaveEspecial} />
      )}
    </>
  )
}
