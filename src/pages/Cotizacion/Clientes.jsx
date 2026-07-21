import React, { useState } from 'react'
import { useCotizacion } from '../../context/CotizacionContext'

// ── Modal Crear/Editar Cliente ────────────────────────────────────────────
function ClienteModal({ cliente, onClose, onSave }) {
  const { nivelesPrecio } = useCotizacion()
  const vidrieroId = nivelesPrecio.find(n => n.nombre.toLowerCase().includes('vidriero'))?.id_nivel_precio ?? ''
  const [form, setForm] = useState({
    nombre:          cliente?.nombre           ?? '',
    telefono:        cliente?.telefono         ?? '',
    correo:          cliente?.correo           ?? '',
    id_nivel_precio: cliente?.id_nivel_precio  ?? vidrieroId,
    rfc:             cliente?.rfc              ?? '',
    razon_social:    cliente?.razon_social     ?? '',
    cp_fiscal:       cliente?.cp_fiscal        ?? '',
    regimen_fiscal:  cliente?.regimen_fiscal   ?? '',
    uso_cfdi:        cliente?.uso_cfdi         ?? '',
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
      telefono:        form.telefono.trim()       || null,
      correo:          form.correo.trim()         || null,
      id_nivel_precio: form.id_nivel_precio ? Number(form.id_nivel_precio) : null,
      rfc:             form.rfc.trim().toUpperCase()           || null,
      razon_social:    form.razon_social.trim().toUpperCase()  || null,
      cp_fiscal:       form.cp_fiscal.trim()                   || null,
      regimen_fiscal:  form.regimen_fiscal                     || null,
      uso_cfdi:        form.uso_cfdi                           || null,
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

            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0 14px', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                Datos de facturación (opcional)
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">RFC</label>
                  <input
                    className="form-input"
                    value={form.rfc}
                    onChange={e => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                    placeholder="XAXX010101000"
                    maxLength={15}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">C.P. fiscal</label>
                  <input
                    className="form-input"
                    value={form.cp_fiscal}
                    onChange={set('cp_fiscal')}
                    placeholder="00000"
                    maxLength={5}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Razón social</label>
                <input
                  className="form-input"
                  value={form.razon_social}
                  onChange={e => setForm(f => ({ ...f, razon_social: e.target.value.toUpperCase() }))}
                  placeholder="NOMBRE O RAZÓN SOCIAL"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Régimen fiscal</label>
                  <select className="form-select" value={form.regimen_fiscal} onChange={set('regimen_fiscal')}>
                    <option value="">-- Seleccionar --</option>
                    <option value="601">601 - Personas Morales</option>
                    <option value="603">603 - Personas Morales sin fines de lucro</option>
                    <option value="605">605 - Sueldos y Salarios</option>
                    <option value="606">606 - Arrendamiento</option>
                    <option value="608">608 - Demás ingresos</option>
                    <option value="612">612 - Actividades Empresariales</option>
                    <option value="616">616 - Sin obligaciones fiscales</option>
                    <option value="621">621 - Incorporación Fiscal</option>
                    <option value="626">626 - Régimen Simplificado de Confianza</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Uso CFDI</label>
                  <select className="form-select" value={form.uso_cfdi} onChange={set('uso_cfdi')}>
                    <option value="">-- Seleccionar --</option>
                    <option value="G01">G01 - Adquisición de mercancias</option>
                    <option value="G02">G02 - Devoluciones o bonificaciones</option>
                    <option value="G03">G03 - Gastos en general</option>
                    <option value="I01">I01 - Construcciones</option>
                    <option value="I03">I03 - Equipo de transporte</option>
                    <option value="I04">I04 - Equipo de cómputo</option>
                    <option value="P01">P01 - Por definir</option>
                    <option value="S01">S01 - Sin efectos fiscales</option>
                  </select>
                </div>
              </div>
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

// ── Modal vincular cliente a empresa ─────────────────────────────────────
function VincularEmpresaModal({ cliente, onClose, onSave }) {
  const { empresas } = useCotizacion()
  const [empresaId, setEmpresaId] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!empresaId) return
    setSaving(true)
    await onSave(cliente.id_cliente, Number(empresaId))
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Vincular empresa — {cliente.nombre}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label required">Empresa</label>
              <select className="form-select" value={empresaId} onChange={e => setEmpresaId(e.target.value)} autoFocus>
                <option value="">-- Seleccionar empresa --</option>
                {empresas.filter(e => e.activo).map(e => (
                  <option key={e.id_empresa} value={e.id_empresa}>{e.nombre}</option>
                ))}
              </select>
              <div className="form-hint">Sustituye cualquier vinculacion anterior</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !empresaId}>
              {saving ? 'Vinculando...' : 'Vincular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Celda precio inline (reutilizable) ───────────────────────────────────
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

// ── Modal precios cliente registrado ─────────────────────────────────────
function PreciosClienteModal({ cliente, onClose }) {
  const { tiposVidrio, procesos, getPreciosClienteRegistrado, guardarPrecioClienteRegistrado } = useCotizacion()
  const [precios,  setPrecios]  = useState(null)
  const [saving,   setSaving]   = useState(null)
  const [toast,    setToast]    = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2000)
  }

  const cargar = async () => {
    const data = await getPreciosClienteRegistrado(cliente.id_cliente)
    setPrecios(data)
  }

  if (precios === null) { cargar(); return null }

  const getPrecioVidrio = (id_tipo_vidrio) =>
    precios.find(p => p.id_tipo_vidrio === id_tipo_vidrio && (p.id_proceso ?? null) === null)?.precio_m2 ?? null

  const getPrecioProceso = (id_proceso) =>
    precios.find(p => (p.id_tipo_vidrio ?? null) === null && p.id_proceso === id_proceso)?.precio_m2 ?? null

  const handleGuardar = async (id_tipo_vidrio, id_proceso, precio_m2) => {
    const key = id_tipo_vidrio != null ? `v-${id_tipo_vidrio}` : `p-${id_proceso}`
    setSaving(key)
    const res = await guardarPrecioClienteRegistrado({ id_cliente: cliente.id_cliente, id_tipo_vidrio, id_proceso, precio_m2 })
    setSaving(null)
    if (res.error) { showToast(res.error, 'error'); return res }
    setPrecios(prev => {
      const sig = prev.filter(p => !(
        (p.id_tipo_vidrio ?? null) === (id_tipo_vidrio ?? null) &&
        (p.id_proceso ?? null) === (id_proceso ?? null)
      ))
      return [...sig, { id_tipo_vidrio: id_tipo_vidrio ?? null, id_proceso: id_proceso ?? null, precio_m2 }]
    })
    showToast('Guardado ✅')
    return res
  }

  const tiposActivos  = tiposVidrio.filter(t => t.activo)
  const procesosGrupo = procesos.filter(p => p.activo && (!p.tipo || p.tipo === 'PROCESO'))
  const barrenosGrupo = procesos.filter(p => p.activo && p.tipo === 'BARRENO')
  const saquesGrupo   = procesos.filter(p => p.activo && p.tipo === 'SAQUE')

  const tiposFiltrados = tiposActivos.filter(t =>
    !busqueda ||
    t.clave.toLowerCase().includes(busqueda.toLowerCase()) ||
    (t.tono?.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (t.espesor?.etiqueta || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const secH = {
    fontSize: 11, fontWeight: 700, color: 'var(--accent)',
    textTransform: 'uppercase', letterSpacing: 0.8,
    padding: '10px 0 6px', marginTop: 6, borderTop: '1px solid var(--border)',
  }
  const fila = (keyVal, badge, label, precioActual, savingKey, onGuardar) => (
    <div key={keyVal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {badge && <span className="badge badge-blue" style={{ fontSize: 11 }}>{badge}</span>}
        <span style={{ fontSize: 13 }}>{label}</span>
      </div>
      <PrecioInline precioActual={precioActual} saving={saving === savingKey} onGuardar={onGuardar} />
    </div>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620, width: '98vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Precios especiales — {cliente.nombre}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {toast && <div style={{ padding: '8px 16px 0' }}><div className={`alert alert-${toast.type}`}>{toast.msg}</div></div>}

        <div style={{ maxHeight: '66vh', overflowY: 'auto', padding: '0 16px 12px' }}>

          <div style={{ ...secH, borderTop: 'none', marginTop: 8 }}>Precio de vidrio ($/m²)</div>
          <input
            className="form-input"
            placeholder="Buscar tipo de vidrio..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ marginBottom: 6, fontSize: 13 }}
          />
          {tiposFiltrados.map(tipo =>
            fila(
              tipo.id_tipo_vidrio,
              tipo.clave,
              `${tipo.tono?.nombre || ''} / ${tipo.espesor?.etiqueta || ''}`,
              getPrecioVidrio(tipo.id_tipo_vidrio),
              `v-${tipo.id_tipo_vidrio}`,
              n => handleGuardar(tipo.id_tipo_vidrio, null, n),
            )
          )}
          {tiposFiltrados.length === 0 && busqueda && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '8px 0', fontSize: 13 }}>Sin resultados</div>
          )}

          {procesosGrupo.length > 0 && (
            <>
              <div style={secH}>Precio de procesos</div>
              {procesosGrupo.map(proc =>
                fila(proc.id_proceso, null, proc.nombre, getPrecioProceso(proc.id_proceso), `p-${proc.id_proceso}`, n => handleGuardar(null, proc.id_proceso, n))
              )}
            </>
          )}

          {barrenosGrupo.length > 0 && (
            <>
              <div style={secH}>Precio de barrenos</div>
              {barrenosGrupo.map(proc =>
                fila(proc.id_proceso, null, proc.nombre, getPrecioProceso(proc.id_proceso), `p-${proc.id_proceso}`, n => handleGuardar(null, proc.id_proceso, n))
              )}
            </>
          )}

          {saquesGrupo.length > 0 && (
            <>
              <div style={secH}>Precio de saques</div>
              {saquesGrupo.map(proc =>
                fila(proc.id_proceso, null, proc.nombre, getPrecioProceso(proc.id_proceso), `p-${proc.id_proceso}`, n => handleGuardar(null, proc.id_proceso, n))
              )}
            </>
          )}

        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Pagina Clientes ───────────────────────────────────────────────────────
export default function Clientes() {
  const { clientes, addCliente, editCliente, vincularClienteEmpresa } = useCotizacion()
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

  const handleVincularEmpresa = async (id_cliente, id_empresa) => {
    const { error } = await vincularClienteEmpresa(id_cliente, id_empresa)
    if (error) showToast(error, 'error')
    else { showToast('Cliente vinculado a empresa ✅'); setModal(null) }
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
                        <button className="btn-icon" title="Precios especiales" onClick={() => setModal({ type: 'precios', data: c })}>💲</button>
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

      {modal?.type === 'vincular' && (
        <VincularEmpresaModal
          cliente={modal.data}
          onClose={() => setModal(null)}
          onSave={handleVincularEmpresa}
        />
      )}

      {modal?.type === 'precios' && (
        <PreciosClienteModal
          cliente={modal.data}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
