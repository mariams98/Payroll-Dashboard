import { useState } from 'react'
import { formatHours, formatLevel, formatMoney, formatWholeMoney } from '../lib/format'
import type { EmployeeStats } from '../lib/stats'

type SortKey = keyof EmployeeStats

interface Column {
  key: SortKey
  label: string
  format?: (value: number) => string
}

// Columns are listed once here; the header and body are both built from this list.
const COLUMNS: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'flaggedWeeks', label: 'Flagged weeks' }, // next to the name so it's visible without scrolling
  { key: 'employeeId', label: 'ID' },
  { key: 'level', label: 'Level' },
  { key: 'occupation', label: 'Trade' },
  { key: 'weeks', label: 'Weeks' },
  { key: 'totalHours', label: 'Total hours', format: formatHours },
  { key: 'totalCost', label: 'Total cost', format: formatWholeMoney },
  { key: 'minDailyHours', label: 'Min', format: formatHours },
  { key: 'avgDailyHours', label: 'Avg', format: formatHours },
  { key: 'maxDailyHours', label: 'Max', format: formatHours },
  { key: 'minStandardRate', label: 'Min', format: formatMoney },
  { key: 'avgStandardRate', label: 'Avg', format: formatMoney },
  { key: 'maxStandardRate', label: 'Max', format: formatMoney },
  { key: 'minOvertimeRate', label: 'Min', format: formatMoney },
  { key: 'avgOvertimeRate', label: 'Avg', format: formatMoney },
  { key: 'maxOvertimeRate', label: 'Max', format: formatMoney },
  { key: 'minBenefitsRate', label: 'Min', format: formatMoney },
  { key: 'avgBenefitsRate', label: 'Avg', format: formatMoney },
  { key: 'maxBenefitsRate', label: 'Max', format: formatMoney },
]

// Top header row that groups the min/avg/max columns. Spans must add up to COLUMNS.length.
const GROUPS = [
  { label: '', span: 8 },
  { label: 'Hours per day worked', span: 3 },
  { label: 'Standard rate', span: 3 },
  { label: 'Overtime rate', span: 3 },
  { label: 'Benefits rate', span: 3 },
]

// First column of each min/avg/max group gets a divider line on its left.
const GROUP_STARTS = new Set<SortKey>(['minDailyHours', 'minStandardRate', 'minOvertimeRate', 'minBenefitsRate'])

// CSS classes for a header or body cell: the Name column stays put while scrolling sideways.
function cellClass(column: Column, extra?: string): string | undefined {
  const classes = [extra, column.key === 'name' && 'sticky-col', GROUP_STARTS.has(column.key) && 'group-start']
  return classes.filter(Boolean).join(' ') || undefined
}

function EmployeeTable({ employees }: { employees: EmployeeStats[] }) {
  // Start with the employees who have the most flagged weeks, i.e. who to look into first.
  const [sortKey, setSortKey] = useState<SortKey>('flaggedWeeks')
  const [ascending, setAscending] = useState(false)

  // Clicking the current sort column flips the direction; a new column starts ascending.
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setAscending(!ascending)
    } else {
      setSortKey(key)
      setAscending(true)
    }
  }

  const sorted = [...employees].sort((a, b) => {
    const left = a[sortKey]
    const right = b[sortKey]
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right))
    return ascending ? result : -result
  })

  return (
    // table-scroll: the table scrolls inside its own box, so the header row can stay visible.
    <div className="table-wrapper table-scroll">
      <table>
        <thead>
          <tr>
            {GROUPS.map((group, i) => (
              <th key={i} colSpan={group.span} className={i > 0 ? 'group-header group-start' : 'group-header'}>
                {group.label}
              </th>
            ))}
          </tr>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                // Numeric headers line up with their right-aligned numbers.
                className={cellClass(column, typeof employees[0]?.[column.key] === 'number' ? 'number' : undefined)}
                aria-sort={column.key === sortKey ? (ascending ? 'ascending' : 'descending') : 'none'}
              >
                <button type="button" onClick={() => handleSort(column.key)}>
                  {column.label}
                  {column.key === sortKey ? (ascending ? ' ▲' : ' ▼') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((employee) => (
            <tr key={employee.employeeId}>
              {COLUMNS.map((column) => {
                const value = employee[column.key]
                let text = column.format && typeof value === 'number' ? column.format(value) : String(value)
                if (column.key === 'level') text = formatLevel(text) // "JOURNEYWORKER" -> "Journeyworker"
                let type = typeof value === 'number' ? 'number' : undefined
                if (column.key === 'flaggedWeeks' && employee.flaggedWeeks > 0) type = 'number flagged'
                const className = cellClass(column, type)
                return (
                  <td key={column.key} className={className}>
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default EmployeeTable
