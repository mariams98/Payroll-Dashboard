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
  "Typical = the median of each employee's usual rate, so one-off spike weeks don't move it."

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

  // Secondary stats, grouped so related numbers sit together.
  const groups: { title: string; cards: Card[] }[] = [
    {
      title: 'Workforce',
      cards: [
        {
          label: 'Employees',
          value: String(summary.employeeCount),
          detail: `${summary.apprenticeCount} apprentices, ${summary.journeyworkerCount} journeyworkers`,
        },
        {
          label: 'Apprentice share of hours',
          value: formatPercent(summary.apprenticeShare),
          detail: 'Hours worked by apprentices',
        },
      ],
    },
    {
      title: 'Hours',
      cards: [
        {
          label: 'Total hours',
          value: formatHours(summary.totalHours),
          detail: `${formatPercent(summary.overtimeShare)} overtime`,
        },
        {
          label: 'Weeks covered',
          value: String(summary.weekCount),
          detail: `${formatDate(summary.firstWeek)} – ${formatDate(summary.lastWeek)}`,
        },
      ],
    },
    {
      title: 'Average rates (per hour)',
      cards: [
        {
          label: 'Standard',
          help: RATE_HELP,
          value: formatMoney(summary.hoursWeightedStandardRate),
          detail: `Typical ${formatMoney(summary.typicalStandardRate)}`,
        },
        {
          label: 'Overtime',
          help: RATE_HELP,
          value: formatMoney(summary.hoursWeightedOvertimeRate),
          detail: `Typical ${formatMoney(summary.typicalOvertimeRate)}`,
        },
        {
          label: 'Benefits',
          help: RATE_HELP,
          value: formatMoney(summary.hoursWeightedBenefitsRate),
          detail: `Typical ${formatMoney(summary.typicalBenefitsRate)}`,
        },
      ],
    },
  ]

  return (
    <>
      <CardGrid cards={primaryCards} primary />
      <div className="card-groups">
        {groups.map((group) => (
          // Each group grows in proportion to its number of cards, so all cards end up the same width.
          <div className="card-group" key={group.title} style={{ flexGrow: group.cards.length }}>
            <h3 className="card-group-title">{group.title}</h3>
            <CardGrid cards={group.cards} />
          </div>
        ))}
      </div>
      <p className="note">
        Totals include flagged entries. Average rates are weighted by hours (what was actually paid
        per hour); "typical" is the median employee's usual rate.
      </p>
    </>
  )
}

export default SummaryCards
