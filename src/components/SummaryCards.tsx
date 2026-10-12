import { formatHours, formatMoney, formatPercent } from '../lib/format'
import type { AnomalySummary, Summary } from '../lib/stats'

interface Props {
  summary: Summary
  anomalySummary: AnomalySummary
}

interface Card {
  label: string
  value: string
  detail: string
}

function SummaryCards({ summary, anomalySummary }: Props) {
  const cards: Card[] = [
    {
      label: 'Employees',
      value: String(summary.employeeCount),
      detail: `${summary.apprenticeCount} apprentices, ${summary.journeyworkerCount} journeyworkers`,
    },
    {
      label: 'Weeks covered',
      value: String(summary.weekCount),
      detail: `${summary.firstWeek} to ${summary.lastWeek}`,
    },
    {
      label: 'Total hours',
      value: formatHours(summary.totalHours),
      detail: `${formatPercent(summary.overtimeShare)} overtime`,
    },
    {
      label: 'Apprentice share of hours',
      value: formatPercent(summary.apprenticeShare),
      detail: 'Hours worked by apprentices',
    },
    {
      label: 'Total labor cost',
      // Cents shown on all three so the parts visibly add up to the total.
      value: formatMoney(summary.totalCost),
      detail: `${formatMoney(summary.grossPay)} wages + ${formatMoney(summary.benefitsCost)} benefits`,
    },
    {
      label: 'Typical standard rate',
      value: formatMoney(summary.typicalStandardRate),
      detail: `OT ${formatMoney(summary.typicalOvertimeRate)}, benefits ${formatMoney(summary.typicalBenefitsRate)}`,
    },
    {
      label: 'Flagged rows',
      value: String(anomalySummary.flaggedRows),
      detail: `${anomalySummary.high} high, ${anomalySummary.medium} medium, ${anomalySummary.low} low`,
    },
  ]

  return (
    <>
      <div className="cards">
        {cards.map((card) => (
          <div className="card" key={card.label}>
            <div className="card-label">{card.label}</div>
            <div className="card-value">{card.value}</div>
            <div className="card-detail">{card.detail}</div>
          </div>
        ))}
      </div>
      <p className="note">
        Totals include every row as submitted, including flagged rows. Typical rates are the median
        of each employee's usual rate, so one-off spikes don't skew them.
      </p>
    </>
  )
}

export default SummaryCards
