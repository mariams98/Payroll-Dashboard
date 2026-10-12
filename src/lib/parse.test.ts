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

  it('excludes a row with an unknown level or a non-numeric employee_id', () => {
    const { records, issues } = normalizeRows([
      makeRow({ level: 'FOREMAN' }),
      makeRow({ employee_id: 'A12' }),
    ])
    expect(records).toHaveLength(0)
    expect(issues[0].message).toContain('level is not APPRENTICE or JOURNEYWORKER')
    expect(issues[1].message).toContain('employee_id is not numeric')
  })

  it('reports the CSV line number of the row that has the problem', () => {
    const { records, issues } = normalizeRows([makeRow(), makeRow(), makeRow({ week_ending: 'bad' })])
    expect(records.map((r) => r.rowNumber)).toEqual([2, 3])
    expect(issues[0].rowNumber).toBe(4)
  })

  it('keeps a row whose week does not end on a Saturday but flags it', () => {
    const { records, issues } = normalizeRows([makeRow({ week_ending: '03/03/2025' })]) // a Monday
    expect(records).toHaveLength(1)
    expect(issues[0].rule).toBe('non-saturday-week')
  })
})

describe('parseCsv', () => {
  const [header, firstRow] = csvText.split('\n')

  it('flags a row with more fields than the header', () => {
    const { records, issues } = parseCsv(`${header}\n${firstRow},99`)
    expect(records).toHaveLength(0)
    expect(issues[0].rule).toBe('invalid-data')
    expect(issues[0].message).toContain('Too many fields')
  })
})

describe('parseCsv on the real data file', () => {
  const { records, issues } = parseCsv(csvText)

  it('parses every row without data problems', () => {
    expect(records).toHaveLength(263)
    expect(issues).toEqual([])
  })

  it('computes hours and pay for the first row (checked by hand)', () => {
    // Ernestine Gerlach, 03/01/2025: ST 7.3+7.3+6.6+7.6+7.6 = 36.4, OT 2.2+1.2+1 = 4.4
    const first = records[0]
    expect(first.stHours).toBe(36.4)
    expect(first.otHours).toBe(4.4)
    expect(first.totalHours).toBe(40.8)
    expect(first.grossPay).toBeCloseTo(36.4 * 27.05 + 4.4 * 40.58, 6) // 1163.172
    expect(first.benefitsCost).toBeCloseTo(40.8 * 12.17, 6) // 496.536
  })

  it('rounds away float drift in hour totals', () => {
    // Kamille O'Reilly, 03/01/2025: 35.2 ST + 5.7 OT. Unrounded addition gives 40.89999999999999.
    expect(records[1].totalHours).toBe(40.9)
  })
})
