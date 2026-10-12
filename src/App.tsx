import { useEffect, useMemo, useState } from 'react'
import EmployeeTable from './components/EmployeeTable'
import SummaryCards from './components/SummaryCards'
import { detectAnomalies } from './lib/anomalies'
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
    return {
      recordCount: records.length,
      issueCount: issues.length,
      summary: summarize(records),
      anomalySummary: summarizeAnomalies(anomalies),
      employees: employeeStats(records, anomalies),
    }
  }, [csvText])

  return (
    <main>
      <h1>Payroll Dashboard</h1>
      {loadError && <p className="error">{loadError}</p>}
      {!loadError && data === null && <p>Loading payroll data…</p>}
      {/* With no usable rows the stats would be empty or NaN, so say what happened instead. */}
      {data && data.recordCount === 0 && (
        <p className="error">
          No valid payroll rows found ({data.issueCount} rows had data problems).
        </p>
      )}
      {data && data.recordCount > 0 && (
        <>
          <section>
            <h2>Summary</h2>
            <SummaryCards summary={data.summary} anomalySummary={data.anomalySummary} />
          </section>
          <section>
            <h2>Employees</h2>
            <EmployeeTable employees={data.employees} />
          </section>
        </>
      )}
    </main>
  )
}

export default App
