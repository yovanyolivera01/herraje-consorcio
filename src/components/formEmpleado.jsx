import { useState, useEffect } from "react"
import { getPuestos } from "../lib/puestos"
import { getTurnos, descripcionTurno } from "../lib/turno"

// Largo permitido de nombre y apellidos (máximo 15 caracteres)
const NOMBRE_MIN = 2
const NOMBRE_MAX = 15

// Largo máximo de la dirección
const DIRECCION_MAX = { calle: 30, colonia: 20, ciudad: 20 }

export default function EmpleadoModal({ empleado, onClose, onSave }) {

    const [form, setForm] = useState({
        empleado_id: empleado?.empleado_id ?? null,
        nombre: empleado?.nombre ?? '',
        telefono: empleado?.telefono ?? '',
        fecha_registro: empleado?.fecha_registro?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        apellido_materno: empleado?.apellido_materno ?? '',
        apellido_paterno: empleado?.apellido_paterno ?? '',
        id_puesto: empleado?.id_puesto ?? '',
        id_turno: empleado?.id_turno ?? '',
        calle: empleado?.calle ?? '',
        ciudad: empleado?.ciudad ?? '',
        colonia: empleado?.colonia ?? '',
        cp: empleado?.cp ?? '',
        id_estado: empleado?.id_estado ?? 1,
    })

    const [puestos, setPuestos] = useState([])
    const [turnos, setTurnos] = useState([])
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        getPuestos().then(setPuestos).catch(() => setPuestos([]))
        getTurnos().then(setTurnos).catch(() => setTurnos([]))
    }, [])

    const validate = () => {
        const e = {}
        const largo = (valor, etiqueta, obligatorio) => {
            const v = valor.trim()
            if (!v) return obligatorio ? `${etiqueta} es obligatorio` : null
            if (v.length < NOMBRE_MIN) return `${etiqueta} debe tener al menos ${NOMBRE_MIN} caracteres`
            if (v.length > NOMBRE_MAX) return `${etiqueta} no puede pasar de ${NOMBRE_MAX} caracteres`
            return null
        }
        const eNombre = largo(form.nombre, 'El nombre', true)
        if (eNombre) e.nombre = eNombre
        const eMaterno = largo(form.apellido_materno, 'El apellido materno', false)
        if (eMaterno) e.apellido_materno = eMaterno
        if (!form.telefono.trim()) e.telefono = 'El teléfono es obligatorio'
        else if (!/^\d{10}$/.test(form.telefono)) e.telefono = 'El teléfono debe tener 10 dígitos'
        const ePaterno = largo(form.apellido_paterno, 'El apellido paterno', true)
        if (ePaterno) e.apellido_paterno = ePaterno
        if (!form.id_puesto) e.id_puesto = 'El puesto es obligatorio'
        if (!form.id_turno) e.id_turno = 'El turno es obligatorio'
        for (const [campo, etiqueta] of [['calle', 'La calle'], ['colonia', 'La colonia'], ['ciudad', 'La ciudad']]) {
            if (form[campo].trim().length > DIRECCION_MAX[campo]) e[campo] = `${etiqueta} no puede pasar de ${DIRECCION_MAX[campo]} caracteres`
        }
        if (form.cp && !/^\d{5}$/.test(form.cp)) e.cp = 'El código postal debe tener 5 dígitos'
        
        return e
    }

    const handleSubmit = async (ev) => {
        ev.preventDefault()
        const errs = validate()
        if (Object.keys(errs).length) { setErrors(errs); return }
        setLoading(true)
        await onSave(form)
        setLoading(false)
    }

    const set = field => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

    // quita cualquier digito mientras se escribe — nombre/apellidos no deben llevar numeros
    const setTexto = field => (e) => {
        const val = e.target.value.replace(/[0-9]/g, '')
        setForm(f => ({ ...f, [field]: val }))
    }

    // solo digitos — el teléfono no admite letras ni símbolos
    const setNumero = field => (e) => {
        const val = e.target.value.replace(/\D/g, '')
        setForm(f => ({ ...f, [field]: val }))
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: 760, width: '100%' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{empleado ? 'Editar empleado' : 'Nuevo empleado'}</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Nombre</label>
                                <input
                                    className={`form-input${errors.nombre ? ' error' : ''}`}
                                    value={form.nombre}
                                    onChange={setTexto('nombre')}
                                    maxLength={NOMBRE_MAX}
                                    placeholder="Nombre"
                                    autoFocus={!empleado}
                                />
                                {errors.nombre && <div className="form-error">{errors.nombre}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Apellido paterno</label>
                                <input
                                    className={`form-input${errors.apellido_paterno ? ' error' : ''}`}
                                    value={form.apellido_paterno}
                                    onChange={setTexto('apellido_paterno')}
                                    maxLength={NOMBRE_MAX}
                                    placeholder="Apellido paterno"
                                />
                                {errors.apellido_paterno && <div className="form-error">{errors.apellido_paterno}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Apellido materno</label>
                                <input
                                    className={`form-input${errors.apellido_materno ? ' error' : ''}`}
                                    value={form.apellido_materno}
                                    onChange={setTexto('apellido_materno')}
                                    maxLength={NOMBRE_MAX}
                                    placeholder="Apellido materno"
                                />
                                {errors.apellido_materno && <div className="form-error">{errors.apellido_materno}</div>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Teléfono</label>
                                <input
                                    className={`form-input${errors.telefono ? ' error' : ''}`}
                                    value={form.telefono}
                                    onChange={setNumero('telefono')}
                                    placeholder="Teléfono"
                                    inputMode="numeric"
                                    maxLength={10}
                                />
                                {errors.telefono && <div className="form-error">{errors.telefono}</div>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Puesto</label>
                                <select
                                    className={`form-input${errors.id_puesto ? ' error' : ''}`}
                                    value={form.id_puesto}
                                    onChange={set('id_puesto')}
                                >
                                    <option value="">Selecciona un puesto</option>
                                    {puestos.map(p => (
                                        <option key={p.id_puesto} value={p.id_puesto}>{p.nombre}</option>
                                    ))}
                                </select>
                                {errors.id_puesto && <div className="form-error">{errors.id_puesto}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Turno</label>
                                <select
                                    className={`form-input${errors.id_turno ? ' error' : ''}`}
                                    value={form.id_turno}
                                    onChange={set('id_turno')}
                                >
                                    <option value="">Selecciona un turno</option>
                                    {turnos.map(t => (
                                        <option key={t.id_turno} value={t.id_turno}>{descripcionTurno(t)}</option>
                                    ))}
                                </select>
                                {errors.id_turno && <div className="form-error">{errors.id_turno}</div>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Calle</label>
                            <input
                                className={`form-input${errors.calle ? ' error' : ''}`}
                                value={form.calle}
                                onChange={set('calle')}
                                maxLength={DIRECCION_MAX.calle}
                                placeholder="Calle y número"
                            />
                                {errors.calle && <div className="form-error">{errors.calle}</div>}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Colonia</label>
                                <input
                                    className={`form-input${errors.colonia ? ' error' : ''}`}
                                    value={form.colonia}
                                    onChange={set('colonia')}
                                    maxLength={DIRECCION_MAX.colonia}
                                    placeholder="Colonia"
                                />
                                {errors.colonia && <div className="form-error">{errors.colonia}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ciudad</label>
                                <input
                                    className={`form-input${errors.ciudad ? ' error' : ''}`}
                                    value={form.ciudad}
                                    onChange={set('ciudad')}
                                    maxLength={DIRECCION_MAX.ciudad}
                                    placeholder="Ciudad"
                                />
                                {errors.ciudad && <div className="form-error">{errors.ciudad}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">CP</label>
                                <input
                                    className={`form-input${errors.cp ? ' error' : ''}`}
                                    value={form.cp}
                                    onChange={setNumero('cp')}
                                    placeholder="Código postal"
                                    inputMode="numeric"
                                    maxLength={5}
                                />
                                {errors.cp && <div className="form-error">{errors.cp}</div>}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}


// Table who show the empleados, with edit and delete buttons
export function EmpleadosTable({ empleados, onEdit, onDelete }) {
    const [turnos, setTurnos] = useState([])
    useEffect(() => { getTurnos().then(setTurnos).catch(() => setTurnos([])) }, [])
    const textoTurno = (id) => {
        const t = turnos.find(x => x.id_turno === id)
        return t ? descripcionTurno(t) : (id ?? '—')
    }

    return (
        <div className="table-container">
            <table className="table table-mobile-cards">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Teléfono</th>
                        <th>Puesto</th>
                        <th>Turno</th>
                        <th style={{ width: 90 }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {empleados.map(emp => (
                        <tr key={emp.empleado_id}>
                            <td data-label="Nombre" style={{ fontWeight: 500 }}>
                                {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno}
                            </td>
                            <td data-label="Teléfono">{emp.telefono}</td>
                            <td data-label="Puesto">{emp.id_puesto}</td>
                            <td data-label="Turno">{textoTurno(emp.id_turno)}</td>
                            <td data-label="">
                                <div style={{ display: 'flex', gap: 2 }}>
                                    <button
                                        className="btn-icon"
                                        title="Editar"
                                        onClick={() => onEdit(emp)}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="btn-icon danger"
                                        title="Eliminar"
                                        onClick={() => onDelete(emp)}
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
    )
}
