import { formatDate, formatHours, formatMoney, formatPercent } from '../lib/format'
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
  href?: string // makes the whole card a link
  help?: string // tooltip explaining how the number is calculated
}

// Shown as a tooltip on the rate cards.
const RATE_HELP =
  'Average = weighted by hours, i.e. what was actually paid per hour. ' +
  "Typical employee = the median of each employee's usual rate, so one-off spike weeks don't move it."

function CardGrid({ cards, primary = false }: { cards: Card[]; primary?: boolean }) {
  return (
    <div className={primary ? 'cards cards-primary' : 'cards'}>
      {cards.map((card) => {
        const className = ['card', card.alert && 'card-alert', card.href && 'card-link'].filter(Boolean).join(' ')
        const content = (
          <>
            <div className="card-label">{card.label}</div>
            <div className="card-value">{card.value}</div>
            <div className="card-detail">{card.detail}</div>
          </>
        )
        return card.href ? (
          <a className={className} key={card.label} href={card.href} title={card.help}>
            {content}
          </a>
        ) : (
          <div className={className} key={card.label} title={card.help}>
            {content}
          </div>
        )
      })}
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
        `across ${anomalySummary.flaggedEmployees} employees · View list ↓`,
      alert: anomalySummary.flaggedRows > 0,
      href: '#entries',
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
      detail: `${formatDate(summary.firstWeek)} – ${formatDate(summary.lastWeek)}`,
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
      label: 'Average standard rate',
      help: RATE_HELP,
      value: formatMoney(summary.hoursWeightedStandardRate),
      detail: `Typical employee: ${formatMoney(summary.typicalStandardRate)}`,
    },
    {
      label: 'Average overtime rate',
      help: RATE_HELP,
      value: formatMoney(summary.hoursWeightedOvertimeRate),
      detail: `Typical employee: ${formatMoney(summary.typicalOvertimeRate)}`,
    },
    {
      label: 'Average benefits rate',
      help: RATE_HELP,
      value: formatMoney(summary.hoursWeightedBenefitsRate),
      detail: `Typical employee: ${formatMoney(summary.typicalBenefitsRate)}`,
    },
  ]

  return (
    <>
      <CardGrid cards={primaryCards} primary />
      <CardGrid cards={secondaryCards} />
      <p className="note">
        Totals include flagged entries. Average rates are weighted by hours; "typical employee" is
        the median employee's usual rate.
      </p>
    </>
  )
}

export default SummaryCards
