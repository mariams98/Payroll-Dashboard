import { describe, expect, it } from 'vitest'
import csvText from '../../public/payroll_data.csv?raw'
import { detectAnomalies, groupAnomaliesByRow } from './anomalies'
import { parseCsv } from './parse'
import { employeeStats, summarize, summarizeAnomalies } from './stats'
import type { Anomaly } from './types'

// Expected values were computed separately with a plain Node script over the raw CSV.
const { records } = parseCsv(csvText)

describe('summarize on the real data file', () => {
  const summary = summarize(records)

  it('counts employees and weeks', () => {
    expect(summary.employeeCount).toBe(23)
    expect(summary.apprenticeCount).toBe(5)
    expect(summary.journeyworkerCount).toBe(18)
    expect(summary.weekCount).toBe(15)
    expect(summary.firstWeek).toBe('03/01/2025')
    expect(summary.lastWeek).toBe('06/07/2025')
  })

  it('totals hours and cost', () => {
    expect(summary.totalHours).toBeCloseTo(9956.8, 6)
    expect(summary.overtimeShare).toBeCloseTo(713.4 / 9956.8, 6)
    expect(summary.apprenticeShare).toBeCloseTo(0.2256, 4)
    expect(summary.grossPay).toBeCloseTo(429214.63, 2)
    expect(summary.benefitsCost).toBeCloseTo(161251.5, 2)
    expect(summary.totalCost).toBeCloseTo(590466.13, 2)
  })

  it('uses the median of each employee median for typical rates', () => {
    expect(summary.typicalStandardRate).toBe(43.41)
    expect(summary.typicalOvertimeRate).toBe(65.11)
    expect(summary.typicalBenefitsRate).toBe(16.25)
  })

  it('computes hours-weighted average rates (pay ÷ hours)', () => {
    expect(summary.hoursWeightedStandardRate).toBeCloseTo(41.5937, 4) // ST pay ÷ ST hours
    expect(summary.hoursWeightedOvertimeRate).toBeCloseTo(62.7244, 4) // OT pay ÷ OT hours
    expect(summary.hoursWeightedBenefitsRate).toBeCloseTo(16.1951, 4) // benefits ÷ all hours
  })

  it('counts weeks by date, so differently formatted dates are the same week', () => {
    const [header, firstRow, secondRow] = csvText.split('\n')
    // Both rows are week ending 03/01/2025; write the second one as 3/1/2025.
    const reformatted = secondRow.replace('03/01/2025', '3/1/2025')
    const { records: twoRows } = parseCsv(`${header}\n${firstRow}\n${reformatted}`)
    expect(summarize(twoRows).weekCount).toBe(1)
  })
})

describe('employeeStats', () => {
  const stats = employeeStats(records, detectAnomalies(records))

  it('has one row per employee', () => {
    expect(stats).toHaveLength(23)
  })

  it('computes hours and rates for one employee (1000, Ernestine Gerlach)', () => {
    const ernestine = stats.find((s) => s.employeeId === '1000')
    expect(ernestine?.weeks).toBe(14)
    expect(ernestine?.minDailyHours).toBe(2.5) // a day off (0h) does not count as the minimum
    expect(ernestine?.maxDailyHours).toBe(9.8)
    expect(ernestine?.avgDailyHours).toBeCloseTo(7.6609, 4)
    expect(ernestine?.minStandardRate).toBe(11.36) // the flagged week
    expect(ernestine?.maxStandardRate).toBe(27.05)
    expect(ernestine?.avgStandardRate).toBeCloseTo(25.9293, 4)
    expect(ernestine?.flaggedWeeks).toBe(1)
  })

  it('counts a week flagged by two rules once (1001: rate spike + apprentice rule in 2 weeks)', () => {
    expect(stats.find((s) => s.employeeId === '1001')?.flaggedWeeks).toBe(2)
  })

  it('uses the usual name for an ID, not a misspelling', () => {
    expect(stats.find((s) => s.employeeId === '1015')?.name).toBe('Maxine Dach')
  })
})

describe('summarizeAnomalies', () => {
  it('counts each flagged row once, by its most severe anomaly', () => {
    const anomaly = (rowNumber: number, severity: Anomaly['severity']): Anomaly => ({
      rule: 'rate-deviation',
      severity,
      message: '',
      rowNumber,
      employeeId: '1',
      weekEnding: '03/01/2025',
    })
    // Row 2 has a high and a medium hit, so it counts as one high row.
    const rows = groupAnomaliesByRow([anomaly(2, 'high'), anomaly(2, 'medium'), anomaly(5, 'low')], new Map())
    expect(summarizeAnomalies(rows)).toEqual({
      high: 1,
      medium: 0,
      low: 1,
      flaggedRows: 2,
      flaggedEmployees: 1,
      costAboveUsualRates: 0,
      costBelowUsualRates: 0,
    })
  })

  it('matches the anomaly table on the real data: 15 high and 2 medium rows across 13 employees', () => {
    const rows = groupAnomaliesByRow(detectAnomalies(records), new Map())
    const result = summarizeAnomalies(rows)
    expect(result).toMatchObject({ high: 15, medium: 2, low: 0, flaggedRows: 17, flaggedEmployees: 13 })
    // Expected values computed separately with a plain Node script over the raw CSV.
    expect(result.costAboveUsualRates).toBeCloseTo(7431.54, 2)
    expect(result.costBelowUsualRates).toBeCloseTo(2785.86, 2)
  })
})
