import {
  formatPrice,
  getStockLabel,
  getStockTone,
} from '../../lib/orderUtils'

describe('orderUtils', () => {
  it('금액을 원화 포맷으로 변환한다', () => {
    expect(formatPrice(12500)).toBe('12,500원')
  })

  it('재고 수량별 상태 라벨을 반환한다', () => {
    expect(getStockLabel(0)).toBe('품절')
    expect(getStockLabel(4)).toBe('주의')
    expect(getStockLabel(5)).toBe('정상')
  })

  it('재고 수량별 상태 톤을 반환한다', () => {
    expect(getStockTone(0)).toBe('soldout')
    expect(getStockTone(3)).toBe('warning')
    expect(getStockTone(7)).toBe('normal')
  })
})
