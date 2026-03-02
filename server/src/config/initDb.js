const { Client } = require('pg')
const { pool } = require('./db')

const DEFAULT_MENUS = [
  {
    name: '아메리카노(ICE)',
    description: '진하고 깔끔한 풍미의 아이스 아메리카노',
    price: 4000,
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Iced_coffee_image.jpg',
    stockQuantity: 10,
  },
  {
    name: '아메리카노(HOT)',
    description: '고소한 향이 살아 있는 따뜻한 아메리카노',
    price: 4000,
    imageUrl: 'https://images.pexels.com/photos/374885/pexels-photo-374885.jpeg',
    stockQuantity: 10,
  },
  {
    name: '카페라떼',
    description: '부드러운 우유와 에스프레소의 균형',
    price: 5000,
    imageUrl: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg',
    stockQuantity: 10,
  },
]

const ensureDatabaseExists = async () => {
  const targetDbName = process.env.DB_NAME
  const adminClient = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: 'postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })

  await adminClient.connect()

  try {
    const existsResult = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDbName],
    )

    if (existsResult.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${targetDbName}"`)
    }
  } finally {
    await adminClient.end()
  }
}

const initDatabase = async () => {
  await ensureDatabaseExists()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0),
      image_url TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS options (
      id SERIAL PRIMARY KEY,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT '주문 접수'
        CHECK (status IN ('주문 접수', '제조 중', '완료')),
      total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      line_amount INTEGER NOT NULL CHECK (line_amount >= 0),
      selected_options JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  const { rows: menuCountRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM menus',
  )

  if (menuCountRows[0].count > 0) {
    return
  }

  for (const menu of DEFAULT_MENUS) {
    const { rows } = await pool.query(
      `
        INSERT INTO menus (name, description, price, image_url, stock_quantity)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        menu.name,
        menu.description,
        menu.price,
        menu.imageUrl,
        menu.stockQuantity,
      ],
    )

    await pool.query(
      `
        INSERT INTO options (menu_id, name, price)
        VALUES
          ($1, '샷 추가', 500),
          ($1, '시럽 추가', 0)
      `,
      [rows[0].id],
    )
  }
}

module.exports = {
  initDatabase,
}
