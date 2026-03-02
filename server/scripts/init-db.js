require('dotenv').config()
const { initDatabase } = require('../src/config/initDb')
const { pool } = require('../src/config/db')

initDatabase()
  .then(() => {
    console.log('Schema initialized')
  })
  .catch((error) => {
    console.error('Schema init failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
