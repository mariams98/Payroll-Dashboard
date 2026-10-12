import { describe, expect, it } from 'vitest'
import csvText from '../../public/payroll_data.csv?raw'
import {
  canonicalNames,
  detectAnomalies,
  findApprenticesPaidAboveJourneyworkers,
  findDuplicateWeeks,
  findHighDailyHours,
  findNameMismatches,
  findNamesOnMultipleIds,
  findOvertimeRateBelowStandard,
  findOvertimeWithoutStandard,
  findRateDeviations,
  findStandardHoursOverDailyMax,
  findWeeklyHours,
  groupAnomaliesByRow,
} from './anomalies'
import { roundHours } from './math'
import { normalizeRows, parseCsv, parseWeekEnding } from './parse'
import { DAYS } from './types'
import type { Anomaly, WeekRecord } from './types'

interface RecordOptions {
  employeeId?: string
  name?: string
  level?: string
  occupation?: string
  weekEnding?: string
  st?: number[] // Mon..Sun standard hours
  ot?: number[] // Mon..Sun overtime hours
  standardRate?: number
  overtimeRate?: number
}

// Build a WeekRecord directly. Defaults: a 40-hour journeyworker week at $40/hr.
let nextRowNumber = 2
function makeRecord(options: RecordOptions = {}): WeekRecord {
  const st = options.st ?? [8, 8, 8, 8, 8, 0, 0]
  const ot = options.ot ?? [0, 0, 0, 0, 0, 0, 0]
  const weekEndingRaw = options.weekEnding ?? '03/01/2025'
  const weekEnding = parseWeekEnding(weekEndingRaw)
  if (weekEnding === null) throw new Error(`Bad test date ${weekEndingRaw}`)

  const standardRate = options.standardRate ?? 40
  const overtimeRate = options.overtimeRate ?? standardRate * 1.5
  const stHours = roundHours(st.reduce((sum, h) => sum + h, 0))
  const otHours = roundHours(ot.reduce((sum, h) => sum + h, 0))
  const grossPay = stHours * standardRate + otHours * overtimeRate

  return {
    rowNumber: nextRowNumber++,
    employeeId: options.employeeId ?? '1',
    name: options.name ?? 'Test Person',
    level: options.level ?? 'JOURNEYWORKER',
    occupation: options.occupation ?? 'Painter',
    weekEnding,
    weekEndingRaw,
    days: DAYS.map((day, i) => ({ day, st: st[i], ot: ot[i] })),
    stHours,
    otHours,
    totalHours: roundHours(stHours + otHours),
    standardRate,
    overtimeRate,
    benefitsRate: 10,
    grossPay,
    benefitsCost: 0,
    totalCost: grossPay,
  }
}

describe('findRateDeviations', () => {
  it('flags only the outlier week, because the baseline is the median', () => {
    // Mean of these rates is 55, so with a mean baseline the normal $40 weeks would
    // also look 27% off. The median stays at $40, so only the $100 week is flagged.
    const records = [40, 40, 40, 100].map((rate) => makeRecord({ standardRate: rate }))
    const anomalies = findRateDeviations(records)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].rowNumber).toBe(records[3].rowNumber)
    expect(anomalies[0].message).toContain('150% above')
  })

  it('flags a drop as well as a spike', () => {
    const records = [40, 40, 40, 20].map((rate) => makeRecord({ standardRate: rate }))
    expect(findRateDeviations(records)[0].message).toContain('50% below')
  })

  it('ignores changes within the 20% limit', () => {
    const records = [40, 40, 40, 46].map((rate) => makeRecord({ standardRate: rate })) // +15%
    expect(findRateDeviations(records)).toEqual([])
  })

  it('skips employees with too few weeks to know their usual rate', () => {
    // With only $40 and $100, the median is $70 and both weeks would look wrong.
    const records = [40, 100].map((rate) => makeRecord({ standardRate: rate }))
    expect(findRateDeviations(records)).toEqual([])
  })

  it('compares each employee only with themselves', () => {
    const records = [
      makeRecord({ employeeId: '1', standardRate: 20 }),
      makeRecord({ employeeId: '2', standardRate: 60 }),
    ]
    expect(findRateDeviations(records)).toEqual([])
  })
})

describe('findApprenticesPaidAboveJourneyworkers', () => {
  const journeyworkers = [
    makeRecord({ employeeId: '10', standardRate: 35 }),
    makeRecord({ employeeId: '11', standardRate: 37 }),
  ] // typical Painter journeyworker rate = $36

  it('flags an apprentice paid above the typical journeyworker in the same trade', () => {
    const apprentices = [
      makeRecord({ employeeId: '20', level: 'APPRENTICE', standardRate: 22 }),
      makeRecord({ employeeId: '21', level: 'APPRENTICE', standardRate: 40 }),
    ]
    const anomalies = findApprenticesPaidAboveJourneyworkers([...journeyworkers, ...apprentices])
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].employeeId).toBe('21')
    expect(anomalies[0].message).toContain('$36.00')
  })

  it('skips trades with no journeyworkers to compare with', () => {
    const apprentice = makeRecord({ level: 'APPRENTICE', occupation: 'Mason', standardRate: 99 })
    expect(findApprenticesPaidAboveJourneyworkers([...journeyworkers, apprentice])).toEqual([])
  })
})

describe('findOvertimeRateBelowStandard', () => {
  it('flags an overtime rate lower than the standard rate', () => {
    const records = [makeRecord({ standardRate: 40, overtimeRate: 30 }), makeRecord({ standardRate: 40, overtimeRate: 40 })]
    const anomalies = findOvertimeRateBelowStandard(records)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].rowNumber).toBe(records[0].rowNumber)
  })
})

describe('findHighDailyHours', () => {
  it('flags a day above 16 hours and names the day', () => {
    const record = makeRecord({ st: [12, 8, 8, 8, 8, 0, 0], ot: [8.4, 0, 0, 0, 0, 0, 0] })
    const anomalies = findHighDailyHours([record])
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].message).toContain('Mon 20.4h')
  })

  it('does not flag exactly 16 hours', () => {
    const record = makeRecord({ st: [8.1, 8, 8, 8, 8, 0, 0], ot: [7.9, 0, 0, 0, 0, 0, 0] })
    expect(findHighDailyHours([record])).toEqual([])
  })
})

describe('findStandardHoursOverDailyMax', () => {
  it('flags standard hours above 8 and lists every such day', () => {
    const record = makeRecord({ st: [9.4, 8, 9.5, 8, 8, 0, 0] })
    const anomalies = findStandardHoursOverDailyMax([record])
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].message).toContain('Mon 9.4h, Wed 9.5h')
  })

  it('does not flag exactly 8 standard hours', () => {
    expect(findStandardHoursOverDailyMax([makeRecord()])).toEqual([])
  })
})

describe('findWeeklyHours', () => {
  it('flags a week above 60 hours as high severity', () => {
    const record = makeRecord({ st: [8, 8, 8, 8, 8, 8, 8], ot: [1, 1, 1, 1, 1, 0, 0] }) // 61h
    const anomalies = findWeeklyHours([record])
    expect(anomalies[0].rule).toBe('weekly-hours-high')
    expect(anomalies[0].severity).toBe('high')
  })

  it('flags a week below 8 hours as low severity', () => {
    const record = makeRecord({ st: [4, 0, 0, 0, 0, 0, 0] })
    const anomalies = findWeeklyHours([record])
    expect(anomalies[0].rule).toBe('weekly-hours-low')
    expect(anomalies[0].severity).toBe('low')
  })

  it('does not flag a normal 40-hour week', () => {
    expect(findWeeklyHours([makeRecord()])).toEqual([])
  })

  it('does not flag exactly 60 hours when the raw float sum drifts above 60', () => {
    // These add up to 60.00000000000001 without rounding. Goes through the real parser,
    // because that is where the rounding happens.
    const st = ['10.9', '9.8', '7.3', '11.3', '6.9', '6.6', '7.2']
    const row: Record<string, string> = {
      employee_name: 'Test Person',
      employee_id: '1',
      level: 'JOURNEYWORKER',
      occupation: 'Painter',
      week_ending: '03/01/2025',
      standard_rate: '40',
      overtime_rate: '60',
      benefits_rate: '10',
    }
    DAYS.forEach((day, i) => {
      row[`${day}_st_hours`] = st[i]
      row[`${day}_ot_hours`] = '0'
    })
    const { records } = normalizeRows([row])
    expect(records[0].totalHours).toBe(60)
    expect(findWeeklyHours(records)).toEqual([])
  })
})

describe('findOvertimeWithoutStandard', () => {
  it('flags overtime on a day with no standard hours', () => {
    const record = makeRecord({ st: [8, 8, 8, 8, 8, 0, 0], ot: [1, 0, 0, 0, 0, 3, 0] })
    const anomalies = findOvertimeWithoutStandard([record])
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].message).toContain('Sat 3h OT')
    expect(anomalies[0].message).not.toContain('Mon')
  })
})

describe('findDuplicateWeeks', () => {
  it('flags every row when an employee has two rows for the same week', () => {
    const records = [
      makeRecord({ weekEnding: '03/01/2025' }),
      makeRecord({ weekEnding: '03/01/2025' }),
      makeRecord({ weekEnding: '03/08/2025' }),
    ]
    const anomalies = findDuplicateWeeks(records)
    expect(anomalies).toHaveLength(2)
    expect(anomalies[0].message).toContain(`CSV lines ${records[0].rowNumber}, ${records[1].rowNumber}`)
  })

  it('does not flag different employees in the same week', () => {
    const records = [makeRecord({ employeeId: '1' }), makeRecord({ employeeId: '2' })]
    expect(findDuplicateWeeks(records)).toEqual([])
  })
})

describe('findNameMismatches', () => {
  it('flags the row whose name differs from the usual name for that ID', () => {
    const records = [
      makeRecord({ name: 'Maxine Dach' }),
      makeRecord({ name: 'Maxine Dach' }),
      makeRecord({ name: 'Maxine Danch' }),
    ]
    const anomalies = findNameMismatches(records)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].message).toContain('"Maxine Danch" differs from "Maxine Dach"')
  })
})

describe('findNamesOnMultipleIds', () => {
  it('flags a name used under two different IDs', () => {
    const records = [makeRecord({ employeeId: '1', name: 'Sam Lee' }), makeRecord({ employeeId: '2', name: 'Sam Lee' })]
    const anomalies = findNamesOnMultipleIds(records)
    expect(anomalies).toHaveLength(2)
    expect(anomalies[0].message).toContain('employee IDs 1, 2')
  })
})

describe('groupAnomaliesByRow', () => {
  const anomaly = (rowNumber: number, severity: Anomaly['severity'], rule: Anomaly['rule']): Anomaly => ({
    rule,
    severity,
    message: '',
    rowNumber,
    employeeId: '1',
    weekEnding: '03/01/2025',
  })

  it('combines anomalies for the same row and uses the most severe one', () => {
    const rows = groupAnomaliesByRow(
      [anomaly(5, 'medium', 'daily-st-high'), anomaly(5, 'high', 'weekly-hours-high')],
      new Map([['1', 'Test Person']]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].severity).toBe('high')
    expect(rows[0].name).toBe('Test Person')
    expect(rows[0].anomalies.map((a) => a.rule)).toEqual(['weekly-hours-high', 'daily-st-high'])
  })

  it('sorts rows by severity, then by line number', () => {
    const rows = groupAnomaliesByRow(
      [anomaly(9, 'low', 'weekly-hours-low'), anomaly(7, 'high', 'rate-deviation'), anomaly(3, 'high', 'rate-deviation')],
      new Map(),
    )
    expect(rows.map((r) => r.rowNumber)).toEqual([3, 7, 9])
  })
})

describe('detectAnomalies on the real data file', () => {
  // Expected rows come from profiling the data before writing the rules, so these
  // check that each rule flags the right rows, not just the right number of rows.
  const anomalies = detectAnomalies(parseCsv(csvText).records)

  // "employeeId week_ending" for every row a rule flagged, sorted so order doesn't matter.
  function flaggedRows(rule: string): string[] {
    return anomalies
      .filter((a) => a.rule === rule)
      .map((a) => `${a.employeeId} ${a.weekEnding}`)
      .sort()
  }

  it('flags only the expected rules', () => {
    const rules = [...new Set(anomalies.map((a) => a.rule))].sort()
    expect(rules).toEqual([
      'apprentice-over-journeyworker',
      'daily-hours-high',
      'daily-st-high',
      'name-mismatch',
      'rate-deviation',
      'weekly-hours-high',
    ])
  })

  it('flags the six weeks where pay rates jumped or dropped', () => {
    expect(flaggedRows('rate-deviation')).toEqual([
      '1000 04/26/2025',
      '1001 03/15/2025',
      '1001 05/17/2025',
      '1009 04/19/2025',
      '1011 04/19/2025',
      '1018 05/03/2025',
    ])
  })

  it('flags the apprentice paid above journeyworkers in both spike weeks', () => {
    expect(flaggedRows('apprentice-over-journeyworker')).toEqual(['1001 03/15/2025', '1001 05/17/2025'])
  })

  it('flags the four ~20-hour days', () => {
    expect(flaggedRows('daily-hours-high')).toEqual([
      '1007 03/15/2025',
      '1008 04/12/2025',
      '1009 04/12/2025',
      '1019 06/07/2025',
    ])
  })

  it('flags the four 85+ hour weeks', () => {
    expect(flaggedRows('weekly-hours-high')).toEqual([
      '1011 04/26/2025',
      '1014 04/05/2025',
      '1016 05/31/2025',
      '1021 03/01/2025',
    ])
  })

  it('flags standard hours above 8 in exactly those eight weeks', () => {
    expect(flaggedRows('daily-st-high')).toEqual([
      '1007 03/15/2025',
      '1008 04/12/2025',
      '1009 04/12/2025',
      '1011 04/26/2025',
      '1014 04/05/2025',
      '1016 05/31/2025',
      '1019 06/07/2025',
      '1021 03/01/2025',
    ])
  })

  it('groups into 17 flagged rows: 14 high, then the 3 medium name mismatches', () => {
    const rows = groupAnomaliesByRow(anomalies, canonicalNames(parseCsv(csvText).records))
    expect(rows).toHaveLength(17)
    expect(rows.filter((r) => r.severity === 'high')).toHaveLength(14)
    expect(rows.slice(14).every((r) => r.anomalies[0].rule === 'name-mismatch')).toBe(true)
    // 1001's spike week is flagged by two rules but appears once.
    const spike = rows.find((r) => r.employeeId === '1001' && r.weekEnding === '03/15/2025')
    expect(spike?.anomalies.map((a) => a.rule)).toEqual(['rate-deviation', 'apprentice-over-journeyworker'])
    expect(spike?.name).toBe("Kamille O'Reilly")
  })

  it('flags the misspelled or mismatched names, not the usual spelling', () => {
    const messages = anomalies.filter((a) => a.rule === 'name-mismatch').map((a) => a.message)
    expect(flaggedRows('name-mismatch')).toEqual(['1015 06/07/2025', '1017 05/03/2025', '1021 05/03/2025'])
    expect(messages.some((m) => m.startsWith('Name "Maxine Danch"'))).toBe(true)
    expect(messages.some((m) => m.startsWith('Name "Tyler Reichrt"'))).toBe(true)
    expect(messages.some((m) => m.startsWith('Name "Deanna Wisozk"'))).toBe(true)
  })
})
