import { RULE_LABELS } from '../lib/anomalies'
import type { FlaggedRow } from '../lib/anomalies'

function AnomalyTable({ rows }: { rows: FlaggedRow[] }) {
  if (rows.length === 0) {
    return <p>No anomalies found.</p>
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Employee</th>
            <th>Week ending</th>
            <th>CSV line</th>
            <th>Why it was flagged</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowNumber}>
              <td>
                <span className={`badge badge-${row.severity}`}>{row.severity}</span>
              </td>
              <td>
                {row.name || 'Unknown'} <span className="muted">#{row.employeeId}</span>
              </td>
              <td>{row.weekEnding}</td>
              <td className="number">{row.rowNumber}</td>
              <td className="reasons">
                <ul>
                  {row.anomalies.map((anomaly, i) => (
                    <li key={i}>
                      <strong>{RULE_LABELS[anomaly.rule]}:</strong> {anomaly.message}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AnomalyTable
