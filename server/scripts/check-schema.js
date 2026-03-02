require('dotenv').config()
const { pool } = require('../src/config/db')

const REQUIRED_TABLES = ['menus', 'options', 'orders', 'order_items']

const main = async () => {
  const result = await pool.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `,
    [REQUIRED_TABLES],
  )

  console.log(JSON.stringify(result.rows))
}

main()
  .catch((error) => {
    console.error('Schema check failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
