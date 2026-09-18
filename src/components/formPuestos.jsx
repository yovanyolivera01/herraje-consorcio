import { useState } from "react";


export default function PersonalModal({puestos,onClose,onSave}){

    const[form,setForm] = useState({
        nombre: puestos?.nombre ??'',
        descripcion: puestos?.descripcion ??'',
        plazas: puestos?.plazas ??'',
        salario: puestos?.salario ??'',
        hora_extra: puestos?.hora_extra ??'',
        id_estado: puestos?.id_estado ?? 1,

    })

    const [errors, setErrors] = useState({})

    const [loading, setLoading] =useState(false)
    
    const validate = () =>{
        const e = {}
        if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
        if (!form.descripcion.trim()) e.descripcion = 'La descripción es obligatorio'
        if (!String(form.plazas).trim()) e.plazas = 'Las plazas son obligatorias'
        if (!String(form.salario).trim()) e.salario = 'El salario es obligatorio'
        if (!String(form.hora_extra).trim()) e.hora_extra = 'La hora extra es obligatoria'
        return e
    }


    const handleSubmit = async (ev) => {
        ev.preventDefault()
        const errs = validate()
        if (Object.keys(errs).length) {setErrors(errs);return}
        setLoading(true)
        await onSave(form)
        setLoading(false)
    }
    const set = field => (e) => setForm (f => ({...f,[field]:e.target.value}))

    // quita cualquier digito mientras se escribe — nombre/descripcion no deben llevar numeros
    const setTexto = field => (e) => {
        const val = e.target.value.replace(/[0-9]/g, '')
        setForm(f => ({...f,[field]:val}))
    }

    
    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{puestos ? 'Editar puesto' : 'Nuevo puesto'}</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label required">Nombre</label>
                            <input
                                className={`form-input${errors.nombre ? ' error' : ''}`}
                                value={form.nombre}
                                onChange={setTexto('nombre')}
                                placeholder="Nombre del puesto"
                                autoFocus={!puestos}
                                disabled={!!puestos}
                            />
                            {errors.nombre && <div className="form-error">{errors.nombre}</div>}
                        </div>

                        <div className="form-group">
                            <label className="form-label required">Descripción</label>
                            <input
                                className={`form-input${errors.descripcion ? ' error' : ''}`}
                                value={form.descripcion}
                                onChange={setTexto('descripcion')}
                                placeholder="Descripción del puesto"
                                disabled={!!puestos}
                            />
                            {errors.descripcion && <div className="form-error">{errors.descripcion}</div>}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Plazas</label>
                                <input
                                    type="number" min="1"
                                    className={`form-input${errors.plazas ? ' error' : ''}`}
                                    value={form.plazas}
                                    onChange={set('plazas')}
                                    placeholder="0"
                                />
                                {errors.plazas && <div className="form-error">{errors.plazas}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Salario</label>
                                <input
                                    type="number" min="1" step="1.0"
                                    className={`form-input${errors.salario ? ' error' : ''}`}
                                    value={form.salario}
                                    onChange={set('salario')}
                                    placeholder="$0.00"
                                />
                                {errors.salario && <div className="form-error">{errors.salario}</div>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label required">Hora extra</label>
                            <input
                                type="number" min="1" step="1.0"
                                className={`form-input${errors.hora_extra ? ' error' : ''}`}
                                value={form.hora_extra}
                                onChange={set('hora_extra')}
                                placeholder="$0.00"
                            />
                            {errors.hora_extra && <div className="form-error">{errors.hora_extra}</div>}
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





// Table who show the puestos, with edit and delete buttons
export function PuestosTable({puestos, onEdit, onDelete}) {
    return (
        <div className="table-container">
            <table className="table table-mobile-cards">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Descripción</th>
                        <th>Plazas</th>
                        <th>Salario</th>
                        <th>Hora extra</th>
                        <th style={{ width: 90 }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {puestos.map(p => (
                        <tr key={p.id_puesto}>
                            <td data-label="Nombre" style={{ fontWeight: 500 }}>{p.nombre}</td>
                            <td data-label="Descripción">{p.descripcion}</td>
                            <td data-label="Plazas">{p.plazas}</td>
                            <td data-label="Salario">${Number(p.salario).toFixed(2)}</td>
                            <td data-label="Hora extra">${Number(p.hora_extra).toFixed(2)}</td>
                            <td data-label="">
                                <div style={{ display: 'flex', gap: 2 }}>
                                    <button
                                        className="btn-icon"
                                        title="Editar"
                                        onClick={() => onEdit(p)}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="btn-icon danger"
                                        title="Eliminar"
                                        onClick={() => onDelete(p)}
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







// confirmation modal shown before deleting a puesto, names the puesto being removed
export function ConfirmDeleteModal({ puesto, onClose, onConfirm }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleConfirm = async () => {
        setLoading(true)
        setError(null)
        try {
            await onConfirm(puesto)
        } catch (e) {
            setError(e.message || 'No se pudo eliminar el puesto')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Eliminar puesto</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <p>¿Está seguro de eliminar el puesto <strong>{puesto?.nombre}</strong>? Esta acción no se puede deshacer.</p>
                    {error && <div className="form-error" style={{ marginTop: 10 }}>❌ {error}</div>}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={loading}>
                        {loading ? 'Eliminando...' : 'Eliminar'}
                    </button>
                </div>
            </div>
        </div>
    )
}


// funtion who show the information of the puesto in a modal, with a close button
export function PuestoInfoModal({puesto, onClose}) {

    const fila = (label, valor) => (
        <div className="form-group" style={{ marginBottom: 10 }}>
            <div className="form-label" style={{ marginBottom: 2 }}>{label}</div>
            <div>{valor}</div>
        </div>
    )

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Información del puesto</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <input type="text" className="form-control" value={puesto?.nombre || ''} editOnly />
                    {fila('Descripción', puesto?.descripcion)}
                    {fila('Plazas', puesto?.plazas)}
                    {fila('Salario', `$${Number(puesto?.salario).toFixed(2)}`)}
                    {fila('Hora extra', `$${Number(puesto?.hora_extra).toFixed(2)}`)}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    )

}