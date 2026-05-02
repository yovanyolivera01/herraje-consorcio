require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME     || 'herraje_consorcio',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message)
})

const query = (text, params) => pool.query(text, params)

module.exports = { pool, query }
