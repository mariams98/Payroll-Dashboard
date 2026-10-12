import Papa from 'papaparse'
import { DAYS } from './types'
import type { Anomaly, DayHours, RawRow, WeekRecord } from './types'

export interface ParseResult {
  records: WeekRecord[]
  issues: Anomaly[]
}

// Parse the raw CSV text into clean records plus a list of data problems.
export function parseCsv(text: string): ParseResult {
  const result = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true })

  // PapaParse reports structural problems (e.g. a row with too many fields) separately
  // from the data, keyed by row index. Collect them so those rows get flagged too.
  const parserProblems = new Map<number, string[]>()
  for (const error of result.errors) {
    if (error.row === undefined) continue
    const problems = parserProblems.get(error.row) ?? []
    problems.push(error.message)
    parserProblems.set(error.row, problems)
  }

  return normalizeRows(result.data, parserProblems)
}

// Hours in the file have one decimal, but adding floats drifts (7.3 + 6.6 + ... = 40.89999999999999).
// Rounding to 2 decimals keeps totals exact so threshold comparisons like "> 60" are reliable.
function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100
}

// Turn "MM/DD/YYYY" into a Date, or null if the text is not a real date (e.g. 02/30/2025).
export function parseWeekEnding(text: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month - 1, day)

  // new Date() silently rolls invalid dates over (Feb 30 -> Mar 2), so check it round-trips.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

// Validate each row and compute its totals. Rows with unusable values are left out
// of the records and reported as issues instead, so they can't distort the totals.
export function normalizeRows(
  rows: RawRow[],
  parserProblems: Map<number, string[]> = new Map(),
): ParseResult {
  const records: WeekRecord[] = []
  const issues: Anomaly[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2 // +1 for the header line, +1 because lines are counted from 1
    const problems: string[] = [...(parserProblems.get(index) ?? [])]

    const readText = (field: string): string => {
      const value = (row[field] ?? '').trim()
      if (value === '') problems.push(`${field} is blank`)
      return value
    }

    const readNumber = (field: string): number => {
      const value = (row[field] ?? '').trim()
      if (value === '') {
        problems.push(`${field} is blank`)
        return 0
      }
      const number = Number(value)
      if (!Number.isFinite(number)) {
        problems.push(`${field} is not a number ("${value}")`)
        return 0
      }
      if (number < 0) {
        problems.push(`${field} is negative (${number})`)
        return 0
      }
      return number
    }

    const name = readText('employee_name')
    const employeeId = readText('employee_id')
    const level = readText('level')
    const occupation = readText('occupation')
    const weekEndingRaw = readText('week_ending')

    if (employeeId !== '' && !/^\d+$/.test(employeeId)) {
      problems.push(`employee_id is not numeric ("${employeeId}")`)
    }
    if (level !== '' && level !== 'APPRENTICE' && level !== 'JOURNEYWORKER') {
      problems.push(`level is not APPRENTICE or JOURNEYWORKER ("${level}")`)
    }

    const weekEnding = weekEndingRaw === '' ? null : parseWeekEnding(weekEndingRaw)
    if (weekEndingRaw !== '' && weekEnding === null) {
      problems.push(`week_ending is not a valid MM/DD/YYYY date ("${weekEndingRaw}")`)
    }

    const days: DayHours[] = DAYS.map((day) => ({
      day,
      st: readNumber(`${day}_st_hours`),
      ot: readNumber(`${day}_ot_hours`),
    }))
    const standardRate = readNumber('standard_rate')
    const overtimeRate = readNumber('overtime_rate')
    const benefitsRate = readNumber('benefits_rate')

    if (problems.length > 0 || weekEnding === null) {
      issues.push({
        rule: 'invalid-data',
        severity: 'high',
        message: `Row excluded from calculations: ${problems.join('; ')}`,
        rowNumber,
        employeeId,
        weekEnding: weekEndingRaw,
      })
      return
    }

    // The week is supposed to end on a Saturday. The row is still usable, so keep it but flag it.
    if (weekEnding.getDay() !== 6) {
      issues.push({
        rule: 'non-saturday-week',
        severity: 'medium',
        message: `Week ending ${weekEndingRaw} is not a Saturday`,
        rowNumber,
        employeeId,
        weekEnding: weekEndingRaw,
      })
    }

    let stHours = 0
    let otHours = 0
    for (const d of days) {
      stHours += d.st
      otHours += d.ot
    }
    stHours = roundHours(stHours)
    otHours = roundHours(otHours)
    const totalHours = roundHours(stHours + otHours)
    const grossPay = stHours * standardRate + otHours * overtimeRate
    const benefitsCost = totalHours * benefitsRate

    records.push({
      rowNumber,
      employeeId,
      name,
      level,
      occupation,
      weekEnding,
      weekEndingRaw,
      days,
      stHours,
      otHours,
      totalHours,
      standardRate,
      overtimeRate,
      benefitsRate,
      grossPay,
      benefitsCost,
      totalCost: grossPay + benefitsCost,
    })
  })

  return { records, issues }
}
