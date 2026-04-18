import { useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'

// ── Modal de formulario ───────────────────────────────────────
function EmpleadoModal({ empleado, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre:   empleado?.nombre   ?? '',
    telefono: empleado?.telefono ?? '',
  })
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const e = {}
    if (!form.nombre.trim())   e.nombre   = 'El nombre es obligatorio'
    if (!form.telefono.trim()) e.telefono = 'El teléfono es obligatorio'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    await onSave(form.nombre, form.telefono)
    setLoading(false)
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {empleado ? 'Editar empleado' : 'Nuevo empleado'}
          </h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Nombre</label>
              <input
                className={`form-input${errors.nombre ? ' error' : ''}`}
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Nombre completo"
                autoFocus
              />
              {errors.nombre && <div className="form-error">{errors.nombre}</div>}
            </div>
            <div className="form-group">
              <label className="form-label required">Teléfono</label>
              <input
                className={`form-input${errors.telefono ? ' error' : ''}`}
                value={form.telefono}
                onChange={e => {
                  const val = e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '')
                  setForm(f => ({ ...f, telefono: val }))
                }}
                placeholder="Ej. 55 1234-5678"
                inputMode="tel"
                maxLength={20}
              />
              {errors.telefono && <div className="form-error">{errors.telefono}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : empleado ? 'Guardar cambios' : 'Registrar empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de confirmación ─────────────────────────────────────
function DeleteModal({ nombre, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ marginBottom: 8, fontSize: 16 }}>
            ¿Dar de baja a <em>"{nombre}"</em>?
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            El empleado dejará de aparecer en los registros nuevos,
            pero su historial se conserva.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger"  onClick={onConfirm}>Sí, dar de baja</button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function Empleados() {
  const { empleados, addEmpleado, editEmpleado, bajaEmpleado } = usePersonal()

  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [toast, setToast]   = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const filtered = empleados.filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.telefono.includes(search)
  )

  const handleSave = async (nombre, telefono) => {
    const fn = modal.type === 'create'
      ? () => addEmpleado(nombre, telefono)
      : () => editEmpleado(modal.data.empleado_id, nombre, telefono)

    const { error } = await fn()
    if (error) { showToast(error, 'error'); return }
    showToast(
      modal.type === 'create'
        ? 'Empleado registrado correctamente ✅'
        : 'Empleado actualizado correctamente ✅'
    )
    setModal(null)
  }

  const handleDelete = async () => {
    const { error } = await bajaEmpleado(modal.data.empleado_id)
    if (error) { showToast(error, 'error') }
    else { showToast('Empleado dado de baja') }
    setModal(null)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Empleados</div>
          <div className="page-subtitle">
            {empleados.length} empleado{empleados.length !== 1 ? 's' : ''} activo{empleados.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Nuevo empleado
        </button>
      </div>

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Buscar por nombre o teléfono…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>
              Limpiar
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👷</div>
            <h3>{search ? 'Sin resultados' : 'Sin empleados registrados'}</h3>
            <p>
              {search
                ? 'Intenta con otro término de búsqueda'
                : 'Haz clic en "+ Nuevo empleado" para comenzar'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.empleado_id}>
                    <td data-label="#">
                      <span className="badge badge-blue">{emp.empleado_id}</span>
                    </td>
                    <td data-label="Nombre" style={{ fontWeight: 500 }}>{emp.nombre}</td>
                    <td data-label="Teléfono">{emp.telefono}</td>
                    <td data-label="">
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          className="btn-icon"
                          title="Editar"
                          onClick={() => setModal({ type: 'edit', data: emp })}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Dar de baja"
                          onClick={() => setModal({ type: 'delete', data: emp })}
                        >
                          🗑️
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
        <EmpleadoModal
          empleado={modal.type === 'edit' ? modal.data : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteModal
          nombre={modal.data.nombre}
          onCancel={() => setModal(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
