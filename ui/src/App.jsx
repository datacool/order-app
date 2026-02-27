import { useState } from 'react'
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

const formatPrice = (value) => `${value.toLocaleString('ko-KR')}원`

function App() {
  const [selectedOptionsByMenuId, setSelectedOptionsByMenuId] = useState({})
  const [cartItems, setCartItems] = useState([])

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

  return (
    <main className="order-page">
      <header className="top-nav">
        <p className="brand">COZY</p>
        <div className="nav-tabs">
          <button className="nav-tab nav-tab--active" type="button">
            주문하기
          </button>
          <button className="nav-tab" type="button">
            관리자
          </button>
        </div>
      </header>

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
              type="button"
            >
              주문하기
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
