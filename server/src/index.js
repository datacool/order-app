require('dotenv').config()
const cors = require('cors')
const express = require('express')
const { pool, checkDatabaseConnection } = require('./config/db')
const { initDatabase } = require('./config/initDb')

const app = express()
const PORT = process.env.PORT || 4000
const NEXT_STATUS = {
  '주문 접수': '제조 중',
  '제조 중': '완료',
  완료: null,
}

const createHttpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Server is running',
  })
})

app.get('/health/db', async (req, res) => {
  try {
    await checkDatabaseConnection()

    res.status(200).json({
      message: 'Database connection is healthy',
    })
  } catch (error) {
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message,
    })
  }
})

const mapMenuRows = (menus, options) => {
  const optionsByMenuId = options.reduce((acc, option) => {
    const list = acc[option.menu_id] ?? []

    return {
      ...acc,
      [option.menu_id]: [
        ...list,
        { id: option.id, label: option.name, price: option.price },
      ],
    }
  }, {})

  return menus.map((menu) => ({
    id: menu.id,
    name: menu.name,
    description: menu.description,
    price: menu.price,
    imageUrl: menu.image_url,
    stockQuantity: menu.stock_quantity,
    options: optionsByMenuId[menu.id] ?? [],
  }))
}

const buildOrderSummaries = (orderRows) => {
  const orderMap = new Map()

  for (const row of orderRows) {
    if (!orderMap.has(row.id)) {
      orderMap.set(row.id, {
        id: row.id,
        orderedAt: row.ordered_at,
        status: row.status,
        totalPrice: row.total_amount,
        menuSummaryParts: [],
      })
    }

    if (row.menu_name && row.quantity) {
      orderMap
        .get(row.id)
        .menuSummaryParts
        .push(`${row.menu_name} x ${row.quantity}`)
    }
  }

  return [...orderMap.values()].map((order) => ({
    id: order.id,
    orderedAt: order.orderedAt,
    status: order.status,
    totalPrice: order.totalPrice,
    menuSummary: order.menuSummaryParts.join(', '),
  }))
}

app.get('/api/menus', async (req, res) => {
  try {
    const [menusResult, optionsResult] = await Promise.all([
      pool.query('SELECT * FROM menus ORDER BY id'),
      pool.query('SELECT * FROM options ORDER BY id'),
    ])

    res.status(200).json({
      menus: mapMenuRows(menusResult.rows, optionsResult.rows),
    })
  } catch (error) {
    res.status(500).json({
      message: '메뉴 조회에 실패했습니다.',
      error: error.message,
    })
  }
})

app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          o.id,
          o.ordered_at,
          o.status,
          o.total_amount,
          oi.quantity,
          m.name AS menu_name
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menus m ON m.id = oi.menu_id
        ORDER BY o.ordered_at DESC, o.id DESC, oi.id ASC
      `,
    )

    res.status(200).json({
      orders: buildOrderSummaries(result.rows),
    })
  } catch (error) {
    res.status(500).json({
      message: '주문 목록 조회에 실패했습니다.',
      error: error.message,
    })
  }
})

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const orderId = Number(req.params.orderId)

    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ message: '유효하지 않은 주문 ID입니다.' })
    }

    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [
      orderId,
    ])

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' })
    }

    const itemsResult = await pool.query(
      `
        SELECT
          oi.id,
          oi.menu_id,
          oi.quantity,
          oi.unit_price,
          oi.line_amount,
          oi.selected_options,
          m.name AS menu_name
        FROM order_items oi
        JOIN menus m ON m.id = oi.menu_id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC
      `,
      [orderId],
    )

    const order = orderResult.rows[0]

    return res.status(200).json({
      order: {
        id: order.id,
        orderedAt: order.ordered_at,
        status: order.status,
        totalPrice: order.total_amount,
      },
      items: itemsResult.rows.map((item) => ({
        id: item.id,
        menuId: item.menu_id,
        menuName: item.menu_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineAmount: item.line_amount,
        selectedOptions: item.selected_options,
      })),
    })
  } catch (error) {
    return res.status(500).json({
      message: '주문 조회에 실패했습니다.',
      error: error.message,
    })
  }
})

app.post('/api/orders', async (req, res) => {
  const { items } = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: '주문 항목이 비어 있습니다.' })
  }

  const normalizedItems = items.map((item) => ({
    menuId: Number(item.menuId),
    quantity: Number(item.quantity),
    optionIds: Array.isArray(item.optionIds)
      ? item.optionIds.map((id) => Number(id))
      : [],
  }))

  if (
    normalizedItems.some(
      (item) =>
        !Number.isInteger(item.menuId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.optionIds.some((id) => !Number.isInteger(id)),
    )
  ) {
    return res.status(400).json({ message: '주문 항목 형식이 올바르지 않습니다.' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const menuIds = [...new Set(normalizedItems.map((item) => item.menuId))]
    const menuResult = await client.query(
      'SELECT * FROM menus WHERE id = ANY($1::int[]) FOR UPDATE',
      [menuIds],
    )
    const menuMap = new Map(menuResult.rows.map((menu) => [menu.id, menu]))

    if (menuMap.size !== menuIds.length) {
      throw createHttpError(400, '존재하지 않는 메뉴가 포함되어 있습니다.')
    }

    const requestedByMenu = normalizedItems.reduce((acc, item) => ({
      ...acc,
      [item.menuId]: (acc[item.menuId] ?? 0) + item.quantity,
    }), {})

    for (const [menuIdText, quantity] of Object.entries(requestedByMenu)) {
      const menuId = Number(menuIdText)
      const menu = menuMap.get(menuId)

      if (menu.stock_quantity < quantity) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          message: `${menu.name} 재고가 부족합니다.`,
        })
      }
    }

    const allOptionIds = [
      ...new Set(normalizedItems.flatMap((item) => item.optionIds)),
    ]
    let optionMap = new Map()

    if (allOptionIds.length > 0) {
      const optionsResult = await client.query(
        'SELECT * FROM options WHERE id = ANY($1::int[])',
        [allOptionIds],
      )
      optionMap = new Map(optionsResult.rows.map((option) => [option.id, option]))

      if (optionMap.size !== allOptionIds.length) {
        throw createHttpError(400, '존재하지 않는 옵션이 포함되어 있습니다.')
      }
    }

    const orderInsert = await client.query(
      `
        INSERT INTO orders (status, total_amount)
        VALUES ('주문 접수', 0)
        RETURNING id, ordered_at, status, total_amount
      `,
    )
    const order = orderInsert.rows[0]
    let totalAmount = 0

    for (const item of normalizedItems) {
      const menu = menuMap.get(item.menuId)
      const selectedOptions = item.optionIds.map((optionId) => {
        const option = optionMap.get(optionId)

        if (option.menu_id !== item.menuId) {
          throw createHttpError(400, '메뉴와 옵션의 연결이 올바르지 않습니다.')
        }

        return {
          id: option.id,
          label: option.name,
          price: option.price,
        }
      })
      const optionPrice = selectedOptions.reduce(
        (sum, option) => sum + option.price,
        0,
      )
      const unitPrice = menu.price + optionPrice
      const lineAmount = unitPrice * item.quantity
      totalAmount += lineAmount

      await client.query(
        `
          INSERT INTO order_items (
            order_id,
            menu_id,
            quantity,
            unit_price,
            line_amount,
            selected_options
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        `,
        [
          order.id,
          item.menuId,
          item.quantity,
          unitPrice,
          lineAmount,
          JSON.stringify(selectedOptions),
        ],
      )
    }

    await client.query(
      'UPDATE orders SET total_amount = $1, updated_at = NOW() WHERE id = $2',
      [totalAmount, order.id],
    )

    for (const [menuIdText, quantity] of Object.entries(requestedByMenu)) {
      await client.query(
        `
          UPDATE menus
          SET stock_quantity = stock_quantity - $1, updated_at = NOW()
          WHERE id = $2
        `,
        [quantity, Number(menuIdText)],
      )
    }

    await client.query('COMMIT')

    return res.status(201).json({
      order: {
        id: order.id,
        orderedAt: order.ordered_at,
        status: '주문 접수',
        totalPrice: totalAmount,
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')

    return res.status(error.status ?? 500).json({
      message: error.status ? error.message : '주문 생성에 실패했습니다.',
      error: error.message,
    })
  } finally {
    client.release()
  }
})

app.patch('/api/orders/:orderId/status', async (req, res) => {
  try {
    const orderId = Number(req.params.orderId)
    const { status } = req.body

    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ message: '유효하지 않은 주문 ID입니다.' })
    }

    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [
      orderId,
    ])

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' })
    }

    const current = orderResult.rows[0]
    const next = NEXT_STATUS[current.status]

    if (!next) {
      return res.status(409).json({ message: '이미 완료된 주문입니다.' })
    }

    if (status && status !== next) {
      return res.status(409).json({ message: '허용되지 않은 상태 전이입니다.' })
    }

    const updateResult = await pool.query(
      `
        UPDATE orders
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, ordered_at, status, total_amount
      `,
      [next, orderId],
    )
    const updated = updateResult.rows[0]

    return res.status(200).json({
      order: {
        id: updated.id,
        orderedAt: updated.ordered_at,
        status: updated.status,
        totalPrice: updated.total_amount,
      },
    })
  } catch (error) {
    return res.status(500).json({
      message: '주문 상태 변경에 실패했습니다.',
      error: error.message,
    })
  }
})

app.patch('/api/menus/:menuId/stock', async (req, res) => {
  try {
    const menuId = Number(req.params.menuId)
    const delta = Number(req.body.delta)

    if (!Number.isInteger(menuId) || !Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({ message: '유효하지 않은 요청입니다.' })
    }

    const menuResult = await pool.query('SELECT * FROM menus WHERE id = $1', [
      menuId,
    ])

    if (menuResult.rows.length === 0) {
      return res.status(404).json({ message: '메뉴를 찾을 수 없습니다.' })
    }

    const menu = menuResult.rows[0]
    const nextQuantity = menu.stock_quantity + delta

    if (nextQuantity < 0) {
      return res.status(409).json({ message: '재고는 0 미만이 될 수 없습니다.' })
    }

    const updateResult = await pool.query(
      `
        UPDATE menus
        SET stock_quantity = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [nextQuantity, menuId],
    )
    const updated = updateResult.rows[0]

    return res.status(200).json({
      menu: {
        id: updated.id,
        name: updated.name,
        stockQuantity: updated.stock_quantity,
      },
    })
  } catch (error) {
    return res.status(500).json({
      message: '재고 변경에 실패했습니다.',
      error: error.message,
    })
  }
})

const start = async () => {
  try {
    await initDatabase()

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`)
    })
  } catch (error) {
    console.error('서버 시작 실패:', error.message)
    process.exit(1)
  }
}

start()

process.on('SIGINT', async () => {
  await pool.end()
  process.exit(0)
})
