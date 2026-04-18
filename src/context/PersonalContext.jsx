import { createContext, useContext, useEffect, useState } from 'react'
import {
  getEmpleados, createEmpleado, updateEmpleado, deleteEmpleado,
} from '../lib/personalApi'

const PersonalContext = createContext(null)
export const usePersonal = () => useContext(PersonalContext)

export function PersonalProvider({ children }) {
  const [empleados, setEmpleados]   = useState([])
  const [cargando, setCargando]     = useState(true)
  const [errorMsg, setErrorMsg]     = useState(null)

  useEffect(() => { cargarEmpleados() }, [])

  async function cargarEmpleados() {
    try {
      setCargando(true)
      const data = await getEmpleados()
      setEmpleados(data)
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setCargando(false)
    }
  }

  async function addEmpleado(nombre, telefono) {
    try {
      const nuevo = await createEmpleado(nombre, telefono)
      setEmpleados(prev =>
        [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre))
      )
      return { error: null }
    } catch (e) {
      return {
        error: e.message?.includes('uq_empleados_telefono')
          ? 'Ya existe un empleado con ese teléfono.'
          : e.message,
      }
    }
  }

  async function editEmpleado(id, nombre, telefono) {
    try {
      const updated = await updateEmpleado(id, nombre, telefono)
      setEmpleados(prev =>
        prev.map(e => e.empleado_id === id ? updated : e)
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
      )
      return { error: null }
    } catch (e) {
      return {
        error: e.message?.includes('uq_empleados_telefono')
          ? 'Ya existe un empleado con ese teléfono.'
          : e.message,
      }
    }
  }

  async function bajaEmpleado(id) {
    try {
      await deleteEmpleado(id)
      setEmpleados(prev => prev.filter(e => e.empleado_id !== id))
      return { error: null }
    } catch (e) {
      return { error: e.message }
    }
  }

  return (
    <PersonalContext.Provider value={{
      empleados,
      cargando,
      errorMsg,
      addEmpleado,
      editEmpleado,
      bajaEmpleado,
      recargarEmpleados: cargarEmpleados,
    }}>
      {children}
    </PersonalContext.Provider>
  )
}
