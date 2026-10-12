import { canonicalNames } from './anomalies'
import type { FlaggedRow } from './anomalies'
import { groupBy, median, roundHours } from './math'
import type { Anomaly, WeekRecord } from './types'

export interface Summary {
  employeeCount: number
  apprenticeCount: number
  journeyworkerCount: number
  weekCount: number
  firstWeek: string
  lastWeek: string
  totalHours: number
  overtimeShare: number // fraction of all hours that were overtime
  apprenticeShare: number // fraction of all hours worked by apprentices
  grossPay: number
  benefitsCost: number
  totalCost: number
  // "Typical" rates: the median of each employee's own median rate, so spike weeks don't skew them.
  typicalStandardRate: number
  typicalOvertimeRate: number
  typicalBenefitsRate: number
  // What was actually paid per standard hour on average: ST pay ÷ ST hours.
  hoursWeightedStandardRate: number
}

// Counts flagged rows (not individual rule hits), by each row's most severe anomaly,
// so the numbers match the anomaly table.
export interface AnomalySummary {
  high: number
  medium: number
  low: number
  flaggedRows: number
  flaggedEmployees: number // distinct employees with at least one flagged row
  // From pay-rate anomalies: total cost above / below what the same hours cost at usual rates.
  costAboveUsualRates: number
  costBelowUsualRates: number
}

// One row of the employee table. Kept flat so any column can be sorted by its key.
export interface EmployeeStats {
  employeeId: string
  name: string
  level: string
  occupation: string
  weeks: number
  totalHours: number
  totalCost: number
  minDailyHours: number
  avgDailyHours: number
  maxDailyHours: number
  minStandardRate: number
  avgStandardRate: number
  maxStandardRate: number
  minOvertimeRate: number
  avgOvertimeRate: number
  maxOvertimeRate: number
  minBenefitsRate: number
  avgBenefitsRate: number
  maxBenefitsRate: number
  flaggedWeeks: number // rows with at least one anomaly (a row hit by two rules counts once)
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function average(values: number[]): number {
  return values.length === 0 ? NaN : sum(values) / values.length
}

export function summarize(records: WeekRecord[]): Summary {
  const byEmployee = groupBy(records, (r) => r.employeeId)
  // Each employee's level is taken from their first row (no one changes level in this data).
  const levels = [...byEmployee.values()].map((rows) => rows[0].level)

  // Group by the date itself, not its text, so "3/1/2025" and "03/01/2025" count as one week.
  const weeks = [...groupBy(records, (r) => String(r.weekEnding.getTime())).values()]
    .map((rows) => rows[0])
    .sort((a, b) => a.weekEnding.getTime() - b.weekEnding.getTime())

  const totalHours = sum(records.map((r) => r.totalHours))
  const overtimeHours = sum(records.map((r) => r.otHours))
  const apprenticeHours = sum(records.filter((r) => r.level === 'APPRENTICE').map((r) => r.totalHours))
  const grossPay = sum(records.map((r) => r.grossPay))
  const standardHours = sum(records.map((r) => r.stHours))
  const standardPay = sum(records.map((r) => r.stHours * r.standardRate))
  const benefitsCost = sum(records.map((r) => r.benefitsCost))

  const typicalRate = (getRate: (r: WeekRecord) => number) =>
    median([...byEmployee.values()].map((rows) => median(rows.map(getRate))))

  return {
    employeeCount: byEmployee.size,
    apprenticeCount: levels.filter((level) => level === 'APPRENTICE').length,
    journeyworkerCount: levels.filter((level) => level === 'JOURNEYWORKER').length,
    weekCount: weeks.length,
    firstWeek: weeks[0]?.weekEndingRaw ?? '',
    lastWeek: weeks[weeks.length - 1]?.weekEndingRaw ?? '',
    totalHours,
    overtimeShare: totalHours === 0 ? 0 : overtimeHours / totalHours,
    apprenticeShare: totalHours === 0 ? 0 : apprenticeHours / totalHours,
    grossPay,
    benefitsCost,
    totalCost: grossPay + benefitsCost,
    typicalStandardRate: typicalRate((r) => r.standardRate),
    hoursWeightedStandardRate: standardHours === 0 ? 0 : standardPay / standardHours,
    typicalOvertimeRate: typicalRate((r) => r.overtimeRate),
    typicalBenefitsRate: typicalRate((r) => r.benefitsRate),
  }
}

export function summarizeAnomalies(rows: FlaggedRow[]): AnomalySummary {
  const impacts = rows.flatMap((r) => r.anomalies.map((a) => a.costImpact ?? 0))
  return {
    costAboveUsualRates: sum(impacts.filter((i) => i > 0)),
    costBelowUsualRates: sum(impacts.filter((i) => i < 0).map((i) => -i)),
    high: rows.filter((r) => r.severity === 'high').length,
    medium: rows.filter((r) => r.severity === 'medium').length,
    low: rows.filter((r) => r.severity === 'low').length,
    flaggedRows: rows.length,
    flaggedEmployees: new Set(rows.map((r) => r.employeeId)).size,
  }
}

export function employeeStats(records: WeekRecord[], anomalies: Anomaly[]): EmployeeStats[] {
  const names = canonicalNames(records)
  // Collect the distinct flagged CSV rows per employee, so a week hit by two rules counts once.
  const flaggedRowsByEmployee = new Map<string, Set<number>>()
  for (const anomaly of anomalies) {
    const rows = flaggedRowsByEmployee.get(anomaly.employeeId) ?? new Set<number>()
    rows.add(anomaly.rowNumber)
    flaggedRowsByEmployee.set(anomaly.employeeId, rows)
  }

  const result: EmployeeStats[] = []
  for (const [employeeId, rows] of groupBy(records, (r) => r.employeeId)) {
    // Only days actually worked count; including days off would make every minimum 0.
    const dailyHours = rows
      .flatMap((r) => r.days.map((d) => roundHours(d.st + d.ot)))
      .filter((hours) => hours > 0)
    const standardRates = rows.map((r) => r.standardRate)
    const overtimeRates = rows.map((r) => r.overtimeRate)
    const benefitsRates = rows.map((r) => r.benefitsRate)

    result.push({
      employeeId,
      name: names.get(employeeId) ?? rows[0].name,
      level: rows[0].level,
      occupation: rows[0].occupation,
      weeks: rows.length,
      totalHours: sum(rows.map((r) => r.totalHours)),
      totalCost: sum(rows.map((r) => r.totalCost)),
      minDailyHours: dailyHours.length > 0 ? Math.min(...dailyHours) : 0,
      avgDailyHours: dailyHours.length > 0 ? average(dailyHours) : 0,
      maxDailyHours: dailyHours.length > 0 ? Math.max(...dailyHours) : 0,
      minStandardRate: Math.min(...standardRates),
      avgStandardRate: average(standardRates),
      maxStandardRate: Math.max(...standardRates),
      minOvertimeRate: Math.min(...overtimeRates),
      avgOvertimeRate: average(overtimeRates),
      maxOvertimeRate: Math.max(...overtimeRates),
      minBenefitsRate: Math.min(...benefitsRates),
      avgBenefitsRate: average(benefitsRates),
      maxBenefitsRate: Math.max(...benefitsRates),
      flaggedWeeks: flaggedRowsByEmployee.get(employeeId)?.size ?? 0,
    })
  }
  return result
}
