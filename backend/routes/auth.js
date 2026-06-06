const express = require('express')
const bcrypt  = require('bcrypt')
const { query } = require('../db')

const router = express.Router()

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password)
      return res.status(400).json({ message: 'Usuario y contraseña requeridos' })

    const { rows } = await query(
      `SELECT id_usuario, nombre, username, rol, id_sucursal, password_hash
       FROM usuario WHERE username = $1`,
      [username.trim()]
    )

    if (!rows.length)
      return res.status(401).json({ message: 'Credenciales incorrectas' })

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid)
      return res.status(401).json({ message: 'Credenciales incorrectas' })

    const { password_hash, ...safeUser } = user
    res.json(safeUser)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

module.exports = router
