import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { MultiYearPayload, Metric, SpendingMetric } from './types'
import { getMetricValue, getSpendingMetricValue } from './format'
import RevenueView from './RevenueView'
// SpendingView will be imported in Chunk 5
// import SpendingView from './SpendingView'

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function App() {
  const [data, setData] = useState<MultiYearPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [view, setView] = useState<'revenue' | 'spending'>('revenue')
  const [revenueMetric, setRevenueMetric] = useState<Metric>('total')
  const [spendingMetric, _setSpendingMetric] = useState<SpendingMetric>('total')

  useEffect(() => {
    const loadData = async () => {
      const base = import.meta.env.BASE_URL
      const candidates = [`${base}data/state-tax-summary-2019-2023.json`, `${base}data/state-tax-summary-sample.json`]

      for (const url of candidates) {
        try {
          const response = await fetch(url)
          if (!response.ok) continue
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

  const lastRefreshedLabel = useMemo(() => {
    const raw = data?.metadata.generatedAt
    if (!raw) return '—'
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return '—'
    return dateTimeFormatter.format(parsed)
  }, [data])

  // Top state card — view-aware
  const { topStateName, topStateLabel } = useMemo(() => {
    if (!activeStates.length) return { topStateName: '—', topStateLabel: '' }
    if (view === 'revenue') {
      const sorted = [...activeStates].sort((a, b) => getMetricValue(b, revenueMetric) - getMetricValue(a, revenueMetric))
      const label = revenueMetric === 'total' ? 'Total' : revenueMetric === 'perCapita' ? 'Per capita' : '% of income'
      return { topStateName: sorted[0]?.state ?? '—', topStateLabel: label }
    } else {
      const sorted = [...activeStates].sort((a, b) => getSpendingMetricValue(b, spendingMetric) - getSpendingMetricValue(a, spendingMetric))
      const label = spendingMetric === 'total' ? 'Total spend' : 'Per capita spend'
      return { topStateName: sorted[0]?.state ?? '—', topStateLabel: label }
    }
  }, [activeStates, view, revenueMetric, spendingMetric])

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
          <div className="metric-toggle view-toggle" role="group" aria-label="View toggle">
            <button
              type="button"
              className={view === 'revenue' ? 'active' : ''}
              onClick={() => setView('revenue')}
            >
              Tax Revenue
            </button>
            <button
              type="button"
              className={view === 'spending' ? 'active' : ''}
              onClick={() => setView('spending')}
            >
              Spending
            </button>
          </div>

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
              <h2>Top state ({topStateLabel})</h2>
              <p>{topStateName}</p>
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

          {view === 'revenue' ? (
            <RevenueView
              data={data}
              activeStates={activeStates}
              states2023={states2023}
              metric={revenueMetric}
              setMetric={setRevenueMetric}
            />
          ) : (
            <div className="panel" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              Spending view coming soon — SpendingView will be wired in Chunk 5.
            </div>
          )}

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
