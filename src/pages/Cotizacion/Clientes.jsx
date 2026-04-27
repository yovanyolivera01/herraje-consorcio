import { useState } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Modal Crear/Editar Cliente ────────────────────────────────────────────
function ClienteModal({ cliente, onClose, onSave }) {
  const { nivelesPrecio } = useCotizacion()
  const vidrieroId = nivelesPrecio.find(n => n.nombre.toLowerCase().includes('vidriero'))?.id_nivel_precio ?? ''
  const [form, setForm] = useState({
    nombre:          cliente?.nombre          ?? '',
    telefono:        cliente?.telefono        ?? '',
    correo:          cliente?.correo          ?? '',
    id_nivel_precio: cliente?.id_nivel_precio ?? vidrieroId,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo))
      e.correo = 'Correo no valido'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    await onSave({
      nombre:          form.nombre.trim(),
      telefono:        form.telefono.trim() || null,
      correo:          form.correo.trim()   || null,
      id_nivel_precio: form.id_nivel_precio ? Number(form.id_nivel_precio) : null,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{cliente ? 'Editar cliente' : 'Nuevo cliente'}</h2>
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
                placeholder="Nombre del cliente"
                autoFocus
              />
              {errors.nombre && <div className="form-error">{errors.nombre}</div>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Telefono</label>
                <input
                  className="form-input"
                  value={form.telefono}
                  onChange={e => {
                    const val = e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '')
                    setForm(f => ({ ...f, telefono: val }))
                  }}
                  placeholder="55 1234-5678"
                  inputMode="tel"
                  maxLength={10}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Correo</label>
                <input
                  className={`form-input${errors.correo ? ' error' : ''}`}
                  type="email"
                  value={form.correo}
                  onChange={set('correo')}
                  placeholder="correo@ejemplo.com"
                />
                {errors.correo && <div className="form-error">{errors.correo}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nivel de precio predeterminado</label>
              <select
                className="form-select"
                value={form.id_nivel_precio}
                onChange={set('id_nivel_precio')}
              >
                <option value="">-- Sin nivel predeterminado --</option>
                {nivelesPrecio.map(n => (
                  <option key={n.id_nivel_precio} value={n.id_nivel_precio}>{n.nombre}</option>
                ))}
              </select>
              <div className="form-hint">Se aplicara automaticamente al crear una cotizacion para este cliente</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : cliente ? 'Guardar cambios' : 'Registrar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Pagina Clientes ───────────────────────────────────────────────────────
export default function Clientes() {
  const { clientes, addCliente, editCliente } = useCotizacion()
  const [modal, setModal]   = useState(null)
  const [toast, setToast]   = useState(null)
  const [search, setSearch] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('todos') // 'todos' | 'activos' | 'inactivos'

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async (form) => {
    const { error } = modal.type === 'create'
      ? await addCliente(form)
      : await editCliente(modal.data.id_cliente, form)
    if (error) { showToast(error, 'error'); return }
    showToast(modal.type === 'create' ? 'Cliente registrado ✅' : 'Cliente actualizado ✅')
    setModal(null)
  }

  const handleToggleActivo = async (cliente) => {
    const { error } = await editCliente(cliente.id_cliente, { activo: !cliente.activo })
    if (error) showToast(error, 'error')
    else showToast(cliente.activo ? 'Cliente desactivado' : 'Cliente activado ✅')
  }

  const filtered = clientes
    .filter(c => filtroActivo === 'todos' || (filtroActivo === 'activos' ? c.activo : !c.activo))
    .filter(c =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.telefono || '').includes(search) ||
      (c.correo || '').toLowerCase().includes(search.toLowerCase())
    )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-subtitle">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} registrado{clientes.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Nuevo cliente
        </button>
      </div>

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Buscar por nombre, telefono o correo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={filtroActivo}
            onChange={e => setFiltroActivo(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>{search ? 'Sin resultados' : 'Sin clientes registrados'}</h3>
            <p>{search ? 'Intenta con otro termino' : 'Haz clic en "+ Nuevo cliente" para comenzar'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Telefono</th>
                  <th>Correo</th>
                  <th>Nivel precio</th>
                  <th>Estado</th>
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id_cliente}>
                    <td data-label="Nombre" style={{ fontWeight: 500 }}>{c.nombre}</td>
                    <td data-label="Telefono">{c.telefono || '—'}</td>
                    <td data-label="Correo" style={{ fontSize: 15 }}>{c.correo || '—'}</td>
                    <td data-label="Nivel precio">
                      {c.nivel_precio ? (
                        <span className="badge badge-blue">{c.nivel_precio.nombre}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>—</span>
                      )}
                    </td>
                    <td data-label="Estado">
                      <span className={`badge ${c.activo ? 'badge-green' : 'badge-gray'}`}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="">
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="btn-icon" title="Editar" onClick={() => setModal({ type: 'edit', data: c })}>✏️</button>
                        <button className="btn-icon" title={c.activo ? 'Desactivar' : 'Activar'} onClick={() => handleToggleActivo(c)}>
                          {c.activo ? '🔕' : '✅'}
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
        <ClienteModal
          cliente={modal.type === 'edit' ? modal.data : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
