import { useMemo, useState } from 'react'
import type { SimpleMetric, StateRecord } from './types'
import {
  compactCurrency,
  currencyFormatter,
  FEDERAL_GRANT_COLORS,
  formatSimpleMetricValue,
  getSimpleMetricValue,
  numberFormatter,
  REVENUE_BUCKET_COLORS,
} from './format'
import ChoroplethMap from './ChoroplethMap'

const GRANT_BUCKETS: { key: string; label: string; getValue: (s: StateRecord) => number }[] = [
  { key: 'grantsWelfare',        label: 'Medicaid & Welfare',  getValue: (s) => s.grantsWelfare },
  { key: 'grantsEducation',      label: 'Education',            getValue: (s) => s.grantsEducation },
  { key: 'grantsHealth',         label: 'Health',               getValue: (s) => s.grantsHealth },
  { key: 'grantsTransportation', label: 'Transportation',       getValue: (s) => s.grantsTransportation },
  { key: 'grantsOther',          label: 'Other',                getValue: (s) => s.grantsOther },
]

const GRANTS_COLOR = REVENUE_BUCKET_COLORS['federalGrants']

type Props = {
  activeStates: StateRecord[]
  metric: SimpleMetric
  setMetric: (m: SimpleMetric) => void
}

export default function FederalGrantsView({ activeStates, metric, setMetric }: Props) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  const hasData = activeStates.some((s) => s.federalGrants > 0)
  const hasBreakdown = activeStates.some((s) => s.grantsWelfare > 0)

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

  // Dynamic coverage %: aggregate bucket sum / total federalGrants across all states
  const coveragePct = useMemo(() => {
    const totalBuckets = sortedStates.reduce(
      (sum, s) =>
        sum + s.grantsWelfare + s.grantsEducation + s.grantsHealth + s.grantsTransportation + s.grantsOther,
      0,
    )
    const totalGrants = sortedStates.reduce((sum, s) => sum + s.federalGrants, 0)
    return totalGrants > 0 ? Math.round((totalBuckets / totalGrants) * 100) : 88
  }, [sortedStates])

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
            <h2>Federal grants across states</h2>
            <div className="metric-toggle" role="group" aria-label="Federal grants metric toggle">
              <button className={metric === 'total' ? 'active' : ''} onClick={() => setMetric('total')} type="button">
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

          {!hasBreakdown && (
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.75rem' }}>
              Federal grants breakdown not available. Run <code>npm run data:refresh</code> to download the
              Individual Unit Files.
            </p>
          )}

          <div className="bar-list">
            {sortedStates.map((entry) => {
              const metricValue = getSimpleMetricValue(entry.federalGrants, metric, entry.population)
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
                    {hasBreakdown
                      ? GRANT_BUCKETS.map(({ key, getValue }) => {
                          const bucketRaw = getValue(entry)
                          const segmentWidth =
                            maxMetricValue === 0
                              ? 0
                              : (getSimpleMetricValue(bucketRaw, metric, entry.population) / maxMetricValue) * 100
                          return (
                            <div
                              key={key}
                              className="bar-segment"
                              style={{ width: `${segmentWidth}%`, background: FEDERAL_GRANT_COLORS[key] }}
                            />
                          )
                        })
                      : (
                        <div
                          className="bar-segment"
                          style={{
                            width: `${maxMetricValue === 0 ? 0 : (metricValue / maxMetricValue) * 100}%`,
                            background: GRANTS_COLOR,
                          }}
                        />
                      )}
                  </div>
                  {hoveredState === entry.state && (
                    <div className="bar-tooltip">
                      {hasBreakdown
                        ? GRANT_BUCKETS.map(({ key, label, getValue }) => {
                            const bucketRaw = getValue(entry)
                            const tooltipValue =
                              metric === 'total'
                                ? compactCurrency(bucketRaw)
                                : entry.population > 0
                                  ? `${currencyFormatter.format(bucketRaw / entry.population)} / resident`
                                  : '—'
                            return (
                              <div key={key} className="tooltip-row">
                                <span className="tooltip-swatch" style={{ background: FEDERAL_GRANT_COLORS[key] }} />
                                <span className="tooltip-label">{label}</span>
                                <span className="tooltip-value">{tooltipValue}</span>
                              </div>
                            )
                          })
                        : (
                          <div className="tooltip-row">
                            <span className="tooltip-swatch" style={{ background: GRANTS_COLOR }} />
                            <span className="tooltip-label">Federal Grants</span>
                            <span className="tooltip-value">{formatSimpleMetricValue(metricValue, metric)}</span>
                          </div>
                        )}
                      <div className="tooltip-row tooltip-total">
                        <span className="tooltip-swatch" style={{ background: 'transparent' }} />
                        <span className="tooltip-label">Total</span>
                        <span className="tooltip-value">{formatSimpleMetricValue(metricValue, metric)}</span>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {hasBreakdown && (
            <div className="tax-legend">
              {GRANT_BUCKETS.map(({ key, label }) => (
                <span key={key} className="legend-item">
                  <span className="legend-swatch" style={{ background: FEDERAL_GRANT_COLORS[key] }} />
                  {label}
                </span>
              ))}
            </div>
          )}
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

      {hasBreakdown && (
        <section className="panel">
          <h2>Breakout by federal grant function</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>State</th>
                  {GRANT_BUCKETS.map(({ key, label }) => (
                    <th key={key}>{label}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedStates.map((entry) => (
                  <tr key={entry.state}>
                    <td>{entry.state}</td>
                    {GRANT_BUCKETS.map(({ key, getValue }) => {
                      const raw = getValue(entry)
                      return (
                        <td key={key}>
                          {formatSimpleMetricValue(getSimpleMetricValue(raw, metric, entry.population), metric)}
                        </td>
                      )
                    })}
                    <td>
                      {formatSimpleMetricValue(
                        getSimpleMetricValue(entry.federalGrants, metric, entry.population),
                        metric,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-footnote">
            Breakdown covers state government grants (~{coveragePct}% of total federal grants). The remainder flows
            directly to local governments and cannot be attributed by function. Example: {topState?.state} population{' '}
            {topState ? numberFormatter.format(topState.population) : '—'}.
          </p>
        </section>
      )}
    </>
  )
}
