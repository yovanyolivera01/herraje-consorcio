import { useState, useEffect } from 'react'
import TurnoModal, { TurnosTable } from '../../components/formTurno'
import { getTurnos, createTurno } from '../../lib/turno'

export default function Turnos() {
  const [turnos, setTurnos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { cargarTurnos() }, [])

  async function cargarTurnos() {
    setLoading(true)
    try {
      const data = await getTurnos()
      setTurnos(data)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (form) => {
    await createTurno(form)
    setShowModal(false)
    await cargarTurnos()
  }

  const abrirNuevo = () => setShowModal(true)

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-title">Turnos</div>
        <div>
          <button type="button" className="btn btn-primary" onClick={abrirNuevo}>+ Agregar</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
      ) : turnos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Sin turnos registrados.</p>
      ) : (
        <TurnosTable turnos={turnos} />
      )}

      {showModal && (
        <TurnoModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
