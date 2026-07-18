const express = require('express')

const router = express.Router()

const HARDCODED_USER = {
  id_usuario:  1,
  nombre:      'Administrador',
  username:    'user',
  rol:         'admin',
  id_sucursal: null,
}
const HARDCODED_PASSWORD = '129'

router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password)
    return res.status(400).json({ message: 'Usuario y contraseña requeridos' })

  if (username.trim() !== HARDCODED_USER.username || password !== HARDCODED_PASSWORD)
    return res.status(401).json({ message: 'Credenciales incorrectas' })

  res.json(HARDCODED_USER)
})

module.exports = router
