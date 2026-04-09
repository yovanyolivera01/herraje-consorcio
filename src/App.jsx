import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider }          from './context/AppContext'
import { CotizacionProvider }   from './context/CotizacionContext'
import Layout                   from './components/Layout'
import Proveedores              from './pages/Proveedores/Proveedores'
import Productos                from './pages/Productos/Productos'
import NuevaVenta               from './pages/Ventas/NuevaVenta'
import Historial                from './pages/Ventas/Historial'
import TiposVidrio              from './pages/Cotizacion/TiposVidrio'
import Precios                  from './pages/Cotizacion/Precios'
import Clientes                 from './pages/Cotizacion/Clientes'
import Procesos                 from './pages/Cotizacion/Procesos'
import NuevaCotizacion          from './pages/Cotizacion/NuevaCotizacion'
import HistorialCotizaciones    from './pages/Cotizacion/HistorialCotizaciones'

export default function App() {
  return (
    <AppProvider>
      <CotizacionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/proveedores" replace />} />

              {/* ── Sistema Herraje Consorcio ── */}
              <Route path="proveedores"      element={<Proveedores />} />
              <Route path="productos"        element={<Productos />} />
              <Route path="ventas/nueva"     element={<NuevaVenta />} />
              <Route path="ventas/historial" element={<Historial />} />

              {/* ── Sistema Cotizacion de Vidrio ── */}
              <Route path="cot/tipos-vidrio" element={<TiposVidrio />} />
              <Route path="cot/precios"      element={<Precios />} />
              <Route path="cot/clientes"     element={<Clientes />} />
              <Route path="cot/procesos"     element={<Procesos />} />
              <Route path="cot/nueva"        element={<NuevaCotizacion />} />
              <Route path="cot/historial"    element={<HistorialCotizaciones />} />

              <Route path="*" element={<Navigate to="/proveedores" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CotizacionProvider>
    </AppProvider>
  )
}
