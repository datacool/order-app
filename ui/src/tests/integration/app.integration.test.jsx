import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'

describe('App 통합 흐름', () => {
  it('같은 메뉴를 여러 번 담으면 수량과 금액이 누적된다', async () => {
    const user = userEvent.setup()
    render(<App />)

    const addButtons = screen.getAllByRole('button', { name: '담기' })
    await user.click(addButtons[0])
    await user.click(addButtons[0])

    const cartItemName = screen.getAllByText('아메리카노(ICE)')
      .find((element) => element.closest('.cart-item'))
    expect(cartItemName).toBeInTheDocument()

    const cartItem = cartItemName.closest('.cart-item')
    expect(within(cartItem).getByText('2')).toBeInTheDocument()
    expect(within(cartItem).getByText('8,000원')).toBeInTheDocument()
  })

  it('주문 접수 후 관리자에서 제조 상태를 변경할 수 있다', async () => {
    const user = userEvent.setup()
    render(<App />)

    const addButtons = screen.getAllByRole('button', { name: '담기' })
    await user.click(addButtons[0])
    const cartPanel = screen.getByRole('heading', { name: '장바구니' })
      .closest('.cart-panel')
    expect(cartPanel).not.toBeNull()
    const orderButton = within(cartPanel).getByRole('button', { name: '주문하기' })
    await user.click(orderButton)
    await user.click(screen.getByRole('button', { name: '관리자' }))

    const startButtons = screen.getAllByRole('button', { name: '제조 시작' })
    await user.click(startButtons[0])
    expect(screen.getByRole('button', { name: '제조 완료' })).toBeInTheDocument()
  })
})
