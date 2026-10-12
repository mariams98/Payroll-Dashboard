import { formatMoney } from './format'
import { groupBy, median, roundHours } from './math'
import {
  DAILY_HOURS_HIGH,
  DAILY_ST_MAX,
  MIN_WEEKS_FOR_RATE_BASELINE,
  RATE_DEVIATION_LIMIT,
  WEEKLY_HOURS_HIGH,
  WEEKLY_HOURS_LOW,
} from './thresholds'
import type { Anomaly, Day, RuleId, Severity, WeekRecord } from './types'

const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

// Build an anomaly for one record, so every rule doesn't repeat the row details.
function flag(record: WeekRecord, rule: RuleId, severity: Severity, message: string): Anomaly {
  return {
    rule,
    severity,
    message,
    rowNumber: record.rowNumber,
    employeeId: record.employeeId,
    weekEnding: record.weekEndingRaw,
  }
}

// The name used most often for each employee_id. On a tie, the name seen first wins.
export function canonicalNames(records: WeekRecord[]): Map<string, string> {
  const names = new Map<string, string>()
  for (const [employeeId, rows] of groupBy(records, (r) => r.employeeId)) {
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1)

    let best = rows[0].name
    for (const [name, count] of counts) {
      if (count > (counts.get(best) ?? 0)) best = name
    }
    names.set(employeeId, best)
  }
  return names
}

// 1. A week's standard rate is far from that employee's usual (median) rate.
export function findRateDeviations(records: WeekRecord[]): Anomaly[] {
  const names = canonicalNames(records)
  const anomalies: Anomaly[] = []

  for (const [employeeId, rows] of groupBy(records, (r) => r.employeeId)) {
    if (rows.length < MIN_WEEKS_FOR_RATE_BASELINE) continue // too few weeks to know the usual rate
    const typicalRate = median(rows.map((r) => r.standardRate))
    if (typicalRate === 0) continue // no meaningful baseline to compare against

    for (const row of rows) {
      const change = (row.standardRate - typicalRate) / typicalRate
      if (Math.abs(change) > RATE_DEVIATION_LIMIT) {
        const percent = Math.round(Math.abs(change) * 100)
        const direction = change > 0 ? 'above' : 'below'
        anomalies.push(
          flag(
            row,
            'rate-deviation',
            'high',
            `Standard rate ${formatMoney(row.standardRate)} is ${percent}% ${direction} ` +
              `${names.get(employeeId)}'s typical ${formatMoney(typicalRate)} ` +
              `(OT ${formatMoney(row.overtimeRate)}, benefits ${formatMoney(row.benefitsRate)})`,
          ),
        )
      }
    }
  }
  return anomalies
}

// 2. An apprentice is paid more than the typical journeyworker in the same trade.
export function findApprenticesPaidAboveJourneyworkers(records: WeekRecord[]): Anomaly[] {
  // Typical journeyworker rate per trade = median of each journeyworker's own median rate,
  // so one journeyworker's bad week doesn't move the benchmark.
  const journeyworkerRates = new Map<string, number>()
  const journeyworkers = records.filter((r) => r.level === 'JOURNEYWORKER')
  for (const [occupation, rows] of groupBy(journeyworkers, (r) => r.occupation)) {
    const employeeRates: number[] = []
    for (const employeeRows of groupBy(rows, (r) => r.employeeId).values()) {
      employeeRates.push(median(employeeRows.map((r) => r.standardRate)))
    }
    journeyworkerRates.set(occupation, median(employeeRates))
  }

  const anomalies: Anomaly[] = []
  for (const row of records) {
    if (row.level !== 'APPRENTICE') continue
    const journeyworkerRate = journeyworkerRates.get(row.occupation)
    if (journeyworkerRate === undefined) continue // no journeyworkers in this trade to compare with

    if (row.standardRate > journeyworkerRate) {
      anomalies.push(
        flag(
          row,
          'apprentice-over-journeyworker',
          'medium',
          `Apprentice standard rate ${formatMoney(row.standardRate)} is above the typical ` +
            `${row.occupation} journeyworker rate ${formatMoney(journeyworkerRate)}`,
        ),
      )
    }
  }
  return anomalies
}

// 3. Overtime is paid at a lower rate than standard time.
export function findOvertimeRateBelowStandard(records: WeekRecord[]): Anomaly[] {
  return records
    .filter((r) => r.overtimeRate < r.standardRate)
    .map((r) =>
      flag(
        r,
        'ot-rate-below-st',
        'high',
        `Overtime rate ${formatMoney(r.overtimeRate)} is lower than standard rate ${formatMoney(r.standardRate)}`,
      ),
    )
}

// 4. A single day with an implausible number of hours.
export function findHighDailyHours(records: WeekRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  for (const row of records) {
    const longDays = row.days.filter((d) => roundHours(d.st + d.ot) > DAILY_HOURS_HIGH)
    if (longDays.length > 0) {
      const list = longDays.map((d) => `${DAY_LABELS[d.day]} ${roundHours(d.st + d.ot)}h`).join(', ')
      anomalies.push(
        flag(row, 'daily-hours-high', 'high', `More than ${DAILY_HOURS_HIGH} hours in one day: ${list}`),
      )
    }
  }
  return anomalies
}

// 5. More than 8 standard hours in a day; the extra hours were probably overtime.
export function findStandardHoursOverDailyMax(records: WeekRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  for (const row of records) {
    const days = row.days.filter((d) => d.st > DAILY_ST_MAX)
    if (days.length > 0) {
      const list = days.map((d) => `${DAY_LABELS[d.day]} ${d.st}h`).join(', ')
      anomalies.push(
        flag(
          row,
          'daily-st-high',
          'medium',
          `Standard hours above ${DAILY_ST_MAX} on ${list}; hours past ${DAILY_ST_MAX} are usually overtime`,
        ),
      )
    }
  }
  return anomalies
}

// 6 and 7. Weekly total hours that are implausibly high or low.
export function findWeeklyHours(records: WeekRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  for (const row of records) {
    const detail = `(${row.stHours} ST + ${row.otHours} OT)`
    if (row.totalHours > WEEKLY_HOURS_HIGH) {
      anomalies.push(
        flag(row, 'weekly-hours-high', 'high', `${row.totalHours} hours this week ${detail}, above ${WEEKLY_HOURS_HIGH}`),
      )
    } else if (row.totalHours < WEEKLY_HOURS_LOW) {
      anomalies.push(
        flag(row, 'weekly-hours-low', 'low', `Only ${row.totalHours} hours this week ${detail}, below ${WEEKLY_HOURS_LOW}`),
      )
    }
  }
  return anomalies
}

// 8. Overtime recorded on a day with no standard hours.
export function findOvertimeWithoutStandard(records: WeekRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  for (const row of records) {
    const days = row.days.filter((d) => d.ot > 0 && d.st === 0)
    if (days.length > 0) {
      const list = days.map((d) => `${DAY_LABELS[d.day]} ${d.ot}h OT`).join(', ')
      anomalies.push(flag(row, 'ot-without-st', 'medium', `Overtime with no standard hours: ${list}`))
    }
  }
  return anomalies
}

// 9. The same employee has more than one row for the same week (possible double payment).
export function findDuplicateWeeks(records: WeekRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  const groups = groupBy(records, (r) => `${r.employeeId}|${r.weekEnding.getTime()}`)
  for (const rows of groups.values()) {
    if (rows.length < 2) continue
    const lines = rows.map((r) => r.rowNumber).join(', ')
    for (const row of rows) {
      anomalies.push(
        flag(
          row,
          'duplicate-week',
          'high',
          `Employee ${row.employeeId} has ${rows.length} rows for week ending ${row.weekEndingRaw} (CSV lines ${lines})`,
        ),
      )
    }
  }
  return anomalies
}

// 10. A row's name differs from the name usually used for that employee_id.
export function findNameMismatches(records: WeekRecord[]): Anomaly[] {
  const names = canonicalNames(records)
  return records
    .filter((r) => r.name !== names.get(r.employeeId))
    .map((r) =>
      flag(
        r,
        'name-mismatch',
        'medium',
        `Name "${r.name}" differs from "${names.get(r.employeeId)}" used on other rows for ID ${r.employeeId}`,
      ),
    )
}

// 11. The same name appears under more than one employee_id. Could be two people
// who share a name, so this is low severity.
export function findNamesOnMultipleIds(records: WeekRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  for (const [name, rows] of groupBy(records, (r) => r.name)) {
    const ids = [...new Set(rows.map((r) => r.employeeId))]
    if (ids.length < 2) continue
    for (const row of rows) {
      anomalies.push(
        flag(row, 'name-on-multiple-ids', 'low', `Name "${name}" is used under employee IDs ${ids.join(', ')}`),
      )
    }
  }
  return anomalies
}

// Run every rule and return all hits. A row can appear more than once with different reasons.
export function detectAnomalies(records: WeekRecord[]): Anomaly[] {
  return [
    ...findRateDeviations(records),
    ...findApprenticesPaidAboveJourneyworkers(records),
    ...findOvertimeRateBelowStandard(records),
    ...findHighDailyHours(records),
    ...findStandardHoursOverDailyMax(records),
    ...findWeeklyHours(records),
    ...findOvertimeWithoutStandard(records),
    ...findDuplicateWeeks(records),
    ...findNameMismatches(records),
    ...findNamesOnMultipleIds(records),
  ]
}
