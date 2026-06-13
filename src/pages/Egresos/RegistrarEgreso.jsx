import { useState, useEffect } from "react"
import { useAuth } from '../../context/AuthContext'
import { insertarEgreso, getEgresos } from '../../lib/egresosApi'



export default function RegistrarEgreso() {

    const [modal, setModal] = useState(false)
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [egresos, setEgresos] = useState([])
    const [toast,setToast] = useState(null)

    useEffect(() => {
        getEgresos().then(data => setEgresos(data))
    }, [])


    const handleClose = () => {
        setModal(false)
        setAmount('')
        setDescription('')
        setError('')
    }

    const { user } = useAuth()

    const handleSave = async () => {
        if (!description) { setError('Ingresa una descripción'); return }
        if (!amount) { setError('Ingresa un monto'); return }
        if (Number(amount) <= 0) { setError('El monto debe ser mayor a 0'); return }
        setSaving(true)
        const res = await insertarEgreso({ description, monto: Number(amount), user_insert: user?.nombre ?? user?.email })
        setSaving(false)
        if (res.error) { setError(res.error); return }
        handleClose()
        setToast('Egreso Registrado  ✅ ')
        getEgresos().then(data => setEgresos(data))
    }






    return (



        <>
            <div className="page-header">
                <div>
                    <div className="page-title">Egresos</div>
                    <div className="page-subtitle">Registra los pagos aquí</div>
                </div>

                <button className="btn btn-primary" onClick={() => { setModal(true) }}>
                    + Nuevo egreso
                </button>
            </div>

            {toast && <div className="alert alert-success">{toast}</div>}


            <div className="page-body">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th>Monto</th>
                                <th>Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {egresos.map(e => (
                                <tr key={e.id_egreso}>
                                    <td>{e.description}</td>
                                    <td>${Number(e.monto).toFixed(2)}</td>
                                    <td>{e.fecha}</td>
                                </tr>
                            ))}
                        </tbody>

                    </table>

                </div>


            </div>

            {modal && (
                <div className="modal-overlay" onClick={() => setModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Nuevo Egreso</h2>
                            <button className="btn-icon" onClick={() => setModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" >

                            <div className="form-group">


                                <label className="form-label">Descripción</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder="Ingresa la descripción del pago...."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    onKeyDown={e => { if (/[0-9]/.test(e.key)) e.preventDefault() }}
                                    maxLength={30}

                                />


                                <label className="form-label">Cantidad</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="$ 00.00"
                                    value={amount}
                                    onChange={e => {
                                        const val = e.target.value
                                        if (val.length <= 7) setAmount(val)
                                    }}
                                    min={1}
                                    onInput={e => { if (e.target.value.length > 8) e.target.value = e.target.value.slice(0, 7) }}
                                    onKeyDown={e => { if (e.key === '-' || e.key === '+') e.preventDefault() }}

                                />
                                {error && <div className="alert alert-error">{error}</div>}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Guardando...' : 'Save'}
                            </button>

                        </div>
                    </div>
                </div>
            )}

        </>
    )
}