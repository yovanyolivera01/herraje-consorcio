import { useState } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Modal Crear/Editar Proceso ────────────────────────────────────────────
function ProcesoModal({ proceso, onClose, onSave }) {
  const { unidades } = useCotizacion()
  const [form, setForm] = useState({
    nombre:          proceso?.nombre          ?? '',
    id_unidad_cobro: proceso?.id_unidad_cobro ?? '',
    precio_unitario: proceso?.precio_unitario ?? '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (!form.id_unidad_cobro) e.id_unidad_cobro = 'Selecciona una unidad de cobro'
    if (!form.precio_unitario || isNaN(Number(form.precio_unitario)) || Number(form.precio_unitario) < 0)
      e.precio_unitario = 'Ingresa un precio valido'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    await onSave({
      nombre:          form.nombre.trim(),
      id_unidad_cobro: Number(form.id_unidad_cobro),
      precio_unitario: Number(form.precio_unitario),
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
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
                  {unidades.map(u => (
                    <option key={u.id_unidad_cobro} value={u.id_unidad_cobro}>{u.nombre} — {u.descripcion}</option>
                  ))}
                </select>
                {errors.id_unidad_cobro && <div className="form-error">{errors.id_unidad_cobro}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">Precio unitario ($)</label>
                <input
                  className={`form-input${errors.precio_unitario ? ' error' : ''}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio_unitario}
                  onChange={set('precio_unitario')}
                  placeholder="0.00"
                />
                {errors.precio_unitario && <div className="form-error">{errors.precio_unitario}</div>}
              </div>
            </div>
            <div className="alert alert-warning" style={{ marginTop: 8 }}>
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

// ── Pagina Procesos ───────────────────────────────────────────────────────
export default function Procesos() {
  const { procesos, addProceso, editProceso } = useCotizacion()
  const [modal, setModal]   = useState(null)
  const [toast, setToast]   = useState(null)
  const [search, setSearch] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async (form) => {
    const { error } = modal.type === 'create'
      ? await addProceso(form)
      : await editProceso(modal.data.id_proceso, form)
    if (error) { showToast(error, 'error'); return }
    showToast(modal.type === 'create' ? 'Proceso creado ✅' : 'Proceso actualizado ✅')
    setModal(null)
  }

  const handleToggleActivo = async (proceso) => {
    const { error } = await editProceso(proceso.id_proceso, { activo: !proceso.activo })
    if (error) showToast(error, 'error')
    else showToast(proceso.activo ? 'Proceso desactivado' : 'Proceso activado ✅')
  }

  const filtered = procesos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.unidad_cobro?.nombre || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Procesos Adicionales</div>
          <div className="page-subtitle">{procesos.length} proceso{procesos.length !== 1 ? 's' : ''} registrado{procesos.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Nuevo proceso
        </button>
      </div>

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Buscar proceso..."
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
            <div className="empty-state-icon">⚙️</div>
            <h3>{search ? 'Sin resultados' : 'Sin procesos registrados'}</h3>
            <p>{search ? 'Intenta con otro termino' : 'Haz clic en "+ Nuevo proceso" para comenzar'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Unidad de cobro</th>
                  <th style={{ textAlign: 'right' }}>Precio unitario</th>
                  <th>Estado</th>
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id_proceso} style={{ opacity: p.activo ? 1 : 0.55 }}>
                    <td data-label="Nombre" style={{ fontWeight: 500 }}>{p.nombre}</td>
                    <td data-label="Unidad">
                      <span className="badge badge-blue">
                        {p.unidad_cobro?.nombre ?? '—'}
                      </span>
                      {p.unidad_cobro?.descripcion && (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 6 }}>
                          {p.unidad_cobro.descripcion}
                        </span>
                      )}
                    </td>
                    <td data-label="Precio" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                      ${Number(p.precio_unitario).toFixed(2)}
                    </td>
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

      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <ProcesoModal
          proceso={modal.type === 'edit' ? modal.data : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
