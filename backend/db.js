require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME     || 'herraje_consorcio',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

// El servidor de Postgres corre con timezone UTC por default. Sin esto,
// NOW()/CURRENT_DATE/CURRENT_TIME (usados en created_at, updated_at y en los
// defaults de registro.fecha/hora_llegada) quedan 6 horas adelantados de
// Ciudad de México — cerca de medianoche hasta caen en el día equivocado.
pool.on('connect', (client) => {
  client.query("SET timezone = 'America/Mexico_City'").catch((err) => {
    console.error('No se pudo fijar el timezone de la sesión de Postgres:', err.message)
  })
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message)
})

const query = (text, params) => pool.query(text, params)

module.exports = { pool, query }
