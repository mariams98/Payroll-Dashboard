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
    // Averages are weighted by hours (what was actually paid per hour). The typical rate below
    // each is the median employee's usual rate, which one-off spike weeks don't move.
    {
      label: 'Average standard rate',
      value: formatMoney(summary.hoursWeightedStandardRate),
      detail: `Typical employee: ${formatMoney(summary.typicalStandardRate)}`,
    },
    {
      label: 'Average overtime rate',
      value: formatMoney(summary.hoursWeightedOvertimeRate),
      detail: `Typical employee: ${formatMoney(summary.typicalOvertimeRate)}`,
    },
    {
      label: 'Average benefits rate',
      value: formatMoney(summary.hoursWeightedBenefitsRate),
      detail: `Typical employee: ${formatMoney(summary.typicalBenefitsRate)}`,
    },
  ]

  return (
    <>
      <CardGrid cards={primaryCards} primary />
      <CardGrid cards={secondaryCards} />
      <p className="note">
        Totals include every row as submitted, including flagged rows. Average rates are weighted by
        hours, i.e. what was actually paid per hour. "Typical employee" is the median of each
        employee's usual rate, so one-off spike weeks don't skew it.
      </p>
    </>
  )
}

export default SummaryCards
