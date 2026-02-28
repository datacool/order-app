export const formatPrice = (value) => `${value.toLocaleString('ko-KR')}원`

export const formatOrderDate = (date) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date))

export const getStockLabel = (quantity) => {
  if (quantity === 0) {
    return '품절'
  }

  if (quantity < 5) {
    return '주의'
  }

  return '정상'
}

export const getStockTone = (quantity) => {
  if (quantity === 0) {
    return 'soldout'
  }

  if (quantity < 5) {
    return 'warning'
  }

  return 'normal'
}
