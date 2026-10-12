import { useState } from 'react'
import { RULE_LABELS } from '../lib/anomalies'
import type { FlaggedRow } from '../lib/anomalies'
import { formatDate, formatSignedMoney } from '../lib/format'
import type { Anomaly, Severity } from '../lib/types'

// What each severity means for the project manager; shown as a tooltip on its filter chip.
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

function AnomalyTable({ rows }: { rows: FlaggedRow[] }) {
  const [filter, setFilter] = useState<Severity | 'all'>('all')

  if (rows.length === 0) {
    return <p>No entries need review.</p>
  }

  const visibleRows = filter === 'all' ? rows : rows.filter((r) => r.severity === filter)
  // Only offer filters for severities that actually occur.
  const chips = SEVERITIES.map((severity) => ({
    severity,
    count: rows.filter((r) => r.severity === severity).length,
  })).filter((chip) => chip.count > 0)

  return (
    <>
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

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Employee</th>
              <th>Week ending</th>
              <th>Why it was flagged</th>
              <th className="number" title="This week's cost minus the same hours at the employee's usual rates">
                Cost impact
              </th>
              <th className="number" title="Line number in the CSV file, for whoever fixes the data">
                Line
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.rowNumber}>
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
                <td className="reasons">
                  <ul>
                    {row.anomalies.map((anomaly, i) => (
                      <li key={i} className={isSecondary(anomaly, row) ? 'secondary' : undefined}>
                        <strong>{RULE_LABELS[anomaly.rule]}:</strong> {anomaly.message}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="number">
                  {row.costImpact === undefined ? <span className="muted">—</span> : formatSignedMoney(row.costImpact)}
                </td>
                <td className="number muted">{row.rowNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default AnomalyTable
