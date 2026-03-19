import { useMemo, useState } from 'react'
import type { SimpleMetric, StateRecord } from './types'
import {
  formatSimpleMetricValue,
  getSimpleMetricValue,
  numberFormatter,
  REVENUE_BUCKET_COLORS,
} from './format'
import ChoroplethMap from './ChoroplethMap'

const GRANTS_COLOR = REVENUE_BUCKET_COLORS['federalGrants']

type Props = {
  activeStates: StateRecord[]
  metric: SimpleMetric
  setMetric: (m: SimpleMetric) => void
}

export default function FederalGrantsView({ activeStates, metric, setMetric }: Props) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  const hasData = activeStates.some((s) => s.federalGrants > 0)

  const sortedStates = useMemo(
    () =>
      [...activeStates].sort(
        (a, b) =>
          getSimpleMetricValue(b.federalGrants, metric, b.population) -
          getSimpleMetricValue(a.federalGrants, metric, a.population),
      ),
    [activeStates, metric],
  )

  const maxMetricValue = useMemo(
    () =>
      sortedStates.length === 0
        ? 0
        : Math.max(...sortedStates.map((s) => getSimpleMetricValue(s.federalGrants, metric, s.population))),
    [metric, sortedStates],
  )

  const topState = sortedStates[0]

  if (!hasData) {
    return (
      <section className="panel">
        <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
          No extended revenue data available. Run <code>npm run data:refresh</code> to regenerate the dataset.
        </p>
      </section>
    )
  }

  return (
    <>
      <div className="chart-map-row">
        <section className="panel">
          <div className="panel-header">
            <h2>Federal grants by state</h2>
            <div className="metric-toggle" role="group" aria-label="Federal grants metric toggle">
              <button className={metric === 'total' ? 'active' : ''} onClick={() => setMetric('total')} type="button">
                Total
              </button>
              <button className={metric === 'perCapita' ? 'active' : ''} onClick={() => setMetric('perCapita')} type="button">
                Per capita
              </button>
            </div>
          </div>

          <div className="bar-list">
            {sortedStates.map((entry) => {
              const metricValue = getSimpleMetricValue(entry.federalGrants, metric, entry.population)
              const barWidth = maxMetricValue === 0 ? 0 : (metricValue / maxMetricValue) * 100
              return (
                <article
                  key={entry.state}
                  className="bar-row"
                  onMouseEnter={() => setHoveredState(entry.state)}
                  onMouseLeave={() => setHoveredState(null)}
                >
                  <header>
                    <h3>{entry.state}</h3>
                    <p>{formatSimpleMetricValue(metricValue, metric)}</p>
                  </header>
                  <div className="bar-track">
                    <div className="bar-segment" style={{ width: `${barWidth}%`, background: GRANTS_COLOR }} />
                  </div>
                  {hoveredState === entry.state && (
                    <div className="bar-tooltip">
                      <div className="tooltip-row">
                        <span className="tooltip-swatch" style={{ background: GRANTS_COLOR }} />
                        <span className="tooltip-label">Federal Grants</span>
                        <span className="tooltip-value">{formatSimpleMetricValue(metricValue, metric)}</span>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section className="panel map-panel-section">
          <h2>Federal grants by geography</h2>
          <ChoroplethMap
            states={activeStates}
            getValue={(s) => getSimpleMetricValue(s.federalGrants, metric, s.population)}
            formatValue={(v) => formatSimpleMetricValue(v, metric)}
          />
        </section>
      </div>

      <p className="panel-footnote" style={{ padding: '0.5rem 0' }}>
        Federal grants are intergovernmental revenue from the U.S. federal government (Census LF0004). Breakdown by
        function (Medicaid, education, transportation) is not yet available. Example: {topState?.state} population{' '}
        {topState ? numberFormatter.format(topState.population) : '—'}.
      </p>
    </>
  )
}
