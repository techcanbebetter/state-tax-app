import { useMemo, useState } from 'react'
import type { MultiYearPayload, Metric, StateRecord } from './types'
import { compactCurrency, currencyFormatter, formatMetricValue, getMetricValue, numberFormatter, TAX_COLORS } from './format'
import ChoroplethMap from './ChoroplethMap'
import PersonalCalculator from './PersonalCalculator'

type RevenueViewProps = {
  data: MultiYearPayload
  activeStates: StateRecord[]
  states2023: StateRecord[]
  metric: Metric
  setMetric: (m: Metric) => void
}

export default function RevenueView({ data, activeStates, states2023, metric, setMetric }: RevenueViewProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  const sortedStates = useMemo(() => {
    return [...activeStates].sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
  }, [activeStates, metric])

  const maxMetricValue = useMemo(() => {
    if (sortedStates.length === 0) return 0
    return Math.max(...sortedStates.map((e) => getMetricValue(e, metric)))
  }, [metric, sortedStates])

  const topState = sortedStates[0]

  return (
    <>
      <div className="chart-map-row">
        <section className="panel">
          <div className="panel-header">
            <h2>Compare totals across states</h2>
            <div className="metric-toggle" role="group" aria-label="Metric toggle">
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
              <button
                className={metric === 'perCapitaBurden' ? 'active' : ''}
                onClick={() => setMetric('perCapitaBurden')}
                type="button"
              >
                % of income
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
                  <p>{formatMetricValue(getMetricValue(entry, metric), metric)}</p>
                </header>
                <div className="bar-track">
                  {data.taxTypes.map((taxType) => {
                    const breakdownRaw = entry.breakdown[taxType.key] ?? 0
                    const segmentRaw =
                      metric === 'total'
                        ? breakdownRaw
                        : metric === 'perCapita'
                          ? breakdownRaw / entry.population
                          : entry.perCapitaIncome > 0
                            ? (breakdownRaw / entry.population) / entry.perCapitaIncome
                            : 0
                    const segmentWidth = maxMetricValue === 0 ? 0 : (segmentRaw / maxMetricValue) * 100
                    return (
                      <div
                        key={taxType.key}
                        className="bar-segment"
                        style={{ width: `${segmentWidth}%`, background: TAX_COLORS[taxType.key] ?? '#9ca3af' }}
                      />
                    )
                  })}
                </div>
                {hoveredState === entry.state && (
                  <div className="bar-tooltip">
                    {data.taxTypes.map((taxType) => {
                      const breakdownRaw = entry.breakdown[taxType.key] ?? 0
                      const tooltipValue =
                        metric === 'total'
                          ? compactCurrency(breakdownRaw)
                          : metric === 'perCapita'
                            ? `${currencyFormatter.format(breakdownRaw / entry.population)} / resident`
                            : entry.perCapitaIncome > 0
                              ? `${((breakdownRaw / entry.population) / entry.perCapitaIncome * 100).toFixed(2)}% of income`
                              : '—'
                      return (
                        <div key={taxType.key} className="tooltip-row">
                          <span className="tooltip-swatch" style={{ background: TAX_COLORS[taxType.key] ?? '#9ca3af' }} />
                          <span className="tooltip-label">{taxType.label}</span>
                          <span className="tooltip-value">{tooltipValue}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="tax-legend">
            {data.taxTypes.map((taxType) => (
              <span key={taxType.key} className="legend-item">
                <span className="legend-swatch" style={{ background: TAX_COLORS[taxType.key] ?? '#9ca3af' }} />
                {taxType.label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel map-panel-section">
          <h2>Tax by geography</h2>
          <ChoroplethMap
            states={activeStates}
            getValue={(s) => getMetricValue(s, metric)}
            formatValue={(v) => formatMetricValue(v, metric)}
          />
        </section>
      </div>

      <PersonalCalculator states={states2023} />

      <section className="panel">
        <h2>Breakout by tax type</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>State</th>
                {data.taxTypes.map((taxType) => (
                  <th key={taxType.key}>{taxType.label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map((entry) => (
                <tr key={entry.state}>
                  <td>{entry.state}</td>
                  {data.taxTypes.map((taxType) => (
                    <td key={taxType.key}>{compactCurrency(entry.breakdown[taxType.key] ?? 0)}</td>
                  ))}
                  <td>{compactCurrency(entry.totalRevenue)}</td>
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
