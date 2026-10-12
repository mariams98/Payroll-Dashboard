// Display helpers. Values are only rounded here, never in the calculations.
import { parseWeekEnding } from './parse'

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

// +$2,897 or −$949 (a real minus sign); used for cost impact.
export function formatSignedMoney(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : ''
  return `${sign}${wholeCurrency.format(Math.abs(amount))}`
}

// 9,956.8 and 8.0 (always one decimal, so columns line up)
export function formatHours(hours: number): string {
  return hours.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// "03/01/2025" -> "Mar 1, 2025". Falls back to the original text if it isn't a valid date.
export function formatDate(weekEnding: string): string {
  const date = parseWeekEnding(weekEnding)
  if (date === null) return weekEnding
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// "JOURNEYWORKER" -> "Journeyworker"
export function formatLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase()
}

// 0.2256 -> 22.6%
export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}
