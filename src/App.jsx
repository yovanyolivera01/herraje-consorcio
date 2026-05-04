import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider }          from './context/AppContext'
import { CotizacionProvider }   from './context/CotizacionContext'
import { PersonalProvider }     from './context/PersonalContext'
import { AuthProvider }         from './context/AuthContext'
import Layout                   from './components/Layout'
import ProtectedRoute           from './components/ProtectedRoute'
import ErrorBoundary            from './components/ErrorBoundary'
import Login                    from './pages/Login'
import Proveedores              from './pages/Proveedores/Proveedores'
import Productos                from './pages/Productos/Productos'
import NuevaVenta               from './pages/Ventas/NuevaVenta'
import Historial                from './pages/Ventas/Historial'
import TiposVidrio              from './pages/Cotizacion/TiposVidrio'
import Precios                  from './pages/Cotizacion/Precios'
import Clientes                 from './pages/Cotizacion/Clientes'
import Empresas                 from './pages/Cotizacion/Empresas'
import Procesos                 from './pages/Cotizacion/Procesos'
import NuevaCotizacion          from './pages/Cotizacion/NuevaCotizacion'
import CotizacionRegistrado     from './pages/Cotizacion/CotizacionRegistrado'
import HistorialCotizaciones    from './pages/Cotizacion/HistorialCotizaciones'
import PedidosPendientes        from './pages/Cotizacion/PedidosPendientes'
import HistorialVentas          from './pages/Cotizacion/HistorialVentas'
import Empleados                from './pages/Personal/Empleados'
import RegistroSemanal          from './pages/Personal/RegistroSemanal'
import ResumenSemanal           from './pages/Personal/ResumenSemanal'

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <CotizacionProvider>
          <PersonalProvider>
            <BrowserRouter>
              <AuthProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />

                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/proveedores" replace />} />

                    {/* ── Herraje Consorcio ── */}
                    <Route path="proveedores"      element={<Proveedores />} />
                    <Route path="productos"        element={<Productos />} />
                    <Route path="ventas/nueva"     element={<NuevaVenta />} />
                    <Route path="ventas/historial" element={<Historial />} />

                    {/* ── Cotizacion de Vidrio ── */}
                    <Route path="cot/tipos-vidrio"       element={<TiposVidrio />} />
                    <Route path="cot/precios"            element={<Precios />} />
                    <Route path="cot/clientes"           element={<Clientes />} />
                    <Route path="cot/empresas"           element={<Empresas />} />
                    <Route path="cot/procesos"           element={<Procesos />} />
                    <Route path="cot/nueva"              element={<NuevaCotizacion />} />
                    <Route path="cot/registrado"         element={<CotizacionRegistrado />} />
                    <Route path="cot/historial"          element={<HistorialCotizaciones />} />
                    <Route path="cot/pedidos-pendientes" element={<PedidosPendientes />} />
                    <Route path="cot/ventas"             element={<HistorialVentas />} />

                    {/* ── Personal ── */}
                    <Route path="personal/empleados" element={<Empleados />} />
                    <Route path="personal/registro"  element={<RegistroSemanal />} />
                    <Route path="personal/resumen"   element={<ResumenSemanal />} />

                    <Route path="*" element={<Navigate to="/proveedores" replace />} />
                  </Route>
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </PersonalProvider>
        </CotizacionProvider>
      </AppProvider>
    </ErrorBoundary>
  )
}
