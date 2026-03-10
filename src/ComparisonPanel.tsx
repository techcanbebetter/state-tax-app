import type { StateRecord, TaxType } from './types'
import { compactCurrency, formatMetricValue, getMetricValue } from './format'

type ComparisonPanelProps = {
  states: StateRecord[]
  taxTypes: TaxType[]
  selectedStates: Set<string>
  onToggleState: (name: string) => void
}

export default function ComparisonPanel({ states, taxTypes, selectedStates, onToggleState }: ComparisonPanelProps) {
  if (selectedStates.size === 0) return null

  const selected = states.filter((s) => selectedStates.has(s.state))

  return (
    <section className="comparison-panel panel">
      <h2>State Comparison</h2>
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th className="comparison-row-label" />
              {selected.map((s) => (
                <th key={s.state} className="comparison-state-header">
                  <span>{s.state}</span>
                  <button
                    type="button"
                    className="comparison-remove"
                    onClick={() => onToggleState(s.state)}
                    aria-label={`Remove ${s.state}`}
                  >
                    ×
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="comparison-row-label">Total Revenue</td>
              {selected.map((s) => (
                <td key={s.state}>{compactCurrency(getMetricValue(s, 'total'))}</td>
              ))}
            </tr>
            <tr>
              <td className="comparison-row-label">Per Capita</td>
              {selected.map((s) => (
                <td key={s.state}>{formatMetricValue(getMetricValue(s, 'perCapita'), 'perCapita')}</td>
              ))}
            </tr>
            <tr>
              <td className="comparison-row-label">% of Income</td>
              {selected.map((s) => (
                <td key={s.state}>
                  {s.perCapitaIncome > 0
                    ? formatMetricValue(getMetricValue(s, 'perCapitaBurden'), 'perCapitaBurden')
                    : '—'}
                </td>
              ))}
            </tr>
            {taxTypes.map((taxType) => (
              <tr key={taxType.key}>
                <td className="comparison-row-label">{taxType.label}</td>
                {selected.map((s) => (
                  <td key={s.state}>{compactCurrency(s.breakdown[taxType.key] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
