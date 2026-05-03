import React, { useState } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Modal Crear/Editar Empresa ────────────────────────────────────────────
function EmpresaModal({ empresa, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre:       empresa?.nombre       ?? '',
    razon_social: empresa?.razon_social ?? '',
    rfc:          empresa?.rfc          ?? '',
    correo:       empresa?.correo       ?? '',
    telefono:     empresa?.telefono     ?? '',
    direccion:    empresa?.direccion    ?? '',
  })
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo))
      e.correo = 'Correo no valido'
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    await onSave({
      nombre:       form.nombre.trim(),
      razon_social: form.razon_social.trim() || null,
      rfc:          form.rfc.trim()          || null,
      correo:       form.correo.trim()       || null,
      telefono:     form.telefono.trim()     || null,
      direccion:    form.direccion.trim()    || null,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{empresa ? 'Editar empresa' : 'Nueva empresa'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Nombre / Razon social</label>
              <input
                className={`form-input${errors.nombre ? ' error' : ''}`}
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Nombre de la empresa"
                autoFocus
              />
              {errors.nombre && <div className="form-error">{errors.nombre}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Razon social</label>
              <input
                className="form-input"
                value={form.razon_social}
                onChange={set('razon_social')}
                placeholder="Razon social (si difiere del nombre)"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">RFC</label>
                <input
                  className="form-input"
                  value={form.rfc}
                  onChange={set('rfc')}
                  placeholder="RFC de la empresa"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telefono</label>
                <input
                  className="form-input"
                  value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '') }))}
                  placeholder="55 1234-5678"
                  inputMode="tel"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Correo</label>
                <input
                  className={`form-input${errors.correo ? ' error' : ''}`}
                  type="email"
                  value={form.correo}
                  onChange={set('correo')}
                  placeholder="correo@empresa.com"
                />
                {errors.correo && <div className="form-error">{errors.correo}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Direccion</label>
                <input
                  className="form-input"
                  value={form.direccion}
                  onChange={set('direccion')}
                  placeholder="Calle, colonia, ciudad"
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : empresa ? 'Guardar cambios' : 'Registrar empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Celda de precio inline editable ──────────────────────────────────────
function PrecioInline({ precioActual, onGuardar, saving }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState('')
  const inputRef = React.useRef(null)

  const abrir = () => {
    setValue(precioActual != null ? String(precioActual) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }
  const cancelar = () => setEditing(false)
  const guardar  = () => {
    const n = parseFloat(value)
    if (!isNaN(n) && n >= 0) onGuardar(n)
    setEditing(false)
  }

  if (saving) return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>...</span>

  if (editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        ref={inputRef}
        type="number" min="0" step="0.01"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') cancelar() }}
        style={{ width: 80, border: '1.5px solid var(--accent)', borderRadius: 5, padding: '3px 6px', fontSize: 13, fontFamily: 'inherit' }}
      />
      <button onClick={guardar}  style={{ padding: '3px 7px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✓</button>
      <button onClick={cancelar} style={{ padding: '3px 7px', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>✕</button>
    </div>
  )

  return (
    <span
      onClick={abrir}
      onTouchEnd={e => { e.preventDefault(); abrir() }}
      style={{ cursor: 'pointer', fontSize: 13, color: precioActual != null ? 'var(--text)' : 'var(--text-muted)', userSelect: 'none' }}
      title="Toca para editar"
    >
      {precioActual != null ? `$${Number(precioActual).toFixed(2)}` : '— agregar'}
    </span>
  )
}

// ── Modal Precios agrupados por tipo de vidrio ─────────────────────────────
function PreciosModal({ titulo, precios: preciosIniciales, onGuardar, onClose }) {
  const { tiposVidrio, procesos } = useCotizacion()
  const [precios,  setPrecios]  = useState(preciosIniciales)
  const [saving,   setSaving]   = useState(null)
  const [toast,    setToast]    = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2000)
  }

  const getPrecio = (id_tipo_vidrio, id_proceso) =>
    precios.find(p => p.id_tipo_vidrio === id_tipo_vidrio && (p.id_proceso ?? null) === (id_proceso ?? null))?.precio_m2 ?? null

  const handleGuardar = async (id_tipo_vidrio, id_proceso, num) => {
    const key = `${id_tipo_vidrio}-${id_proceso ?? 'v'}`
    setSaving(key)
    const { error, data } = await onGuardar(id_tipo_vidrio, id_proceso, num)
    setSaving(null)
    if (error) { showToast(error, 'error'); return }
    setPrecios(prev => {
      const siguiente = prev.filter(p => !(p.id_tipo_vidrio === id_tipo_vidrio && (p.id_proceso ?? null) === (id_proceso ?? null)))
      return [...siguiente, { id_tipo_vidrio, id_proceso: id_proceso ?? null, precio_m2: num }]
    })
    showToast('Guardado ✅')
  }

  const tiposActivos  = tiposVidrio.filter(t => t.activo)
  const procesosActivos = procesos.filter(p => p.activo)

  const tiposFiltrados = tiposActivos.filter(t =>
    !busqueda ||
    t.clave.toLowerCase().includes(busqueda.toLowerCase()) ||
    (t.tono?.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (t.espesor?.etiqueta || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680, width: '98vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{titulo}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '10px 16px 0', borderBottom: '1px solid var(--border)' }}>
          {toast && <div className={`alert alert-${toast.type}`} style={{ marginBottom: 8 }}>{toast.msg}</div>}
          <input
            className="form-input"
            placeholder="Buscar tipo de vidrio..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ marginBottom: 10 }}
          />
        </div>

        <div style={{ maxHeight: '62vh', overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tiposFiltrados.map(tipo => {
            const tieneAlgunPrecio = getPrecio(tipo.id_tipo_vidrio, null) != null ||
              procesosActivos.some(p => getPrecio(tipo.id_tipo_vidrio, p.id_proceso) != null)
            return (
              <div key={tipo.id_tipo_vidrio} className="card" style={{ padding: '10px 14px' }}>
                {/* Cabecera del tipo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="badge badge-blue">{tipo.clave}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {tipo.tono?.nombre} / {tipo.espesor?.etiqueta}
                  </span>
                  {tieneAlgunPrecio && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>✓ configurado</span>}
                </div>

                {/* Fila: solo vidrio */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: procesosActivos.length ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Solo vidrio ($/m²)</span>
                  <PrecioInline
                    precioActual={getPrecio(tipo.id_tipo_vidrio, null)}
                    saving={saving === `${tipo.id_tipo_vidrio}-v`}
                    onGuardar={n => handleGuardar(tipo.id_tipo_vidrio, null, n)}
                  />
                </div>

                {/* Filas: procesos */}
                {procesosActivos.map((proc, idx) => (
                  <div
                    key={proc.id_proceso}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px 0',
                      borderBottom: idx < procesosActivos.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 10 }}>+ {proc.nombre}</span>
                    <PrecioInline
                      precioActual={getPrecio(tipo.id_tipo_vidrio, proc.id_proceso)}
                      saving={saving === `${tipo.id_tipo_vidrio}-${proc.id_proceso}`}
                      onGuardar={n => handleGuardar(tipo.id_tipo_vidrio, proc.id_proceso, n)}
                    />
                  </div>
                ))}
              </div>
            )
          })}
          {tiposFiltrados.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin resultados</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Wrapper para empresa ──────────────────────────────────────────────────
function PreciosEmpresaModal({ empresa, onClose }) {
  const { getPreciosEmpresa, guardarPrecioEmpresa } = useCotizacion()
  const [precios, setPrecios] = useState(null)

  const cargar = async () => {
    const data = await getPreciosEmpresa(empresa.id_empresa)
    setPrecios(data)
  }

  if (precios === null) { cargar(); return null }

  const handleGuardar = async (id_tipo_vidrio, id_proceso, precio_m2) => {
    return guardarPrecioEmpresa({ id_empresa: empresa.id_empresa, id_tipo_vidrio, id_proceso, precio_m2 })
  }

  return (
    <PreciosModal
      titulo={`Precios — ${empresa.nombre}`}
      precios={precios}
      onGuardar={handleGuardar}
      onClose={onClose}
    />
  )
}

// ── Pagina Empresas ───────────────────────────────────────────────────────
export default function Empresas() {
  const { empresas, addEmpresa, editEmpresa } = useCotizacion()
  const [modal,  setModal]  = useState(null)
  const [toast,  setToast]  = useState(null)
  const [search, setSearch] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async (form) => {
    const { error } = modal.type === 'create'
      ? await addEmpresa(form)
      : await editEmpresa(modal.data.id_empresa, form)
    if (error) { showToast(error, 'error'); return }
    showToast(modal.type === 'create' ? 'Empresa registrada ✅' : 'Empresa actualizada ✅')
    setModal(null)
  }

  const handleToggleActivo = async (emp) => {
    const { error } = await editEmpresa(emp.id_empresa, { activo: !emp.activo })
    if (error) showToast(error, 'error')
    else showToast(emp.activo ? 'Empresa desactivada' : 'Empresa activada ✅')
  }

  const filtered = empresas.filter(em =>
    em.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (em.rfc || '').toLowerCase().includes(search.toLowerCase()) ||
    (em.razon_social || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Empresas</div>
          <div className="page-subtitle">{empresas.length} empresa{empresas.length !== 1 ? 's' : ''} registrada{empresas.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Nueva empresa
        </button>
      </div>

      <div className="page-body">
        {toast && <div className={`alert alert-${toast.type}`}>{toast.msg}</div>}

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Buscar por nombre, RFC o contacto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <h3>{search ? 'Sin resultados' : 'Sin empresas registradas'}</h3>
            <p>{search ? 'Intenta con otro termino' : 'Haz clic en "+ Nueva empresa" para comenzar'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table table-mobile-cards">
              <thead>
                <tr>
                  <th>Nombre / Razon social</th>
                  <th>RFC</th>
                  <th>Telefono</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th style={{ width: 110 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(em => (
                  <tr key={em.id_empresa}>
                    <td data-label="Nombre" style={{ fontWeight: 500 }}>{em.nombre}</td>
                    <td data-label="RFC" style={{ fontSize: 14 }}>{em.rfc || '—'}</td>
                    <td data-label="Telefono">{em.telefono || '—'}</td>
                    <td data-label="Correo" style={{ fontSize: 14 }}>{em.correo || '—'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${em.activo ? 'badge-green' : 'badge-gray'}`}>
                        {em.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td data-label="">
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="btn-icon" title="Editar" onClick={() => setModal({ type: 'edit', data: em })}>✏️</button>
                        <button className="btn-icon" title="Precios especiales" onClick={() => setModal({ type: 'precios', data: em })}>💲</button>
                        <button className="btn-icon" title={em.activo ? 'Desactivar' : 'Activar'} onClick={() => handleToggleActivo(em)}>
                          {em.activo ? '🔕' : '✅'}
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
        <EmpresaModal
          empresa={modal.type === 'edit' ? modal.data : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {modal?.type === 'precios' && (
        <PreciosEmpresaModal
          empresa={modal.data}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
