import { useState, useEffect } from 'react'
import PersonalModal, { PuestosTable, ConfirmDeleteModal } from '../../components/formPuestos'
import { getPuestos, createPuesto, updatePuesto, deletePuesto } from '../../lib/puestos'

export default function Puestos() {
  const [puestos, setPuestos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editPuesto, setEditPuesto] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { cargarPuestos() }, [])

  async function cargarPuestos() {
    setLoading(true)
    try {
      const data = await getPuestos()
      setPuestos(data)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (form) => {
    if (editPuesto) {
      await updatePuesto(editPuesto.id_puesto, form)
    } else {
      await createPuesto(form)
    }
    setShowModal(false)
    setEditPuesto(null)
    await cargarPuestos()
  }
 
  // actions 
  const abrirNuevo = () => { setEditPuesto(null); setShowModal(true) }
  const abrirEditar = (p) => { setEditPuesto(p); setShowModal(true) }

  const pedirEliminar = (p) => setDeleteTarget(p)

  const handleDelete = async (p) => {
    await deletePuesto(p.id_puesto)
    setDeleteTarget(null)
    await cargarPuestos()
  }


  return (

    <div className="page-body">
      <div className="page-header">
        <div className="page-title">Puestos</div>
        <div>
            <button type='button' className="btn btn-primary" onClick={abrirNuevo}>+ Agregar</button>
        </div>

      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
      ) : puestos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Sin puestos registrados.</p>
      ) : (
        <PuestosTable
          puestos={puestos}
          onEdit={abrirEditar}
          onDelete={pedirEliminar}
        />
      )}

      {showModal && (
        <PersonalModal
          puestos={editPuesto}
          onClose={() => { setShowModal(false); setEditPuesto(null) }}
          onSave={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          puesto={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}


    </div>

  )
}
