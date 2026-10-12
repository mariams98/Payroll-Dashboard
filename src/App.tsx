import { useEffect, useMemo, useState } from 'react'
import AnomalyTable from './components/AnomalyTable'
import EmployeeTable from './components/EmployeeTable'
import FlagRules from './components/FlagRules'
import SummaryCards from './components/SummaryCards'
import { canonicalNames, detectAnomalies, groupAnomaliesByRow } from './lib/anomalies'
import { formatDate, formatWholeMoney } from './lib/format'
import { parseCsv } from './lib/parse'
import { employeeStats, summarize, summarizeAnomalies } from './lib/stats'

function App() {
  const [csvText, setCsvText] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false) // the "How are entries flagged?" panel

  // Load the CSV that ships with the app (public/payroll_data.csv).
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}payroll_data.csv`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.text()
      })
      .then(setCsvText)
      .catch((error: Error) => setLoadError(`Could not load payroll data: ${error.message}`))
  }, [])

  // All calculations happen once per file, in the pure functions under src/lib.
  const data = useMemo(() => {
    if (csvText === null) return null
    const { records, issues } = parseCsv(csvText)
    // Data problems found while parsing and the rule-based anomalies go in one list,
    // so the summary and the anomaly table always see both.
    const anomalies = [...issues, ...detectAnomalies(records)]
    const flaggedRows = groupAnomaliesByRow(anomalies, canonicalNames(records), records)
    return {
      recordCount: records.length,
      issueCount: issues.length,
      summary: summarize(records),
      // Built from the same grouped rows as the anomaly table, so the counts always match.
      anomalySummary: summarizeAnomalies(flaggedRows),
      employees: employeeStats(records, anomalies),
      flaggedRows,
    }
  }, [csvText])

  return (
    <main>
      <header className="page-header">
        <h1>Payroll Dashboard</h1>
        {data && data.recordCount > 0 && (
          <p className="subtitle">
            Weekly payroll · {formatDate(data.summary.firstWeek)} – {formatDate(data.summary.lastWeek)}
          </p>
        )}
      </header>
      {loadError && <p className="error">{loadError}</p>}
      {!loadError && data === null && <p>Loading payroll data…</p>}
      {/* With no usable rows the stats would be empty or NaN, so say what happened instead. */}
      {data && data.recordCount === 0 && (
        <p className="error">
          No valid payroll rows found ({data.issueCount} rows had data problems).
        </p>
      )}
      {/* Order follows a project manager's questions: what did we spend, what's wrong, then who. */}
      {data && data.recordCount > 0 && (
        <section>
          <h2>Summary</h2>
          <SummaryCards summary={data.summary} anomalySummary={data.anomalySummary} />
        </section>
      )}
      {/* Shown even with no valid rows, since then it lists why every row was rejected. */}
      {data && (
        <section id="entries">
          <div className="section-heading">
            <h2>Entries to review ({data.flaggedRows.length})</h2>
            {/* A click-to-open panel rather than a hover tooltip: it holds a whole table and must work on touch screens. */}
            <button
              type="button"
              className="link-button"
              aria-expanded={showRules}
              aria-controls="flag-rules"
              onClick={() => setShowRules(!showRules)}
            >
              ⓘ How are entries flagged?
            </button>
          </div>
          {showRules && <FlagRules />}
          {(data.anomalySummary.costAboveUsualRates > 0 || data.anomalySummary.costBelowUsualRates > 0) && (
            <p className="impact">
              Unusual pay rates: <strong>{formatWholeMoney(data.anomalySummary.costAboveUsualRates)} more</strong>{' '}
              and <strong>{formatWholeMoney(data.anomalySummary.costBelowUsualRates)} less</strong> than usual.
            </p>
          )}
          <p className="note">
            <strong>High</strong> = check before payroll goes out · <strong>Medium</strong> = likely a
            data-entry mistake · <strong>Low</strong> = worth a glance
          </p>
          <AnomalyTable rows={data.flaggedRows} />
        </section>
      )}
      {data && data.recordCount > 0 && (
        <section id="employees">
          <h2>Employees</h2>
          <EmployeeTable employees={data.employees} />
        </section>
      )}
    </main>
  )
}

export default App
