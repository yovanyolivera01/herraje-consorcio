import { useState } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Modal para crear/editar Tono inline ──────────────────────────────────
function TonoInlineModal({ onClose, onCreated }) {
  const { addTono } = useCotizacion()
  const [nombre, setNombre] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setErr('El nombre es obligatorio'); return }
    setSaving(true)
    const { data, error } = await addTono({ nombre: nombre.trim() })
    setSaving(false)
    if (error) { setErr(error); return }
    onCreated(data)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Nuevo tono</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Nombre del tono</label>
              <input
                className={`form-input${err ? ' error' : ''}`}
                value={nombre}
                onChange={e => { setNombre(e.target.value); setErr('') }}
                placeholder="Ej. Claro, Bronce, Gris..."
                autoFocus
              />
              {err && <div className="form-error">{err}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear tono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal para crear/editar Espesor inline ───────────────────────────────
function EspesorInlineModal({ onClose, onCreated }) {
  const { addEspesor } = useCotizacion()
  const [form, setForm] = useState({ valor_mm: '', etiqueta: '' })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.valor_mm || isNaN(Number(form.valor_mm))) { setErr('El valor en mm es obligatorio'); return }
    if (!form.etiqueta.trim()) { setErr('La etiqueta es obligatoria'); return }
    setSaving(true)
    const { data, error } = await addEspesor({ valor_mm: Number(form.valor_mm), etiqueta: form.etiqueta.trim() })
    setSaving(false)
    if (error) { setErr(error); return }
    onCreated(data)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Nuevo espesor</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Valor (mm)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_mm}
                  onChange={e => { setForm(f => ({ ...f, valor_mm: e.target.value })); setErr('') }}
                  placeholder="6"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label required">Etiqueta</label>
                <input
                  className="form-input"
                  value={form.etiqueta}
                  onChange={e => { setForm(f => ({ ...f, etiqueta: e.target.value })); setErr('') }}
                  placeholder="6MM"
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear espesor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal principal de Tipo de Vidrio ─────────────────────────────────────
function TipoVidrioModal({ tipo, onClose, onSave }) {
  const { tonos, espesores } = useCotizacion()
  const [form, setForm] = useState({
    id_tono:       tipo?.id_tono ?? '',
    id_espesor:    tipo?.id_espesor ?? '',
    clave:         tipo?.clave ?? '',
    descripcion:   tipo?.descripcion ?? '',
    hoja_largo_cm: tipo?.hoja_largo_cm ?? '',
    hoja_ancho_cm: tipo?.hoja_ancho_cm ?? '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [innerModal, setInnerModal] = useState(null) // 'tono' | 'espesor'

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.id_tono)       e.id_tono       = 'Selecciona un tono'
    if (!form.id_espesor)    e.id_espesor    = 'Selecciona un espesor'
    if (!form.clave.trim())  e.clave         = 'La clave es obligatoria'
    if (!form.hoja_largo_cm || isNaN(Number(form.hoja_largo_cm))) e.hoja_largo_cm = 'Ingresa el largo en cm'
    if (!form.hoja_ancho_cm || isNaN(Number(form.hoja_ancho_cm))) e.hoja_ancho_cm = 'Ingresa el ancho en cm'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    await onSave({
      id_tono:       Number(form.id_tono),
      id_espesor:    Number(form.id_espesor),
      clave:         form.clave.trim().toUpperCase(),
      descripcion:   form.descripcion.trim(),
      hoja_largo_cm: Number(form.hoja_largo_cm),
      hoja_ancho_cm: Number(form.hoja_ancho_cm),
    })
    setSaving(false)
  }

  const activeTonos    = tonos.filter(t => t.activo)
  const activeEspesores = espesores.filter(e => e.activo)

  return (
    <>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !innerModal && onClose()}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">{tipo ? 'Editar tipo de vidrio' : 'Nuevo tipo de vidrio'}</h2>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Tono */}
              <div className="form-group">
                <label className="form-label required">Tono</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className={`form-select${errors.id_tono ? ' error' : ''}`}
                    value={form.id_tono}
                    onChange={set('id_tono')}
                  >
                    <option value="">-- Seleccionar tono --</option>
                    {activeTonos.map(t => (
                      <option key={t.id_tono} value={t.id_tono}>{t.nombre}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setInnerModal('tono')}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    + Nuevo
                  </button>
                </div>
                {errors.id_tono && <div className="form-error">{errors.id_tono}</div>}
              </div>

              {/* Espesor */}
              <div className="form-group">
                <label className="form-label required">Espesor</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className={`form-select${errors.id_espesor ? ' error' : ''}`}
                    value={form.id_espesor}
                    onChange={set('id_espesor')}
                  >
                    <option value="">-- Seleccionar espesor --</option>
                    {activeEspesores.map(e => (
                      <option key={e.id_espesor} value={e.id_espesor}>{e.etiqueta} ({e.valor_mm} mm)</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setInnerModal('espesor')}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    + Nuevo
                  </button>
                </div>
                {errors.id_espesor && <div className="form-error">{errors.id_espesor}</div>}
              </div>

              {/* Clave */}
              <div className="form-group">
                <label className="form-label required">Clave</label>
                <input
                  className={`form-input${errors.clave ? ' error' : ''}`}
                  value={form.clave}
                  onChange={e => setForm(f => ({ ...f, clave: e.target.value.toUpperCase() }))}
                  placeholder="Ej. CLARO-6MM"
                />
                {errors.clave && <div className="form-error">{errors.clave}</div>}
              </div>

              {/* Descripcion */}
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <input
                  className="form-input"
                  value={form.descripcion}
                  onChange={set('descripcion')}
                  placeholder="Descripcion opcional"
                />
              </div>

              {/* Dimensiones de hoja */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">Largo hoja (cm)</label>
                  <input
                    className={`form-input${errors.hoja_largo_cm ? ' error' : ''}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.hoja_largo_cm}
                    onChange={set('hoja_largo_cm')}
                    placeholder="321"
                  />
                  {errors.hoja_largo_cm && <div className="form-error">{errors.hoja_largo_cm}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label required">Ancho hoja (cm)</label>
                  <input
                    className={`form-input${errors.hoja_ancho_cm ? ' error' : ''}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.hoja_ancho_cm}
                    onChange={set('hoja_ancho_cm')}
                    placeholder="225"
                  />
                  {errors.hoja_ancho_cm && <div className="form-error">{errors.hoja_ancho_cm}</div>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : tipo ? 'Guardar cambios' : 'Crear tipo'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modales internos */}
      {innerModal === 'tono' && (
        <TonoInlineModal
          onClose={() => setInnerModal(null)}
          onCreated={(tono) => setForm(f => ({ ...f, id_tono: tono.id_tono }))}
        />
      )}
      {innerModal === 'espesor' && (
        <EspesorInlineModal
          onClose={() => setInnerModal(null)}
          onCreated={(esp) => setForm(f => ({ ...f, id_espesor: esp.id_espesor }))}
        />
      )}
    </>
  )
}

// ── Pagina principal ──────────────────────────────────────────────────────
export default function TiposVidrio() {
  const { tiposVidrio, addTipoVidrio, editTipoVidrio } = useCotizacion()
  const [modal, setModal]   = useState(null) // null | {type:'create'|'edit', data?}
  const [toast, setToast]   = useState(null)
  const [search, setSearch] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async (form) => {
    const { error } = modal.type === 'create'
      ? await addTipoVidrio(form)
      : await editTipoVidrio(modal.data.id_tipo_vidrio, form)
    if (error) { showToast(error, 'error'); return }
    showToast(modal.type === 'create' ? 'Tipo de vidrio creado ✅' : 'Tipo de vidrio actualizado ✅')
    setModal(null)
  }

  const handleToggleActivo = async (tipo) => {
    const { error } = await editTipoVidrio(tipo.id_tipo_vidrio, { activo: !tipo.activo })
    if (error) showToast(error, 'error')
    else showToast(tipo.activo ? 'Tipo desactivado' : 'Tipo activado ✅')
  }

  const filtered = tiposVidrio.filter(t =>
    t.clave.toLowerCase().includes(search.toLowerCase()) ||
    (t.descripcion || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.tono?.nombre || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Tipos de Vidrio</div>
          <div className="page-subtitle">{tiposVidrio.length} tipo{tiposVidrio.length !== 1 ? 's' : ''} registrado{tiposVidrio.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Agregar tipo
        </button>
      </div>

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Buscar por clave, tono o descripcion..."
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
            <div className="empty-state-icon">🔩</div>
            <h3>{search ? 'Sin resultados' : 'Sin tipos de vidrio registrados'}</h3>
            <p>{search ? 'Intenta con otro termino' : 'Haz clic en "+ Agregar tipo" para comenzar'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Tono</th>
                  <th>Espesor</th>
                  <th>Dimension hoja</th>
                  <th>Descripcion</th>
                  <th>Estado</th>
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tipo => (
                  <tr key={tipo.id_tipo_vidrio}>
                    <td data-label="Clave">
                      <span className="badge badge-blue">{tipo.clave}</span>
                    </td>
                    <td data-label="Tono">{tipo.tono?.nombre ?? '—'}</td>
                    <td data-label="Espesor">{tipo.espesor?.etiqueta ?? '—'}</td>
                    <td data-label="Dimension hoja" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                      {tipo.hoja_largo_cm} × {tipo.hoja_ancho_cm} cm
                    </td>
                    <td data-label="Descripcion" style={{ color: 'var(--text-muted)' }}>{tipo.descripcion || '—'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${tipo.activo ? 'badge-green' : 'badge-gray'}`}>
                        {tipo.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="">
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          className="btn-icon"
                          title="Editar"
                          onClick={() => setModal({ type: 'edit', data: tipo })}
                        >✏️</button>
                        <button
                          className="btn-icon"
                          title={tipo.activo ? 'Desactivar' : 'Activar'}
                          onClick={() => handleToggleActivo(tipo)}
                        >{tipo.activo ? '🔕' : '✅'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <TipoVidrioModal
          tipo={modal.type === 'edit' ? modal.data : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
