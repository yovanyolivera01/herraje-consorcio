import { useEffect, useState } from 'react'
import { getMetodosPago } from '../lib/cotizacionApi'
import { crearAnticipoPedido, getAnticipoPedido } from '../lib/anticipoPedido'

const fmt = n => Number(n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

// Registra un abono (anticipo) a un pedido.
// pedido: { id_pedido, id_cliente, folio? }
// onSaved(id_anticipo) se llama despues de guardar, para que el padre recargue su lista.
export default function ModalAnticipoPedido({ pedido, onClose, onSaved }) {

    const [form, setForm] = useState({
        id_metodo_pago: '',
        monto: '',
        fecha_hora: '',
        referencia: '',
        observaciones: '',
    })

    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)
    const [metodos, setMetodos] = useState([])
    const [resumen, setResumen] = useState(null)

    // Carga los metodos de pago y el saldo del pedido al abrir el modal
    useEffect(() => {
        getMetodosPago().then(setMetodos).catch(e => setErrors({ general: e.message }))
        getAnticipoPedido(pedido.id_pedido).then(setResumen).catch(e => setErrors({ general: e.message }))
    }, [pedido.id_pedido])

    const validate = () => {
        const e = {}
        if (!form.id_metodo_pago) e.id_metodo_pago = 'Selecciona un método de pago'
        if (!(Number(form.monto) > 0)) e.monto = 'El monto debe ser mayor a 0'
        else if (resumen && Number(form.monto) > Number(resumen.saldo)) e.monto = `El monto no puede ser mayor al saldo (${fmt(resumen.saldo)})`
        return e
    }

    const handleSubmit = async (ev) => {
        ev.preventDefault()
        const errs = validate()
        if (Object.keys(errs).length) { setErrors(errs); return }
        setLoading(true)
        try {
            const { id_anticipo } = await crearAnticipoPedido({
                id_pedido: pedido.id_pedido,
                id_cliente: pedido.id_cliente ?? null,
                id_metodo_pago: Number(form.id_metodo_pago),
                monto: Number(form.monto),
                fecha_hora: form.fecha_hora || null,       // vacio = hora actual (lo pone el SP)
                referencia: form.referencia.trim() || null,
                observaciones: form.observaciones.trim() || null,
            })
            onSaved?.(id_anticipo)
            onClose()
        } catch (e) {
            // Errores del SP: monto mayor al saldo, pedido cancelado, etc.
            setErrors({ general: e.message })
        } finally {
            setLoading(false)
        }
    }

    const set = field => (e) => {
        setForm(f => ({ ...f, [field]: e.target.value }))
        setErrors(er => ({ ...er, [field]: undefined, general: undefined }))
    }

    // solo numeros con hasta 2 decimales
    const setMonto = (e) => {
        const val = e.target.value.replace(/[^\d.]/g, '')
        if (/^\d*\.?\d{0,2}$/.test(val)) set('monto')({ target: { value: val } })
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Registrar anticipo {pedido.folio ? `— ${pedido.folio}` : `— Pedido #${pedido.id_pedido}`}</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {resumen && (
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Total</label><div>{fmt(resumen.total)}</div></div>
                                <div className="form-group"><label className="form-label">Abonado</label><div>{fmt(resumen.total_anticipos)}</div></div>
                                <div className="form-group"><label className="form-label">Saldo</label><div><strong>{fmt(resumen.saldo)}</strong></div></div>
                            </div>
                        )}

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Monto</label>
                                <input
                                    inputMode="decimal"
                                    className={`form-input${errors.monto ? ' error' : ''}`}
                                    value={form.monto}
                                    onChange={setMonto}
                                    placeholder="0.00"
                                    autoFocus
                                />
                                {errors.monto && <div className="form-error">{errors.monto}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Método de pago</label>
                                <select
                                    className={`form-input${errors.id_metodo_pago ? ' error' : ''}`}
                                    value={form.id_metodo_pago}
                                    onChange={set('id_metodo_pago')}
                                >
                                    <option value="">Selecciona…</option>
                                    {metodos.map(m => (
                                        <option key={m.id_metodo_pago} value={m.id_metodo_pago}>{m.descripcion}</option>
                                    ))}
                                </select>
                                {errors.id_metodo_pago && <div className="form-error">{errors.id_metodo_pago}</div>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Fecha y hora</label>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    value={form.fecha_hora}
                                    onChange={set('fecha_hora')}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Referencia</label>
                                <input
                                    className="form-input"
                                    maxLength={60}
                                    value={form.referencia}
                                    onChange={set('referencia')}
                                    placeholder="Folio de transferencia / últimos 4 dígitos"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Observaciones</label>
                            <textarea
                                className="form-input"
                                maxLength={300}
                                rows={3}
                                value={form.observaciones}
                                onChange={set('observaciones')}
                            />
                        </div>

                        {errors.general && <div className="form-error">{errors.general}</div>}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Guardando…' : 'Guardar anticipo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
