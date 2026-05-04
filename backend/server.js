require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')

const herrajeRoutes    = require('./routes/herraje')
const cotizacionRoutes = require('./routes/cotizacion')
const pedidosRoutes    = require('./routes/pedidos')
const personalRoutes   = require('./routes/personal')
const empresasRoutes   = require('./routes/empresas')

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
