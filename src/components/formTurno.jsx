import { useState } from "react";

// Días de la semana en orden ISODOW (1=Lunes ... 7=Domingo), igual que
// dias_laborales en la tabla turno y v_horas_ausencia.
const DIAS = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
    { value: 7, label: 'Dom' },
]

function minutosEntre(inicio, fin) {
    const [h1, m1] = inicio.split(':').map(Number)
    const [h2, m2] = fin.split(':').map(Number)
    return (h2 * 60 + m2) - (h1 * 60 + m1)
}

export default function TurnoModal({ turno, onClose, onSave }) {

    const [form, setForm] = useState({
        hora_inicio: turno?.hora_inicio ?? '',
        hora_fin: turno?.hora_fin ?? '',
        tolerancia: turno?.tolerancia ?? '',
        minutos_comida: turno?.minutos_comida ?? 60,
        dias_laborales: turno?.dias_laborales ?? [1, 2, 3, 4, 5, 6],
    })

    const [errors, setErrors] = useState({})

    const [loading, setLoading] = useState(false)

    const validate = () => {
        const e = {}
        if (!form.hora_inicio) e.hora_inicio = 'La hora de inicio es obligatoria'
        if (!form.hora_fin) e.hora_fin = 'La hora de fin es obligatoria'
        if (form.hora_inicio && form.hora_fin && form.hora_fin <= form.hora_inicio) {
            e.hora_fin = 'La hora de fin debe ser posterior a la hora de inicio'
        }
        if (form.tolerancia === '' || Number(form.tolerancia) < 0) e.tolerancia = 'La tolerancia no puede ser negativa'
        else if (Number(form.tolerancia) > 30) e.tolerancia = 'La tolerancia no puede ser mayor a 30 minutos'
        if (form.minutos_comida === '' || Number(form.minutos_comida) < 0) e.minutos_comida = 'La comida no puede ser negativa'
        else if (form.hora_inicio && form.hora_fin && Number(form.minutos_comida) >= minutosEntre(form.hora_inicio, form.hora_fin)) {
            e.minutos_comida = 'La comida debe ser menor a la duración del turno'
        }
        if (!form.dias_laborales.length) e.dias_laborales = 'Selecciona al menos un día'
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

    // agrega o quita el día del arreglo dias_laborales al hacer click en su botón
    const toggleDia = (dia) => {
        setForm(f => ({
            ...f,
            dias_laborales: f.dias_laborales.includes(dia)
                ? f.dias_laborales.filter(d => d !== dia)
                : [...f.dias_laborales, dia].sort((a, b) => a - b),
        }))
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{turno ? 'Editar turno' : 'Nuevo turno'}</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Hora inicio</label>
                                <input
                                    type="time"
                                    className={`form-input${errors.hora_inicio ? ' error' : ''}`}
                                    value={form.hora_inicio}
                                    onChange={set('hora_inicio')}
                                />
                                {errors.hora_inicio && <div className="form-error">{errors.hora_inicio}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Hora fin</label>
                                <input
                                    type="time"
                                    className={`form-input${errors.hora_fin ? ' error' : ''}`}
                                    value={form.hora_fin}
                                    onChange={set('hora_fin')}
                                />
                                {errors.hora_fin && <div className="form-error">{errors.hora_fin}</div>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label required">Tolerancia (minutos)</label>
                            <input
                                type="number"
                                className={`form-input${errors.tolerancia ? ' error' : ''}`}
                                value={form.tolerancia}
                                onChange={set('tolerancia')}
                                placeholder="0"
                            />
                            {errors.tolerancia && <div className="form-error">{errors.tolerancia}</div>}
                        </div>

                        <div className="form-group">
                            <label className="form-label required">Tiempo de comida (minutos)</label>
                            <input
                                type="number"
                                className={`form-input${errors.minutos_comida ? ' error' : ''}`}
                                value={form.minutos_comida}
                                onChange={set('minutos_comida')}
                                placeholder="60"
                            />
                            {errors.minutos_comida && <div className="form-error">{errors.minutos_comida}</div>}
                        </div>

                        <div className="form-group">
                            <label className="form-label required">Días laborales</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {DIAS.map(dia => {
                                    const activo = form.dias_laborales.includes(dia.value)
                                    return (
                                        <button
                                            key={dia.value}
                                            type="button"
                                            className={`btn ${activo ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => toggleDia(dia.value)}
                                            aria-pressed={activo}
                                        >
                                            {dia.label}
                                        </button>
                                    )
                                })}
                            </div>
                            {errors.dias_laborales && <div className="form-error">{errors.dias_laborales}</div>}
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

const diaLabel = (n) => DIAS.find(d => d.value === n)?.label ?? n

// Table who show the turnos, with the days each one applies
export function TurnosTable({ turnos }) {
    return (
        <div className="table-container">
            <table className="table table-mobile-cards">
                <thead>
                    <tr>
                        <th>Hora inicio</th>
                        <th>Hora fin</th>
                        <th>Tolerancia</th>
                        <th>Comida</th>
                        <th>Días laborales</th>
                    </tr>
                </thead>
                <tbody>
                    {turnos.map(t => (
                        <tr key={t.id_turno}>
                            <td data-label="Hora inicio" style={{ fontWeight: 500 }}>{t.hora_inicio}</td>
                            <td data-label="Hora fin">{t.hora_fin}</td>
                            <td data-label="Tolerancia">{t.tolerancia} min</td>
                            <td data-label="Comida">{t.minutos_comida ?? 60} min</td>
                            <td data-label="Días laborales">{(t.dias_laborales ?? []).map(diaLabel).join(', ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
