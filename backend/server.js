require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const express = require('express')
const cors    = require('cors')
const path    = require('path')

const herrajeRoutes    = require('./routes/herraje')
const cotizacionRoutes = require('./routes/cotizacion')
const pedidosRoutes    = require('./routes/pedidos')
const personalRoutes   = require('./routes/personal')
const empresasRoutes   = require('./routes/empresas')
const maquilaRoutes          = require('./routes/maquila')
const inventarioRoutes       = require('./routes/inventario')
const productosGeneralesRoutes = require('./routes/productosGenerales')
const reportesRoutes         = require('./routes/reportes')
const authRoutes             = require('./routes/auth')
const egresosRoutes = require('./routes/egresos')
const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }))
app.use(express.json())

// API routes
app.use('/api', herrajeRoutes)
app.use('/api', cotizacionRoutes)
app.use('/api', pedidosRoutes)
app.use('/api', personalRoutes)
app.use('/api', empresasRoutes)
app.use('/api', maquilaRoutes)
app.use('/api', inventarioRoutes)
app.use('/api', productosGeneralesRoutes)
app.use('/api', reportesRoutes)
app.use('/api', authRoutes)
app.use('/api',egresosRoutes)

// Serve React build in production
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ message: 'Not found' })
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Herraje Consorcio backend en puerto ${PORT}`)
})
