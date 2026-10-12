import { describe, expect, it } from 'vitest'
import csvText from '../../public/payroll_data.csv?raw'
import { normalizeRows, parseCsv, parseWeekEnding } from './parse'
import type { RawRow } from './types'

// A valid row: 8 ST hours Mon-Fri, 2 OT hours on Monday.
function makeRow(overrides: RawRow = {}): RawRow {
  const row: RawRow = {
    employee_name: 'Test Person',
    employee_id: '1',
    level: 'JOURNEYWORKER',
    occupation: 'Painter',
    week_ending: '03/01/2025', // a Saturday
    standard_rate: '40',
    overtime_rate: '60',
    benefits_rate: '10',
  }
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const isWeekday = day !== 'sat' && day !== 'sun'
    row[`${day}_st_hours`] = isWeekday ? '8' : '0'
    row[`${day}_ot_hours`] = day === 'mon' ? '2' : '0'
  }
  return { ...row, ...overrides }
}

describe('parseWeekEnding', () => {
  it('parses a valid MM/DD/YYYY date', () => {
    const date = parseWeekEnding('03/01/2025')
    expect(date?.getFullYear()).toBe(2025)
    expect(date?.getMonth()).toBe(2) // March (months are 0-based)
    expect(date?.getDate()).toBe(1)
  })

  it('rejects dates that do not exist and other formats', () => {
    expect(parseWeekEnding('02/30/2025')).toBeNull()
    expect(parseWeekEnding('2025-03-01')).toBeNull()
    expect(parseWeekEnding('')).toBeNull()
  })
})

describe('normalizeRows', () => {
  it('computes hours and pay for a valid row', () => {
    const { records, issues } = normalizeRows([makeRow()])
    expect(issues).toEqual([])
    const record = records[0]
    expect(record.rowNumber).toBe(2)
    expect(record.stHours).toBe(40)
    expect(record.otHours).toBe(2)
    expect(record.grossPay).toBe(40 * 40 + 2 * 60)
    expect(record.benefitsCost).toBe(42 * 10)
    expect(record.totalCost).toBe(1720 + 420)
  })

  it('excludes a row with an invalid date', () => {
    const { records, issues } = normalizeRows([makeRow({ week_ending: '13/45/2025' })])
    expect(records).toHaveLength(0)
    expect(issues[0].rule).toBe('invalid-data')
    expect(issues[0].message).toContain('week_ending')
  })

  it('excludes a row with blank, non-numeric or negative values and lists every problem', () => {
    const { records, issues } = normalizeRows([
      makeRow({ mon_st_hours: 'abc', standard_rate: '-5', employee_name: '' }),
    ])
    expect(records).toHaveLength(0)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('mon_st_hours is not a number')
    expect(issues[0].message).toContain('standard_rate is negative')
    expect(issues[0].message).toContain('employee_name is blank')
  })

  it('keeps a row whose week does not end on a Saturday but flags it', () => {
    const { records, issues } = normalizeRows([makeRow({ week_ending: '03/03/2025' })]) // a Monday
    expect(records).toHaveLength(1)
    expect(issues[0].rule).toBe('non-saturday-week')
  })
})

describe('parseCsv on the real data file', () => {
  it('parses every row without data problems', () => {
    const { records, issues } = parseCsv(csvText)
    expect(records).toHaveLength(263)
    expect(issues).toEqual([])
  })
})
