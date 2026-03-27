import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import Proveedores from './pages/Proveedores/Proveedores'
import Productos from './pages/Productos/Productos'
import NuevaVenta from './pages/Ventas/NuevaVenta'
import Historial from './pages/Ventas/Historial'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/proveedores" replace />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="productos" element={<Productos />} />
            <Route path="ventas/nueva" element={<NuevaVenta />} />
            <Route path="ventas/historial" element={<Historial />} />
            <Route path="*" element={<Navigate to="/proveedores" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
