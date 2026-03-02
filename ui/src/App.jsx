import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  formatOrderDate,
  formatPrice,
  getStockLabel,
  getStockTone,
} from './lib/orderUtils'

const FALLBACK_MENUS = [
  {
    id: 1,
    name: '아메리카노(ICE)',
    price: 4000,
    description: '진하고 깔끔한 풍미의 아이스 아메리카노',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Iced_coffee_image.jpg',
    stockQuantity: 10,
    options: [
      { id: 11, label: '샷 추가', price: 500 },
      { id: 12, label: '시럽 추가', price: 0 },
    ],
  },
  {
    id: 2,
    name: '아메리카노(HOT)',
    price: 4000,
    description: '고소한 향이 살아 있는 따뜻한 아메리카노',
    imageUrl:
      'https://images.pexels.com/photos/374885/pexels-photo-374885.jpeg',
    stockQuantity: 10,
    options: [
      { id: 21, label: '샷 추가', price: 500 },
      { id: 22, label: '시럽 추가', price: 0 },
    ],
  },
  {
    id: 3,
    name: '카페라떼',
    price: 5000,
    description: '부드러운 우유와 에스프레소의 균형',
    imageUrl:
      'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg',
    stockQuantity: 10,
    options: [
      { id: 31, label: '샷 추가', price: 500 },
      { id: 32, label: '시럽 추가', price: 0 },
    ],
  },
]

const FALLBACK_ORDERS = [
  {
    id: 1,
    orderedAt: '2026-07-31T13:00:00',
    menuSummary: '아메리카노(ICE) x 1',
    totalPrice: 4000,
    status: '주문 접수',
  },
]

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const ORDER_STATUS = {
  RECEIVED: '주문 접수',
  MAKING: '제조 중',
  DONE: '완료',
}

function App() {
  const [activeTab, setActiveTab] = useState('order')
  const [menus, setMenus] = useState(FALLBACK_MENUS)
  const [selectedOptionsByMenuId, setSelectedOptionsByMenuId] = useState({})
  const [cartItems, setCartItems] = useState([])
  const [orders, setOrders] = useState(FALLBACK_ORDERS)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [menusResponse, ordersResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/menus`),
          fetch(`${API_BASE_URL}/api/orders`),
        ])
        const menusData = await menusResponse.json()
        const ordersData = await ordersResponse.json()

        if (!menusResponse.ok) {
          throw new Error(menusData.message ?? '메뉴 조회에 실패했습니다.')
        }

        if (!ordersResponse.ok) {
          throw new Error(ordersData.message ?? '주문 조회에 실패했습니다.')
        }

        if (Array.isArray(menusData.menus)) {
          setMenus(menusData.menus)
        }

        if (Array.isArray(ordersData.orders)) {
          setOrders(ordersData.orders)
        }
      } catch (error) {
        setErrorMessage(`API 연결 실패: ${error.message}`)
      }
    }

    fetchInitialData()
  }, [])

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
    const selectedOptions = menuItem.options.filter((option) =>
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
          selectedOptionIds: sortedOptionIds,
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

  const placeOrderLocally = () => {
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
    setMenus((prevState) =>
      prevState.map((menu) => ({
        ...menu,
        stockQuantity: Math.max(
          0,
          (menu.stockQuantity ?? 0) - (usedStocks[menu.id] ?? 0),
        ),
      })),
    )
    setCartItems([])
  }

  const placeOrder = async () => {
    if (cartItems.length === 0) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            menuId: item.menuId,
            quantity: item.quantity,
            optionIds: item.selectedOptionIds,
          })),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '주문 생성에 실패했습니다.')
      }

      setOrders((prevState) => [
        {
          id: data.order.id,
          orderedAt: data.order.orderedAt,
          status: data.order.status,
          totalPrice: data.order.totalPrice,
          menuSummary: cartItems
            .map((item) => `${item.menuName} x ${item.quantity}`)
            .join(', '),
        },
        ...prevState,
      ])
      setMenus((prevState) =>
        prevState.map((menu) => ({
          ...menu,
          stockQuantity: Math.max(
            0,
            (menu.stockQuantity ?? 0) -
              cartItems
                .filter((item) => item.menuId === menu.id)
                .reduce((sum, item) => sum + item.quantity, 0),
          ),
        })),
      )
      setCartItems([])
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(`주문 API 실패: ${error.message} (로컬 처리로 전환)`)
      placeOrderLocally()
    }
  }

  const adjustStock = async (menuId, delta) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/menus/${menuId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '재고 변경에 실패했습니다.')
      }

      setMenus((prevState) =>
        prevState.map((menu) =>
          menu.id === menuId
            ? { ...menu, stockQuantity: data.menu.stockQuantity }
            : menu,
        ),
      )
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(`재고 API 실패: ${error.message} (로컬 처리로 전환)`)
      setMenus((prevState) =>
        prevState.map((menu) =>
          menu.id === menuId
            ? { ...menu, stockQuantity: Math.max(0, menu.stockQuantity + delta) }
            : menu,
        ),
      )
    }
  }

  const updateOrderStatus = async (orderId) => {
    const current = orders.find((order) => order.id === orderId)

    if (!current || current.status === ORDER_STATUS.DONE) {
      return
    }

    const nextStatus =
      current.status === ORDER_STATUS.RECEIVED
        ? ORDER_STATUS.MAKING
        : ORDER_STATUS.DONE

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '주문 상태 변경에 실패했습니다.')
      }

      setOrders((prevState) =>
        prevState.map((order) =>
          order.id === orderId ? { ...order, status: data.order.status } : order,
        ),
      )
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(`주문 상태 API 실패: ${error.message} (로컬 처리로 전환)`)
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
  }

  const stockByMenuId = useMemo(
    () =>
      menus.reduce(
        (acc, menu) => ({ ...acc, [menu.id]: menu.stockQuantity ?? 0 }),
        {},
      ),
    [menus],
  )

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
        {menus.map((menuItem) => {
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
                {menuItem.options.map((option) => (
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
          {menus.map((menuItem) => {
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
      {errorMessage && (
        <p className="empty-cart-text" style={{ marginTop: '12px' }}>
          {errorMessage}
        </p>
      )}
      {activeTab === 'order' ? renderOrderPage() : renderAdminPage()}
    </main>
  )
}

export default App
