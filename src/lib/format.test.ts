import { describe, expect, it } from 'vitest'
import { formatDate, formatHours, formatLevel, formatSignedMoney } from './format'

describe('format helpers', () => {
  it('always shows one decimal for hours', () => {
    expect(formatHours(8)).toBe('8.0')
    expect(formatHours(9956.8)).toBe('9,956.8')
  })

  it('shows cost impact with a sign', () => {
    expect(formatSignedMoney(2896.98)).toBe('+$2,897')
    expect(formatSignedMoney(-948.59)).toBe('−$949')
  })

  it('formats week-ending dates for reading, keeping bad text as-is', () => {
    expect(formatDate('03/01/2025')).toBe('Mar 1, 2025')
    expect(formatDate('not a date')).toBe('not a date')
  })

  it('title-cases levels', () => {
    expect(formatLevel('JOURNEYWORKER')).toBe('Journeyworker')
  })
})
