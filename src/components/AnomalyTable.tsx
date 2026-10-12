import { Fragment, useState } from 'react'
import { RULE_LABELS } from '../lib/anomalies'
import type { FlaggedRow } from '../lib/anomalies'
import { formatDate, formatHours, formatMoney, formatSignedMoney } from '../lib/format'
import { DAILY_HOURS_HIGH, DAILY_HOURS_LOW, DAILY_ST_MAX } from '../lib/thresholds'
import type { Anomaly, DayHours, Severity, WeekRecord } from '../lib/types'

// What each severity means for the project manager; shown as a tooltip on its filter chip and badge.
const SEVERITY_HELP: Record<Severity, string> = {
  high: 'Pay or hours are almost certainly wrong. Check before payroll goes out.',
  medium: 'Likely a data-entry mistake.',
  low: 'Could be legitimate. Worth a glance.',
}

const SEVERITIES: Severity[] = ['high', 'medium', 'low']

// "Over 8 ST hours" always appears together with a stronger reason in this data,
// so when a row has other reasons it is shown smaller, as supporting detail.
function isSecondary(anomaly: Anomaly, row: FlaggedRow): boolean {
  return anomaly.rule === 'daily-st-high' && row.anomalies.length > 1
}

// A day's total breaks a daily rule (too long, or worked but very short).
function isUnusualTotal(day: DayHours): boolean {
  const total = day.st + day.ot
  return total > DAILY_HOURS_HIGH || (total > 0 && total < DAILY_HOURS_LOW)
}

// Highlight only the cell that breaks a rule: standard hours over 8 flag the ST cell alone,
// while an unusual daily total flags both cells.
function stClass(day: DayHours): string {
  return day.st > DAILY_ST_MAX || isUnusualTotal(day) ? 'number flagged' : 'number'
}

function otClass(day: DayHours): string {
  return isUnusualTotal(day) ? 'number flagged' : 'number'
}

// The expanded part of a row: every reason in full, the week's hours by day, its rates, and the CSV line.
function RowDetails({ row, record }: { row: FlaggedRow; record?: WeekRecord }) {
  return (
    <div className="row-details">
      <ul className="reasons">
        {row.anomalies.map((anomaly, i) => (
          <li key={i} className={isSecondary(anomaly, row) ? 'secondary' : undefined}>
            <strong>{RULE_LABELS[anomaly.rule]}:</strong> {anomaly.message}
          </li>
        ))}
      </ul>

      {record && (
        <>
          <table className="day-table">
            <thead>
              <tr>
                <th>Hours</th>
                {record.days.map((d) => (
                  <th key={d.day} className="number">
                    {d.day.charAt(0).toUpperCase() + d.day.slice(1)}
                  </th>
                ))}
                <th className="number">Week</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Standard</th>
                {record.days.map((d) => (
                  <td key={d.day} className={stClass(d)}>
                    {formatHours(d.st)}
                  </td>
                ))}
                <td className="number">{formatHours(record.stHours)}</td>
              </tr>
              <tr>
                <th>Overtime</th>
                {record.days.map((d) => (
                  <td key={d.day} className={otClass(d)}>
                    {formatHours(d.ot)}
                  </td>
                ))}
                <td className="number">{formatHours(record.otHours)}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted">
            Rates this week: standard {formatMoney(record.standardRate)} · overtime{' '}
            {formatMoney(record.overtimeRate)} · benefits {formatMoney(record.benefitsRate)} · week cost{' '}
            {formatMoney(record.totalCost)}
          </p>
        </>
      )}

      <p className="muted">Source: line {row.rowNumber} of the CSV file</p>
    </div>
  )
}

function AnomalyTable({ rows }: { rows: FlaggedRow[] }) {
  const [filter, setFilter] = useState<Severity | 'all'>('all')
  const [expanded, setExpanded] = useState<Set<number>>(new Set()) // row numbers that are open

  if (rows.length === 0) {
    return <p>No entries need review.</p>
  }

  const visibleRows = filter === 'all' ? rows : rows.filter((r) => r.severity === filter)
  const allExpanded = visibleRows.every((r) => expanded.has(r.rowNumber))

  // Only offer filters for severities that actually occur.
  const chips = SEVERITIES.map((severity) => ({
    severity,
    count: rows.filter((r) => r.severity === severity).length,
  })).filter((chip) => chip.count > 0)

  function toggleRow(rowNumber: number) {
    const next = new Set(expanded)
    if (next.has(rowNumber)) next.delete(rowNumber)
    else next.add(rowNumber)
    setExpanded(next)
  }

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(visibleRows.map((r) => r.rowNumber)))
  }

  return (
    <>
      <div className="table-toolbar">
        <div className="chips" role="group" aria-label="Filter by severity">
          <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All {rows.length}
          </button>
          {chips.map((chip) => (
            <button
              key={chip.severity}
              type="button"
              className={`chip chip-${chip.severity}`}
              aria-pressed={filter === chip.severity}
              title={SEVERITY_HELP[chip.severity]}
              onClick={() => setFilter(chip.severity)}
            >
              {chip.severity} {chip.count}
            </button>
          ))}
        </div>
        <button type="button" className="link-button" onClick={toggleAll}>
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="table-wrapper">
        <table className="entries-table">
          <thead>
            <tr>
              <th>
                <span className="visually-hidden">Show details</span>
              </th>
              <th>Severity</th>
              <th>Employee</th>
              <th>Week ending</th>
              <th>Issues</th>
              <th className="number" title="This week's cost minus the same hours at the employee's usual rates">
                Cost impact
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isOpen = expanded.has(row.rowNumber)
              const detailsId = `entry-details-${row.rowNumber}`
              return (
                <Fragment key={row.rowNumber}>
                  {/* The whole row toggles; the button inside makes it reachable by keyboard and screen readers. */}
                  <tr className="entry-row" onClick={() => toggleRow(row.rowNumber)}>
                    <td>
                      <button
                        type="button"
                        className="expand-button"
                        aria-expanded={isOpen}
                        aria-controls={detailsId}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${row.name || 'unknown employee'}, ${formatDate(row.weekEnding)}`}
                      >
                        {isOpen ? '▼' : '▶'}
                      </button>
                    </td>
                    <td>
                      <span className={`badge badge-${row.severity}`} title={SEVERITY_HELP[row.severity]}>
                        {row.severity}
                      </span>
                    </td>
                    <td>
                      {row.name || 'Unknown'}
                      {row.employeeId && <span className="muted"> #{row.employeeId}</span>}
                    </td>
                    <td>{formatDate(row.weekEnding)}</td>
                    <td className="issues">
                      {row.anomalies.map((anomaly, i) => (
                        <span key={i} className={isSecondary(anomaly, row) ? 'issue secondary' : 'issue'}>
                          {RULE_LABELS[anomaly.rule]}
                        </span>
                      ))}
                    </td>
                    <td className="number">
                      {row.costImpact === undefined ? <span className="muted">—</span> : formatSignedMoney(row.costImpact)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="details-row" id={detailsId}>
                      <td></td>
                      <td colSpan={5}>
                        <RowDetails row={row} record={row.record} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default AnomalyTable
