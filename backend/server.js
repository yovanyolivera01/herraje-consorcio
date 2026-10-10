require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')
const http    = require('http')
const https   = require('https')

const herrajeRoutes    = require('./routes/herraje')
const cotizacionRoutes = require('./routes/cotizacion')
const clientesRoutes   = require('./routes/clientes')
const pedidosRoutes    = require('./routes/pedidos')
const personalRoutes   = require('./routes/personal')
const empresasRoutes   = require('./routes/empresas')
const maquilaRoutes          = require('./routes/maquila')
const inventarioRoutes       = require('./routes/inventario')
const productosGeneralesRoutes = require('./routes/productosGenerales')
const reportesRoutes         = require('./routes/reportes')
const authRoutes             = require('./routes/auth')
const egresosRoutes    = require('./routes/egresos')
const facturamaRoutes  = require('./routes/facturama')
const partidasRoutes   = require('./routes/partida')
const partidaCotizacionRoutes = require('./routes/partidaCotizacion')
const procesosRoutes  = require('./routes/procesos')
const procesoExtraRoutes = require('./routes/procesoExtra')
const puestosRoutes   = require('./routes/puestos')
const asistenciaRoutes = require('./routes/asistencia')
const calculosRoutes   = require('./routes/calculos')
const turnoRoutes     = require('./routes/turno')
const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }))
app.use(express.json())

// API routes
app.use('/api', cotizacionRoutes)
app.use('/api', herrajeRoutes)
app.use('/api', clientesRoutes)
app.use('/api', pedidosRoutes)
app.use('/api', personalRoutes)
app.use('/api', empresasRoutes)
app.use('/api', maquilaRoutes)
app.use('/api', inventarioRoutes)
app.use('/api', productosGeneralesRoutes)
app.use('/api', reportesRoutes)
app.use('/api', authRoutes)
app.use('/api', egresosRoutes)
app.use('/api', facturamaRoutes)
app.use('/api', partidasRoutes)
app.use('/api', partidaCotizacionRoutes)
app.use('/api', procesosRoutes)
app.use('/api', procesoExtraRoutes)
app.use('/api', puestosRoutes)
app.use('/api', asistenciaRoutes)
app.use('/api', calculosRoutes)
app.use('/api', turnoRoutes)

// Serve React build in production
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ message: 'Not found' })
  res.sendFile(path.join(distPath, 'index.html'))
})

// HTTPS es opt-in via HTTPS_CERT/HTTPS_KEY (p.ej. certs de `tailscale cert`)
// — navigator.mediaDevices.getUserMedia (cámara, usada por el modulo de
// Personal para captura facial) solo existe en "contextos seguros"
// (https:// o http://localhost); sin esas env vars el server sigue
// sirviendo por HTTP plano como siempre.
const certPath = process.env.HTTPS_CERT
const keyPath  = process.env.HTTPS_KEY
if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
    .listen(PORT, () => console.log(`Herraje Consorcio backend (HTTPS) en puerto ${PORT}`))
} else {
  http.createServer(app)
    .listen(PORT, () => console.log(`Herraje Consorcio backend en puerto ${PORT}`))
}
