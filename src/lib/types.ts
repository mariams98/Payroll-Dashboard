// Day prefixes used in the CSV column names (mon_st_hours, mon_ot_hours, ...).
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]

// One CSV row exactly as PapaParse returns it: column name -> text value.
export type RawRow = Record<string, string>

export interface DayHours {
  day: Day
  st: number
  ot: number
}

// One employee's week after parsing, with hours and pay already totalled.
export interface WeekRecord {
  rowNumber: number // line number in the CSV file (the header is line 1)
  employeeId: string
  name: string
  level: string // APPRENTICE or JOURNEYWORKER
  occupation: string
  weekEnding: Date
  weekEndingRaw: string // original MM/DD/YYYY text, used for display and grouping
  days: DayHours[]
  stHours: number
  otHours: number
  totalHours: number
  standardRate: number
  overtimeRate: number
  benefitsRate: number
  grossPay: number // stHours * standardRate + otHours * overtimeRate
  benefitsCost: number // totalHours * benefitsRate
  totalCost: number // grossPay + benefitsCost
}

export type Severity = 'high' | 'medium' | 'low'

export type RuleId =
  | 'invalid-data'
  | 'non-saturday-week'
  | 'rate-deviation'
  | 'apprentice-over-journeyworker'
  | 'ot-rate-below-st'
  | 'daily-hours-high'
  | 'daily-st-over-8'
  | 'weekly-hours-high'
  | 'weekly-hours-low'
  | 'ot-without-st'
  | 'duplicate-week'
  | 'name-mismatch'

// One reason a row was flagged. A row can have several.
export interface Anomaly {
  rule: RuleId
  severity: Severity
  message: string
  rowNumber: number
  employeeId: string
  weekEnding: string
}
