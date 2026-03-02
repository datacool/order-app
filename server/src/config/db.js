const { Pool } = require('pg')

const parseBoolean = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.toLowerCase()
  if (normalized === 'true') {
    return true
  }
  if (normalized === 'false') {
    return false
  }

  return null
}

const shouldUseSsl = () => {
  const explicit = parseBoolean(process.env.DB_SSL)

  if (explicit !== null) {
    return explicit
  }

  if (process.env.NODE_ENV === 'production') {
    return true
  }

  return (process.env.DB_HOST ?? '').includes('render.com')
}

const ssl = shouldUseSsl() ? { rejectUnauthorized: false } : false
const hasConnectionString = typeof process.env.DATABASE_URL === 'string'

const pool = hasConnectionString
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl,
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl,
    })

const checkDatabaseConnection = async () => {
  const client = await pool.connect()

  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

module.exports = {
  pool,
  checkDatabaseConnection,
}
