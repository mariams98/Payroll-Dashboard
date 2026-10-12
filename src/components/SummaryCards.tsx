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
  alert?: boolean // highlight in red, e.g. when there are entries to review
}

function CardGrid({ cards, primary = false }: { cards: Card[]; primary?: boolean }) {
  return (
    <div className={primary ? 'cards cards-primary' : 'cards'}>
      {cards.map((card) => (
        <div className={card.alert ? 'card card-alert' : 'card'} key={card.label}>
          <div className="card-label">{card.label}</div>
          <div className="card-value">{card.value}</div>
          <div className="card-detail">{card.detail}</div>
        </div>
      ))}
    </div>
  )
}

function SummaryCards({ summary, anomalySummary }: Props) {
  // The two questions a project manager asks first: what did we spend, and is anything wrong?
  const primaryCards: Card[] = [
    {
      label: 'Total labor cost',
      // Cents shown on all three so the parts visibly add up to the total.
      value: formatMoney(summary.totalCost),
      detail: `${formatMoney(summary.grossPay)} wages + ${formatMoney(summary.benefitsCost)} benefits`,
    },
    {
      // Each entry is one employee's week (one CSV row).
      label: 'Entries to review',
      value: String(anomalySummary.flaggedRows),
      detail:
        `${anomalySummary.high} high, ${anomalySummary.medium} medium, ${anomalySummary.low} low ` +
        `across ${anomalySummary.flaggedEmployees} employees`,
      alert: anomalySummary.flaggedRows > 0,
    },
  ]

  const secondaryCards: Card[] = [
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
      label: 'Typical standard rate',
      value: formatMoney(summary.typicalStandardRate),
      detail:
        `Hours-weighted average ${formatMoney(summary.hoursWeightedStandardRate)}. ` +
        `Typical OT ${formatMoney(summary.typicalOvertimeRate)}, benefits ${formatMoney(summary.typicalBenefitsRate)}`,
    },
  ]

  return (
    <>
      <CardGrid cards={primaryCards} primary />
      <CardGrid cards={secondaryCards} />
      <p className="note">
        Totals include every row as submitted, including flagged rows. Typical rates are the median
        of each employee's usual rate, so one-off spikes don't skew them. The hours-weighted average
        is what was actually paid per standard hour across all rows.
      </p>
    </>
  )
}

export default SummaryCards
