import { useState } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Modal para crear/editar Tono inline ──────────────────────────────────
function TonoInlineModal({ onClose, onCreated }) {
  const { addTono, tonos } = useCotizacion()
  const [nombre, setNombre] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setErr('El nombre es obligatorio'); return }
    const existe = tonos.some(t => t.nombre.toLowerCase() === nombre.trim().toLowerCase())
    if (existe) { setErr('Ya existe un tono con ese nombre'); return }
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
  const { addEspesor, espesores } = useCotizacion()
  const [valor_mm, setValor] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valor_mm || isNaN(Number(valor_mm))) { setErr('El valor en mm es obligatorio'); return }
    const mm = Number(valor_mm)
    if (mm <= 0) { setErr('El valor debe ser mayor a 0'); return }
    if (espesores.some(e => Number(e.valor_mm) === mm)) {
      setErr(`Ya existe un espesor de ${mm} mm`); return
    }
    const etiqueta = `${mm}MM`
    setSaving(true)
    const { data, error } = await addEspesor({ valor_mm: mm, etiqueta })
    setSaving(false)
    if (error) { setErr(error); return }
    onCreated(data)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 320 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Nuevo espesor</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-group">
              <label className="form-label required">Milímetros (mm)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                value={valor_mm}
                onChange={e => { setValor(e.target.value); setErr('') }}
                placeholder="Ej. 6"
                autoFocus
              />
              {valor_mm && !isNaN(Number(valor_mm)) && Number(valor_mm) > 0 && (
                <div className="form-hint">Se guardará como: <strong>{Number(valor_mm)}MM</strong></div>
              )}
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
  const { tonos, espesores, tiposVidrio } = useCotizacion()
  const [form, setForm] = useState({
    id_tono:     tipo?.id_tono    ?? '',
    id_espesor:  tipo?.id_espesor ?? '',
    descripcion: tipo?.descripcion ?? '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [innerModal, setInnerModal] = useState(null) // 'tono' | 'espesor'

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const activeTonos     = tonos.filter(t => t.activo)
  const activeEspesores = espesores.filter(e => e.activo)

  const tonoSeleccionado    = tonos.find(t => t.id_tono    === Number(form.id_tono))
  const espesorSeleccionado = espesores.find(e => e.id_espesor === Number(form.id_espesor))
  const claveGenerada = tonoSeleccionado && espesorSeleccionado
    ? `${tonoSeleccionado.nombre.toUpperCase()}-${espesorSeleccionado.etiqueta}`
    : ''

  const validate = () => {
    const e = {}
    if (!form.id_tono)    e.id_tono    = 'Selecciona un tono'
    if (!form.id_espesor) e.id_espesor = 'Selecciona un espesor'
    if (form.id_tono && form.id_espesor) {
      const duplicado = tiposVidrio.find(t =>
        t.id_tono    === Number(form.id_tono) &&
        t.id_espesor === Number(form.id_espesor) &&
        t.id_tipo_vidrio !== tipo?.id_tipo_vidrio
      )
      if (duplicado) e.id_espesor = `Ya existe "${duplicado.clave}"`
    }
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    await onSave({
      id_tono:     Number(form.id_tono),
      id_espesor:  Number(form.id_espesor),
      clave:       claveGenerada,
      descripcion: form.descripcion.trim(),
    })
    setSaving(false)
  }

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

              {/* Clave generada automáticamente */}
              <div className="form-group">
                <label className="form-label">Clave</label>
                <input
                  className="form-input"
                  value={claveGenerada}
                  readOnly
                  style={{ background: 'var(--bg)', color: claveGenerada ? 'var(--text)' : 'var(--text-muted)', cursor: 'default' }}
                  placeholder="Se genera al seleccionar tono y espesor"
                />
                {claveGenerada && (
                  <div className="form-hint">Generada automáticamente a partir del tono y espesor.</div>
                )}
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
