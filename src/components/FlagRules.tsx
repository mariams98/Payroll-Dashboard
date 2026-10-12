import { RULE_DESCRIPTIONS, RULE_LABELS } from '../lib/anomalies'
import type { RuleId } from '../lib/types'

// Collapsible explanation of every anomaly rule, so the reasoning is visible in the product.
function FlagRules() {
  const rules = Object.keys(RULE_DESCRIPTIONS) as RuleId[]

  return (
    <details className="flag-rules">
      <summary>How entries are flagged</summary>
      <p className="note">
        Thresholds were set from this project's real data, not guesses. Weekend work, weeks over 40
        standard hours, and missing weeks are common here, so they are not flagged.
      </p>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Flags an entry when</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule}>
              <td>{RULE_LABELS[rule]}</td>
              <td className="wrap">{RULE_DESCRIPTIONS[rule].when}</td>
              <td>{RULE_DESCRIPTIONS[rule].severity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export default FlagRules
