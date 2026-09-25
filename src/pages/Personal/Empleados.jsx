import { useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import EmpleadoModal from '../../components/formEmpleado'

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

  const handleSave = async (form) => {
    const fn = modal.type === 'create'
      ? () => addEmpleado(form)
      : () => editEmpleado(modal.data.empleado_id, form)

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
