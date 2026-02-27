import { useMemo, useState } from 'react'
import './App.css'

const MENU_ITEMS = [
  {
    id: 'americano-ice',
    name: '아메리카노(ICE)',
    price: 4000,
    description: '진하고 깔끔한 풍미의 아이스 아메리카노',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Iced_coffee_image.jpg',
  },
  {
    id: 'americano-hot',
    name: '아메리카노(HOT)',
    price: 4000,
    description: '고소한 향이 살아 있는 따뜻한 아메리카노',
    imageUrl:
      'https://images.pexels.com/photos/374885/pexels-photo-374885.jpeg',
  },
  {
    id: 'cafe-latte',
    name: '카페라떼',
    price: 5000,
    description: '부드러운 우유와 에스프레소의 균형',
    imageUrl:
      'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg',
  },
]

const OPTIONS = [
  { id: 'extra-shot', label: '샷 추가', price: 500 },
  { id: 'syrup', label: '시럽 추가', price: 0 },
]

const ORDER_STATUS = {
  RECEIVED: '주문 접수',
  MAKING: '제조 중',
  DONE: '제조 완료',
}

const formatPrice = (value) => `${value.toLocaleString('ko-KR')}원`

const formatOrderDate = (date) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date))

const getStockLabel = (quantity) => {
  if (quantity === 0) {
    return '품절'
  }

  if (quantity < 5) {
    return '주의'
  }

  return '정상'
}

const getStockTone = (quantity) => {
  if (quantity === 0) {
    return 'soldout'
  }

  if (quantity < 5) {
    return 'warning'
  }

  return 'normal'
}

function App() {
  const [activeTab, setActiveTab] = useState('order')
  const [selectedOptionsByMenuId, setSelectedOptionsByMenuId] = useState({})
  const [cartItems, setCartItems] = useState([])
  const [stockByMenuId, setStockByMenuId] = useState({
    'americano-ice': 10,
    'americano-hot': 10,
    'cafe-latte': 10,
  })
  const [orders, setOrders] = useState([
    {
      id: 1,
      orderedAt: '2026-07-31T13:00:00',
      menuSummary: '아메리카노(ICE) x 1',
      totalPrice: 4000,
      status: ORDER_STATUS.RECEIVED,
    },
  ])

  const toggleOption = (menuId, optionId) => {
    setSelectedOptionsByMenuId((prevState) => {
      const previousOptions = prevState[menuId] ?? []
      const hasOption = previousOptions.includes(optionId)
      const nextOptions = hasOption
        ? previousOptions.filter((id) => id !== optionId)
        : [...previousOptions, optionId]

      return { ...prevState, [menuId]: nextOptions }
    })
  }

  const addToCart = (menuItem) => {
    const selectedOptionIds = selectedOptionsByMenuId[menuItem.id] ?? []
    const sortedOptionIds = [...selectedOptionIds].sort()
    const optionKey = sortedOptionIds.join('|')
    const cartItemKey = `${menuItem.id}:${optionKey}`
    const selectedOptions = OPTIONS.filter((option) =>
      sortedOptionIds.includes(option.id),
    )
    const optionPrice = selectedOptions.reduce(
      (sum, option) => sum + option.price,
      0,
    )
    const unitPrice = menuItem.price + optionPrice

    setCartItems((prevState) => {
      const existingItemIndex = prevState.findIndex(
        (item) => item.cartItemKey === cartItemKey,
      )

      if (existingItemIndex >= 0) {
        return prevState.map((item, index) =>
          index === existingItemIndex
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        )
      }

      return [
        ...prevState,
        {
          cartItemKey,
          menuId: menuItem.id,
          menuName: menuItem.name,
          quantity: 1,
          unitPrice,
          selectedOptions,
        },
      ]
    })
  }

  const totalPrice = cartItems.reduce(
    (sum, cartItem) => sum + cartItem.unitPrice * cartItem.quantity,
    0,
  )

  const adjustCartQuantity = (cartItemKey, delta) => {
    setCartItems((prevState) =>
      prevState
        .map((item) =>
          item.cartItemKey === cartItemKey
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const placeOrder = () => {
    if (cartItems.length === 0) {
      return
    }

    const menuSummary = cartItems
      .map((item) => `${item.menuName} x ${item.quantity}`)
      .join(', ')
    const nextOrder = {
      id: Date.now(),
      orderedAt: new Date().toISOString(),
      menuSummary,
      totalPrice,
      status: ORDER_STATUS.RECEIVED,
    }
    const usedStocks = cartItems.reduce((acc, item) => {
      return {
        ...acc,
        [item.menuId]: (acc[item.menuId] ?? 0) + item.quantity,
      }
    }, {})

    setOrders((prevState) => [nextOrder, ...prevState])
    setStockByMenuId((prevState) => {
      const nextState = { ...prevState }

      Object.entries(usedStocks).forEach(([menuId, quantity]) => {
        nextState[menuId] = Math.max(0, (nextState[menuId] ?? 0) - quantity)
      })

      return nextState
    })
    setCartItems([])
  }

  const adjustStock = (menuId, delta) => {
    setStockByMenuId((prevState) => ({
      ...prevState,
      [menuId]: Math.max(0, (prevState[menuId] ?? 0) + delta),
    }))
  }

  const updateOrderStatus = (orderId) => {
    setOrders((prevState) =>
      prevState.map((order) => {
        if (order.id !== orderId) {
          return order
        }

        if (order.status === ORDER_STATUS.RECEIVED) {
          return { ...order, status: ORDER_STATUS.MAKING }
        }

        if (order.status === ORDER_STATUS.MAKING) {
          return { ...order, status: ORDER_STATUS.DONE }
        }

        return order
      }),
    )
  }

  const dashboard = useMemo(() => {
    const receivedCount = orders.filter(
      (order) => order.status === ORDER_STATUS.RECEIVED,
    ).length
    const makingCount = orders.filter(
      (order) => order.status === ORDER_STATUS.MAKING,
    ).length
    const doneCount = orders.filter(
      (order) => order.status === ORDER_STATUS.DONE,
    ).length

    return {
      totalCount: orders.length,
      receivedCount,
      makingCount,
      doneCount,
    }
  }, [orders])

  const renderOrderPage = () => (
    <>
      <section className="menu-grid">
        {MENU_ITEMS.map((menuItem) => {
          const selectedOptionIds = selectedOptionsByMenuId[menuItem.id] ?? []

          return (
            <article className="menu-card" key={menuItem.id}>
              <img
                alt={menuItem.name}
                className="menu-image"
                src={menuItem.imageUrl}
              />
              <h2>{menuItem.name}</h2>
              <p className="menu-price">{formatPrice(menuItem.price)}</p>
              <p className="menu-description">{menuItem.description}</p>

              <div className="option-list">
                {OPTIONS.map((option) => (
                  <label className="option-item" key={option.id}>
                    <input
                      checked={selectedOptionIds.includes(option.id)}
                      onChange={() => toggleOption(menuItem.id, option.id)}
                      type="checkbox"
                    />
                    <span>
                      {option.label} (+{formatPrice(option.price)})
                    </span>
                  </label>
                ))}
              </div>

              <button
                className="action-button"
                onClick={() => addToCart(menuItem)}
                type="button"
              >
                담기
              </button>
            </article>
          )
        })}
      </section>

      <section className="cart-panel">
        <h3>장바구니</h3>
        <div className="cart-layout">
          <div className="cart-left">
            {cartItems.length === 0 ? (
              <p className="empty-cart-text">장바구니가 비어 있습니다.</p>
            ) : (
              <ul className="cart-list">
                {cartItems.map((cartItem) => {
                  const optionLabel = cartItem.selectedOptions
                    .map((option) => option.label)
                    .join(', ')
                  const hasOptions = optionLabel.length > 0

                  return (
                    <li className="cart-item" key={cartItem.cartItemKey}>
                      <div>
                        <p className="cart-item__name">
                          {cartItem.menuName}
                          {hasOptions && <span> ({optionLabel})</span>}
                        </p>
                        <div className="qty-controls">
                          <button
                            className="qty-button"
                            onClick={() =>
                              adjustCartQuantity(cartItem.cartItemKey, -1)
                            }
                            type="button"
                          >
                            -
                          </button>
                          <span className="cart-item__qty">
                            {cartItem.quantity}
                          </span>
                          <button
                            className="qty-button"
                            onClick={() =>
                              adjustCartQuantity(cartItem.cartItemKey, 1)
                            }
                            type="button"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="cart-item__price">
                        {formatPrice(cartItem.unitPrice * cartItem.quantity)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="cart-right">
            <p>
              총 금액 <strong>{formatPrice(totalPrice)}</strong>
            </p>
            <button
              className="action-button order-button"
              disabled={cartItems.length === 0}
              onClick={placeOrder}
              type="button"
            >
              주문하기
            </button>
          </div>
        </div>
      </section>
    </>
  )

  const renderAdminPage = () => (
    <div className="admin-page">
      <section className="admin-section">
        <h3>관리자 대시보드</h3>
        <div className="admin-dashboard-grid">
          <p>총 주문 {dashboard.totalCount}</p>
          <p>주문 접수 {dashboard.receivedCount}</p>
          <p>제조 중 {dashboard.makingCount}</p>
          <p>제조 완료 {dashboard.doneCount}</p>
        </div>
      </section>

      <section className="admin-section">
        <h3>재고 현황</h3>
        <div className="stock-grid">
          {MENU_ITEMS.map((menuItem) => {
            const quantity = stockByMenuId[menuItem.id] ?? 0
            const label = getStockLabel(quantity)
            const tone = getStockTone(quantity)

            return (
              <article className="stock-card" key={menuItem.id}>
                <h4>{menuItem.name}</h4>
                <div className="stock-info-row">
                  <p>{quantity}개</p>
                  <p className={`stock-label stock-label--${tone}`}>{label}</p>
                </div>
                <div className="stock-actions">
                  <button
                    className="qty-button"
                    onClick={() => adjustStock(menuItem.id, -1)}
                    type="button"
                  >
                    -
                  </button>
                  <button
                    className="qty-button"
                    onClick={() => adjustStock(menuItem.id, 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="admin-section">
        <h3>주문 현황</h3>
        {orders.length === 0 ? (
          <p className="empty-cart-text">현재 접수된 주문이 없습니다.</p>
        ) : (
          <ul className="order-list">
            {orders.map((order) => {
              const isDone = order.status === ORDER_STATUS.DONE
              const actionText =
                order.status === ORDER_STATUS.RECEIVED
                  ? '제조 시작'
                  : order.status === ORDER_STATUS.MAKING
                    ? '제조 완료'
                    : '완료'

              return (
                <li className="order-item" key={order.id}>
                  <p>{formatOrderDate(order.orderedAt)}</p>
                  <p>{order.menuSummary}</p>
                  <p>{formatPrice(order.totalPrice)}</p>
                  <button
                    className="nav-tab status-button"
                    disabled={isDone}
                    onClick={() => updateOrderStatus(order.id)}
                    type="button"
                  >
                    {actionText}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )

  return (
    <main className="order-page">
      <header className="top-nav">
        <p className="brand">COZY</p>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'order' ? 'nav-tab--active' : ''}`}
            onClick={() => setActiveTab('order')}
            type="button"
          >
            주문하기
          </button>
          <button
            className={`nav-tab ${activeTab === 'admin' ? 'nav-tab--active' : ''}`}
            onClick={() => setActiveTab('admin')}
            type="button"
          >
            관리자
          </button>
        </div>
      </header>
      {activeTab === 'order' ? renderOrderPage() : renderAdminPage()}
    </main>
  )
}

export default App
