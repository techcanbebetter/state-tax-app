import { useMemo, useState } from 'react'
import type { MultiYearPayload, SpendingMetric, StateRecord } from './types'
import { compactCurrency, currencyFormatter, formatSpendingMetricValue, getSpendingMetricValue, numberFormatter, SPENDING_COLORS } from './format'
import ChoroplethMap from './ChoroplethMap'

type SpendingViewProps = {
  data: MultiYearPayload
  activeStates: StateRecord[]
  metric: SpendingMetric
  setMetric: (m: SpendingMetric) => void
}

export default function SpendingView({ data, activeStates, metric, setMetric }: SpendingViewProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  if (!data.spendingTypes || data.spendingTypes.length === 0) {
    return (
      <section className="panel">
        <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
          No spending data available. Run <code>npm run data:refresh</code> to regenerate the dataset.
        </p>
      </section>
    )
  }

  const sortedStates = useMemo(() => {
    return [...activeStates].sort((a, b) => getSpendingMetricValue(b, metric) - getSpendingMetricValue(a, metric))
  }, [activeStates, metric])

  const maxMetricValue = useMemo(() => {
    if (sortedStates.length === 0) return 0
    return Math.max(...sortedStates.map((e) => getSpendingMetricValue(e, metric)))
  }, [metric, sortedStates])

  const topState = sortedStates[0]

  return (
    <>
      <div className="chart-map-row">
        <section className="panel">
          <div className="panel-header">
            <h2>Compare spending across states</h2>
            <div className="metric-toggle" role="group" aria-label="Spending metric toggle">
              <button
                className={metric === 'total' ? 'active' : ''}
                onClick={() => setMetric('total')}
                type="button"
              >
                Total
              </button>
              <button
                className={metric === 'perCapita' ? 'active' : ''}
                onClick={() => setMetric('perCapita')}
                type="button"
              >
                Per capita
              </button>
            </div>
          </div>

          <div className="bar-list">
            {sortedStates.map((entry) => (
              <article
                key={entry.state}
                className="bar-row"
                onMouseEnter={() => setHoveredState(entry.state)}
                onMouseLeave={() => setHoveredState(null)}
              >
                <header>
                  <h3>{entry.state}</h3>
                  <p>{formatSpendingMetricValue(getSpendingMetricValue(entry, metric), metric)}</p>
                </header>
                <div className="bar-track">
                  {data.spendingTypes.map((spendingType) => {
                    const breakdownRaw = entry.spendingBreakdown[spendingType.key] ?? 0
                    const segmentRaw =
                      metric === 'total'
                        ? breakdownRaw
                        : entry.population > 0
                          ? breakdownRaw / entry.population
                          : 0
                    const segmentWidth = maxMetricValue === 0 ? 0 : (segmentRaw / maxMetricValue) * 100
                    return (
                      <div
                        key={spendingType.key}
                        className="bar-segment"
                        style={{ width: `${segmentWidth}%`, background: SPENDING_COLORS[spendingType.key] ?? '#9ca3af' }}
                      />
                    )
                  })}
                </div>
                {hoveredState === entry.state && (
                  <div className="bar-tooltip">
                    {data.spendingTypes.map((spendingType) => {
                      const breakdownRaw = entry.spendingBreakdown[spendingType.key] ?? 0
                      const tooltipValue =
                        metric === 'total'
                          ? compactCurrency(breakdownRaw)
                          : entry.population > 0
                            ? `${currencyFormatter.format(breakdownRaw / entry.population)} / resident`
                            : '—'
                      return (
                        <div key={spendingType.key} className="tooltip-row">
                          <span className="tooltip-swatch" style={{ background: SPENDING_COLORS[spendingType.key] ?? '#9ca3af' }} />
                          <span className="tooltip-label">{spendingType.label}</span>
                          <span className="tooltip-value">{tooltipValue}</span>
                        </div>
                      )
                    })}
                    <div className="tooltip-row tooltip-total">
                      <span className="tooltip-swatch" style={{ background: 'transparent' }} />
                      <span className="tooltip-label">Total</span>
                      <span className="tooltip-value">{formatSpendingMetricValue(getSpendingMetricValue(entry, metric), metric)}</span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="tax-legend">
            {data.spendingTypes.map((spendingType) => (
              <span key={spendingType.key} className="legend-item">
                <span className="legend-swatch" style={{ background: SPENDING_COLORS[spendingType.key] ?? '#9ca3af' }} />
                {spendingType.label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel map-panel-section">
          <h2>Spending by geography</h2>
          <ChoroplethMap
            states={activeStates}
            getValue={(s) => getSpendingMetricValue(s, metric)}
            formatValue={(v) => formatSpendingMetricValue(v, metric)}
          />
        </section>
      </div>

      <section className="panel">
        <h2>Breakout by spending category</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>State</th>
                {data.spendingTypes.map((spendingType) => (
                  <th key={spendingType.key}>{spendingType.label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map((entry) => (
                <tr key={entry.state}>
                  <td>{entry.state}</td>
                  {data.spendingTypes.map((spendingType) => (
                    <td key={spendingType.key}>{compactCurrency(entry.spendingBreakdown[spendingType.key] ?? 0)}</td>
                  ))}
                  <td>{compactCurrency(entry.spendingTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-footnote">
          Population shown in source data and per-capita calculations use nominal dollars. Example: {topState?.state}{' '}
          population {topState ? numberFormatter.format(topState.population) : '—'}.
        </p>
      </section>
    </>
  )
}
