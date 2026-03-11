import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { MultiYearPayload, Metric } from './types'
import { compactCurrency, currencyFormatter, formatMetricValue, getMetricValue, numberFormatter, TAX_COLORS } from './format'
import ChoroplethMap from './ChoroplethMap'
import PersonalCalculator from './PersonalCalculator'

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function App() {
  const [data, setData] = useState<MultiYearPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('total')
  const [hoveredState, setHoveredState] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  useEffect(() => {
    const loadData = async () => {
      const base = import.meta.env.BASE_URL
      const candidates = [`${base}data/state-tax-summary-2019-2023.json`, `${base}data/state-tax-summary-sample.json`]

      for (const url of candidates) {
        try {
          const response = await fetch(url)
          if (!response.ok) {
            continue
          }

          const payload = (await response.json()) as MultiYearPayload
          setData(payload)
          setSelectedYear(payload.years[payload.years.length - 1].year)
          setError(null)
          return
        } catch {
          continue
        }
      }

      setError('No processed dataset found yet. Run `npm run data:ingest` after adding source CSV files.')
    }

    void loadData()
  }, [])

  const activeStates = useMemo(() => {
    if (!data || selectedYear == null) return []
    return data.years.find((y) => y.year === selectedYear)?.states ?? []
  }, [data, selectedYear])

  const states2023 = useMemo(() => {
    return data?.years.find((y) => y.year === 2023)?.states ?? []
  }, [data])

  const sortedStates = useMemo(() => {
    return [...activeStates].sort((a, b) => {
      return getMetricValue(b, metric) - getMetricValue(a, metric)
    })
  }, [activeStates, metric])

  const maxMetricValue = useMemo(() => {
    if (sortedStates.length === 0) return 0
    return Math.max(...sortedStates.map((e) => getMetricValue(e, metric)))
  }, [metric, sortedStates])

  const topState = sortedStates[0]

  const lastRefreshedLabel = useMemo(() => {
    const raw = data?.metadata.generatedAt
    if (!raw) {
      return '—'
    }

    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {
      return '—'
    }

    return dateTimeFormatter.format(parsed)
  }, [data])

  return (
    <main className="page">
      <section className="hero">
        <h1>State + Local Tax Comparison</h1>
        <p className="hero-subtitle">
          Discussed at{' '}
          <a href="https://techcanbebetter.com" target="_blank" rel="noreferrer">
            techcanbebetter.com
          </a>
        </p>
        <p>
          One-year nominal-dollar comparison across all 50 states, including total tax revenue,
          per-capita views, and tax burden as a percentage of per-capita personal income.
        </p>
      </section>

{error && <section className="error">{error}</section>}

      {data && (
        <>
          <section className="summary-grid">
            <article className="summary-card">
              <h2>Year</h2>
              <p>{selectedYear ?? data.metadata.year}</p>
            </article>
            <article className="summary-card">
              <h2>Coverage</h2>
              <p>Top {data.metadata.topN} states</p>
            </article>
            <article className="summary-card">
              <h2>Top state ({metric === 'total' ? 'Total' : metric === 'perCapita' ? 'Per capita' : '% of income'})</h2>
              <p>{topState?.state ?? '—'}</p>
            </article>
            <article className="summary-card">
              <h2>Last refreshed</h2>
              <p>{lastRefreshedLabel}</p>
            </article>
          </section>

          <div className="metric-toggle" role="group" aria-label="Year toggle">
            {data.years.map((yr) => (
              <button
                key={yr.year}
                className={selectedYear === yr.year ? 'active' : ''}
                onClick={() => setSelectedYear(yr.year)}
                type="button"
              >
                {yr.year}
              </button>
            ))}
          </div>

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
                {sortedStates.map((entry) => {
                  return (
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
                                  ? ((breakdownRaw / entry.population) * 1000) / entry.perCapitaIncome
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
                                  ? `${currencyFormatter.format((breakdownRaw / entry.population) * 1000)} / resident`
                                  : entry.perCapitaIncome > 0
                                    ? `${(((breakdownRaw / entry.population) * 1000) / entry.perCapitaIncome * 100).toFixed(2)}% of income`
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
                  )
                })}
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
                metric={metric}
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

          <section className="panel sources-panel">
            <h2>Data Sources</h2>
            <p className="sources-meta">
              Source year: {data.metadata.year} · Last refreshed: {lastRefreshedLabel}
            </p>
            <ul className="sources-list">
              <li>
                <a
                  href="https://api.census.gov/data/timeseries/govs?get=NAME,GOVTYPE,GOVTYPE_LABEL,AGG_DESC,AGG_DESC_LABEL,AMOUNT,YEAR&for=state:*&time=2023&SVY_COMP=04"
                  target="_blank"
                  rel="noreferrer"
                >
                  U.S. Census Bureau — Annual Survey of State and Local Finance (state + local by level)
                </a>
              </li>
              <li>
                <a
                  href="https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/state/totals/NST-EST2023-ALLDATA.csv"
                  target="_blank"
                  rel="noreferrer"
                >
                  U.S. Census Bureau — State Population Estimates (2023)
                </a>
              </li>
              <li>
                <a
                  href="https://api.census.gov/data/2023/acs/acs1?get=NAME,B19301_001E&for=state:*"
                  target="_blank"
                  rel="noreferrer"
                >
                  U.S. Census Bureau — ACS 1-Year 2023, Per Capita Income by State (B19301_001E)
                </a>
              </li>
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

export default App
