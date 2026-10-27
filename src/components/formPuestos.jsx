import { useState } from "react";

// Largo permitido del nombre y la descripción del puesto
const NOMBRE_MIN = 2
const NOMBRE_MAX = 20
const DESCRIPCION_MAX = 30
const NUMERO_MAX_DIGITOS = 5 // plazas, salario y hora extra

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
        const nombre = form.nombre.trim()
        if (!nombre) e.nombre = 'El nombre es obligatorio'
        else if (nombre.length < NOMBRE_MIN) e.nombre = `El nombre debe tener al menos ${NOMBRE_MIN} caracteres`
        else if (nombre.length > NOMBRE_MAX) e.nombre = `El nombre no puede pasar de ${NOMBRE_MAX} caracteres`
        if (!form.descripcion.trim()) e.descripcion = 'La descripción es obligatoria'
        else if (form.descripcion.trim().length > DESCRIPCION_MAX) e.descripcion = `La descripción no puede pasar de ${DESCRIPCION_MAX} caracteres`
        const numero = (campo, vacio, etiqueta) => {
            const v = String(form[campo]).trim()
            if (!v) e[campo] = vacio
            else if (!/^\d+$/.test(v) || Number(v) < 1) e[campo] = `${etiqueta} debe ser un número mayor a 0`
            else if (v.length > NUMERO_MAX_DIGITOS) e[campo] = `${etiqueta} no puede pasar de ${NUMERO_MAX_DIGITOS} dígitos`
        }
        numero('plazas', 'Las plazas son obligatorias', 'Las plazas')
        numero('salario', 'El salario es obligatorio', 'El salario')
        numero('hora_extra', 'La hora extra es obligatoria', 'La hora extra')
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

    // solo dígitos, máximo NUMERO_MAX_DIGITOS: sin signo menos, punto ni letras
    const setNumero = field => (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, NUMERO_MAX_DIGITOS)
        setForm(f => ({...f,[field]:val}))
    }

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
                                maxLength={NOMBRE_MAX}
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
                                maxLength={DESCRIPCION_MAX}
                                placeholder="Descripción del puesto"
                                disabled={!!puestos}
                            />
                            {errors.descripcion && <div className="form-error">{errors.descripcion}</div>}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Plazas</label>
                                <input
                                    inputMode="numeric"
                                    className={`form-input${errors.plazas ? ' error' : ''}`}
                                    value={form.plazas}
                                    onChange={setNumero('plazas')}
                                    placeholder="0"
                                />
                                {errors.plazas && <div className="form-error">{errors.plazas}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Salario</label>
                                <input
                                    inputMode="numeric"
                                    className={`form-input${errors.salario ? ' error' : ''}`}
                                    value={form.salario}
                                    onChange={setNumero('salario')}
                                    placeholder="$0.00"
                                />
                                {errors.salario && <div className="form-error">{errors.salario}</div>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label required">Hora extra</label>
                            <input
                                inputMode="numeric"
                                className={`form-input${errors.hora_extra ? ' error' : ''}`}
                                value={form.hora_extra}
                                onChange={setNumero('hora_extra')}
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