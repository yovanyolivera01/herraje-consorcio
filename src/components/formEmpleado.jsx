import { useState, useEffect } from "react"
import { getPuestos } from "../lib/puestos"

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
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        getPuestos().then(setPuestos).catch(() => setPuestos([]))
    }, [])

    const validate = () => {
        const e = {}
        if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
        if (!form.telefono.trim()) e.telefono = 'El teléfono es obligatorio'
        if (!form.apellido_paterno.trim()) e.apellido_paterno = 'El apellido paterno es obligatorio'
        if (!form.id_puesto) e.id_puesto = 'El puesto es obligatorio'
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

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" onClick={e => e.stopPropagation()}>
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
                                    placeholder="Apellido paterno"
                                />
                                {errors.apellido_paterno && <div className="form-error">{errors.apellido_paterno}</div>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Apellido materno</label>
                            <input
                                className="form-input"
                                value={form.apellido_materno}
                                onChange={setTexto('apellido_materno')}
                                placeholder="Apellido materno"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Teléfono</label>
                                <input
                                    className={`form-input${errors.telefono ? ' error' : ''}`}
                                    value={form.telefono}
                                    onChange={set('telefono')}
                                    placeholder="Teléfono"
                                />
                                {errors.telefono && <div className="form-error">{errors.telefono}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Fecha de registro</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={form.fecha_registro}
                                    onChange={set('fecha_registro')}
                                />
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
                                <label className="form-label">Turno</label>
                                <input
                                    type="number" min="1"
                                    className="form-input"
                                    value={form.id_turno}
                                    onChange={set('id_turno')}
                                    placeholder="ID de turno"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Calle</label>
                            <input
                                className="form-input"
                                value={form.calle}
                                onChange={set('calle')}
                                placeholder="Calle y número"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Colonia</label>
                                <input
                                    className="form-input"
                                    value={form.colonia}
                                    onChange={set('colonia')}
                                    placeholder="Colonia"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ciudad</label>
                                <input
                                    className="form-input"
                                    value={form.ciudad}
                                    onChange={set('ciudad')}
                                    placeholder="Ciudad"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">CP</label>
                                <input
                                    className="form-input"
                                    value={form.cp}
                                    onChange={set('cp')}
                                    placeholder="Código postal"
                                />
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
                            <td data-label="Turno">{emp.id_turno}</td>
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
