// Display helpers. Values are only rounded here, never in the calculations.

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const wholeCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

// $1,163.17
export function formatMoney(amount: number): string {
  return currency.format(amount)
}

// $590,466 (for large totals where cents are noise)
export function formatWholeMoney(amount: number): string {
  return wholeCurrency.format(amount)
}

// 9,956.8
export function formatHours(hours: number): string {
  return hours.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

// 0.2256 -> 22.6%
export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}
