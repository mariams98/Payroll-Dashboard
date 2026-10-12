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
    const flaggedRows = groupAnomaliesByRow(anomalies, canonicalNames(records))
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
            Weekly payroll · {formatDate(data.summary.firstWeek)} – {formatDate(data.summary.lastWeek)} ·{' '}
            {data.summary.employeeCount} employees · {data.recordCount} timesheets
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
          {/* The header already says what this is; the heading stays for screen readers. */}
          <h2 className="visually-hidden">Summary</h2>
          <SummaryCards summary={data.summary} anomalySummary={data.anomalySummary} />
        </section>
      )}
      {/* Shown even with no valid rows, since then it lists why every row was rejected. */}
      {data && (
        <section id="entries">
          <h2>Entries to review ({data.flaggedRows.length})</h2>
          {(data.anomalySummary.costAboveUsualRates > 0 || data.anomalySummary.costBelowUsualRates > 0) && (
            <p className="impact">
              Weeks with unusual pay rates cost about{' '}
              <strong>{formatWholeMoney(data.anomalySummary.costAboveUsualRates)} more</strong> and{' '}
              <strong>{formatWholeMoney(data.anomalySummary.costBelowUsualRates)} less</strong> than the
              same hours at each employee's usual rates.
            </p>
          )}
          <p className="note">
            <strong>High</strong> = check before payroll goes out · <strong>Medium</strong> = likely a
            data-entry mistake · <strong>Low</strong> = worth a glance
          </p>
          <FlagRules />
          <AnomalyTable rows={data.flaggedRows} />
        </section>
      )}
      {data && data.recordCount > 0 && (
        <section>
          <h2>Employees</h2>
          <EmployeeTable employees={data.employees} />
        </section>
      )}
    </main>
  )
}

export default App
