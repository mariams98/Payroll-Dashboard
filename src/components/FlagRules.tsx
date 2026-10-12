import { RULE_DESCRIPTIONS, RULE_LABELS } from '../lib/anomalies'
import type { RuleId } from '../lib/types'

// Explanation of every anomaly rule, so the reasoning is visible in the product.
// Opened from the "How are entries flagged?" link next to the Entries to review heading.
function FlagRules() {
  const rules = Object.keys(RULE_DESCRIPTIONS) as RuleId[]

  return (
    <div className="flag-rules" id="flag-rules">
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
    </div>
  )
}

export default FlagRules
