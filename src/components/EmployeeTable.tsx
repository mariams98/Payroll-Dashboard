import { useState } from 'react'
import { formatHours, formatMoney, formatWholeMoney } from '../lib/format'
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
  { key: 'flaggedWeeks', label: 'Flagged weeks' },
]

// Top header row that groups the min/avg/max columns.
const GROUPS = [
  { label: '', span: 7 },
  { label: 'Hours per day worked', span: 3 },
  { label: 'Standard rate', span: 3 },
  { label: 'Overtime rate', span: 3 },
  { label: 'Benefits rate', span: 3 },
  { label: '', span: 1 },
]

function EmployeeTable({ employees }: { employees: EmployeeStats[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [ascending, setAscending] = useState(true)

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
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {GROUPS.map((group, i) => (
              <th key={i} colSpan={group.span} className="group-header">
                {group.label}
              </th>
            ))}
          </tr>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
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
                const text = column.format && typeof value === 'number' ? column.format(value) : String(value)
                return (
                  <td key={column.key} className={typeof value === 'number' ? 'number' : undefined}>
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
