import { useMemo, useState } from 'react'
import type { SimpleMetric, StateRecord } from './types'
import {
  compactCurrency,
  currencyFormatter,
  formatSimpleMetricValue,
  getSimpleMetricValue,
  numberFormatter,
  REVENUE_BUCKET_COLORS,
} from './format'
import ChoroplethMap from './ChoroplethMap'

const ownSourceTotal = (s: StateRecord) => s.chargesFees + s.trustUtility + s.miscRevenue

const OWN_SOURCE_BUCKETS: { key: string; label: string; getValue: (s: StateRecord) => number }[] = [
  { key: 'chargesFees',  label: 'Charges & Fees',  getValue: (s) => s.chargesFees },
  { key: 'trustUtility', label: 'Trust & Utility', getValue: (s) => s.trustUtility },
  { key: 'misc',         label: 'Misc',            getValue: (s) => s.miscRevenue },
]

type Props = {
  activeStates: StateRecord[]
  metric: SimpleMetric
  setMetric: (m: SimpleMetric) => void
}

export default function OwnSourceView({ activeStates, metric, setMetric }: Props) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  const hasData = activeStates.some((s) => s.chargesFees + s.trustUtility + s.miscRevenue > 0)

  const sortedStates = useMemo(
    () =>
      [...activeStates].sort(
        (a, b) =>
          getSimpleMetricValue(ownSourceTotal(b), metric, b.population) -
          getSimpleMetricValue(ownSourceTotal(a), metric, a.population),
      ),
    [activeStates, metric],
  )

  const maxMetricValue = useMemo(
    () =>
      sortedStates.length === 0
        ? 0
        : Math.max(...sortedStates.map((s) => getSimpleMetricValue(ownSourceTotal(s), metric, s.population))),
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
            <h2>Other revenue across states</h2>
            <div className="metric-toggle" role="group" aria-label="Other revenue metric toggle">
              <button className={metric === 'total' ? 'active' : ''} onClick={() => setMetric('total')} type="button">
                Total
              </button>
              <button className={metric === 'perCapita' ? 'active' : ''} onClick={() => setMetric('perCapita')} type="button">
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
                  <p>{formatSimpleMetricValue(getSimpleMetricValue(ownSourceTotal(entry), metric, entry.population), metric)}</p>
                </header>
                <div className="bar-track">
                  {OWN_SOURCE_BUCKETS.map(({ key, getValue }) => {
                    const bucketRaw = getValue(entry)
                    const segmentWidth = maxMetricValue === 0 ? 0 : (getSimpleMetricValue(bucketRaw, metric, entry.population) / maxMetricValue) * 100
                    return (
                      <div
                        key={key}
                        className="bar-segment"
                        style={{ width: `${segmentWidth}%`, background: REVENUE_BUCKET_COLORS[key] }}
                      />
                    )
                  })}
                </div>
                {hoveredState === entry.state && (
                  <div className="bar-tooltip">
                    {OWN_SOURCE_BUCKETS.map(({ key, label, getValue }) => {
                      const bucketRaw = getValue(entry)
                      const tooltipValue =
                        metric === 'total'
                          ? compactCurrency(bucketRaw)
                          : entry.population > 0
                            ? `${currencyFormatter.format(bucketRaw / entry.population)} / resident`
                            : '—'
                      return (
                        <div key={key} className="tooltip-row">
                          <span className="tooltip-swatch" style={{ background: REVENUE_BUCKET_COLORS[key] }} />
                          <span className="tooltip-label">{label}</span>
                          <span className="tooltip-value">{tooltipValue}</span>
                        </div>
                      )
                    })}
                    <div className="tooltip-row tooltip-total">
                      <span className="tooltip-swatch" style={{ background: 'transparent' }} />
                      <span className="tooltip-label">Total</span>
                      <span className="tooltip-value">
                        {formatSimpleMetricValue(getSimpleMetricValue(ownSourceTotal(entry), metric, entry.population), metric)}
                      </span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="tax-legend">
            {OWN_SOURCE_BUCKETS.map(({ key, label }) => (
              <span key={key} className="legend-item">
                <span className="legend-swatch" style={{ background: REVENUE_BUCKET_COLORS[key] }} />
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel map-panel-section">
          <h2>Other revenue by geography</h2>
          <ChoroplethMap
            states={activeStates}
            getValue={(s) => getSimpleMetricValue(ownSourceTotal(s), metric, s.population)}
            formatValue={(v) => formatSimpleMetricValue(v, metric)}
          />
        </section>
      </div>

      <section className="panel">
        <h2>Breakout by other revenue source</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>State</th>
                {OWN_SOURCE_BUCKETS.map(({ key, label }) => (
                  <th key={key}>{label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map((entry) => (
                <tr key={entry.state}>
                  <td>{entry.state}</td>
                  {OWN_SOURCE_BUCKETS.map(({ key, getValue }) => {
                    const raw = getValue(entry)
                    return <td key={key}>{formatSimpleMetricValue(getSimpleMetricValue(raw, metric, entry.population), metric)}</td>
                  })}
                  <td>
                    {formatSimpleMetricValue(getSimpleMetricValue(ownSourceTotal(entry), metric, entry.population), metric)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-footnote">
          Other revenue includes charges & fees, insurance trust & utility revenues, and miscellaneous revenue
          (excludes taxes and federal grants). Example: {topState?.state} population{' '}
          {topState ? numberFormatter.format(topState.population) : '—'}.
        </p>
      </section>
    </>
  )
}
