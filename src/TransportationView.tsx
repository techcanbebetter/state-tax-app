import { useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import type { StateRecord } from './types'

type TransportMetric = 'overall' | 'pavement' | 'bridge' | 'congestion' | 'fatality'
type SortKey = 'spending' | 'overall' | 'pavement' | 'bridge' | 'congestion' | 'fatality'
type SortDir = 'asc' | 'desc'

const STATE_ABBREVS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY',
}

const formatCurrency = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const getRank = (s: StateRecord, metric: TransportMetric): number => {
  switch (metric) {
    case 'overall': return s.reasonOverallRank
    case 'pavement': return s.reasonPavementRank
    case 'bridge': return s.reasonBridgeRank
    case 'congestion': return s.reasonCongestionRank
    case 'fatality': return s.reasonFatalityRank
  }
}

const getSpendingPerCapita = (s: StateRecord): number =>
  s.population > 0 ? Math.round((s.spendingBreakdown.highways ?? 0) / s.population) : 0

type Props = { activeStates: StateRecord[] }

const SVG_W = 680
const SVG_H = 260
const MARGIN = { top: 20, right: 20, bottom: 50, left: 60 }
const PLOT_W = SVG_W - MARGIN.left - MARGIN.right
const PLOT_H = SVG_H - MARGIN.top - MARGIN.bottom

const Y_TICKS = [10, 20, 30, 40, 50]
const yScale = scaleLinear().domain([51, 1]).range([PLOT_H, 0])

const METRIC_LABELS: Record<TransportMetric, string> = {
  overall: 'Overall Rank',
  pavement: 'Pavement Rank',
  bridge: 'Bridge Rank',
  congestion: 'Congestion Rank',
  fatality: 'Fatality Rate Rank',
}

const METRIC_BUTTONS: { key: TransportMetric; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'pavement', label: 'Pavement' },
  { key: 'bridge', label: 'Bridges' },
  { key: 'congestion', label: 'Congestion' },
  { key: 'fatality', label: 'Fatality Rate' },
]

export default function TransportationView({ activeStates }: Props) {
  const [metric, setMetric] = useState<TransportMetric>('overall')
  const [sortKey, setSortKey] = useState<SortKey>('overall')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [tooltip, setTooltip] = useState<{ x: number; y: number; state: StateRecord } | null>(null)

  const hasData = activeStates.some((s) => s.reasonOverallRank > 0)

  const plotStates = useMemo(
    () => activeStates.filter((s) => getSpendingPerCapita(s) > 0 && getRank(s, metric) > 0),
    [activeStates, metric],
  )

  const xScale = useMemo(() => {
    if (!plotStates.length) return scaleLinear().domain([0, 1]).range([0, PLOT_W])
    const vals = plotStates.map((s) => getSpendingPerCapita(s))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.1 || 100
    return scaleLinear().domain([min - pad, max + pad]).range([0, PLOT_W])
  }, [plotStates])

  const xTicks = useMemo(() => {
    const [lo, hi] = xScale.domain()
    const step = (hi - lo) / 4
    return [0, 1, 2, 3, 4].map((i) => lo + i * step)
  }, [xScale])

  const sortedStates = useMemo(() => {
    return [...activeStates].sort((a, b) => {
      let aVal: number, bVal: number
      if (sortKey === 'spending') { aVal = getSpendingPerCapita(a); bVal = getSpendingPerCapita(b) }
      else if (sortKey === 'overall') { aVal = a.reasonOverallRank; bVal = b.reasonOverallRank }
      else if (sortKey === 'pavement') { aVal = a.reasonPavementRank; bVal = b.reasonPavementRank }
      else if (sortKey === 'bridge') { aVal = a.reasonBridgeRank; bVal = b.reasonBridgeRank }
      else if (sortKey === 'congestion') { aVal = a.reasonCongestionRank; bVal = b.reasonCongestionRank }
      else { aVal = a.reasonFatalityRank; bVal = b.reasonFatalityRank }
      if (aVal === 0 && bVal === 0) return 0
      if (aVal === 0) return 1
      if (bVal === 0) return -1
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [activeStates, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'spending' ? 'desc' : 'asc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: '#1a2744' }}>Highway Spending per Capita vs. Performance Ranking</h3>
          <div role="group" aria-label="Transport metric toggle" style={{ display: 'flex', gap: 4 }}>
            {METRIC_BUTTONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={metric === key ? 'active' : ''}
                onClick={() => setMetric(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>
            No transportation data loaded. Run <code>npm run data:refresh</code> to load transportation data.
          </p>
        ) : (
          <div style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', fontFamily: 'inherit' }}>
              <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                {Y_TICKS.map((tick) => (
                  <line key={tick} x1={0} y1={yScale(tick)} x2={PLOT_W} y2={yScale(tick)}
                    stroke="#e5e7eb" strokeWidth={0.5} strokeDasharray="4,4" />
                ))}
                {xTicks.map((tick) => (
                  <line key={tick} x1={xScale(tick)} y1={0} x2={xScale(tick)} y2={PLOT_H}
                    stroke="#e5e7eb" strokeWidth={0.5} strokeDasharray="4,4" />
                ))}
                {Y_TICKS.map((tick) => (
                  <text key={`yl-${tick}`} x={-6} y={yScale(tick)} fill="#6b7280" fontSize={9} textAnchor="end" dominantBaseline="middle">
                    #{tick}
                  </text>
                ))}
                {xTicks.map((tick) => (
                  <text key={`xl-${tick}`} x={xScale(tick)} y={PLOT_H + 16} fill="#6b7280" fontSize={9} textAnchor="middle">
                    ${Math.round(tick)}
                  </text>
                ))}
                <text x={PLOT_W / 2} y={PLOT_H + 36} fill="#9ca3af" fontSize={10} textAnchor="middle">
                  Highway Spending per Capita
                </text>
                <text x={-(PLOT_H / 2)} y={-44} fill="#9ca3af" fontSize={10} textAnchor="middle" transform="rotate(-90)">
                  {METRIC_LABELS[metric]}
                </text>
                {plotStates.map((s) => {
                  const cx = xScale(getSpendingPerCapita(s))
                  const cy = yScale(getRank(s, metric))
                  const abbrev = STATE_ABBREVS[s.state] ?? s.state.slice(0, 2).toUpperCase()
                  return (
                    <g
                      key={s.state}
                      onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, state: s })}
                      onMouseLeave={() => setTooltip(null)}
                      style={{ cursor: 'default' }}
                    >
                      <circle cx={cx} cy={cy} r={5} fill="#3b82f6" opacity={0.75} />
                      <text x={cx + 7} y={cy + 4} fill="#6b7280" fontSize={9}>{abbrev}</text>
                    </g>
                  )
                })}
              </g>
            </svg>

            {tooltip && (
              <div
                style={{
                  position: 'fixed',
                  left: tooltip.x + 12,
                  top: tooltip.y - 10,
                  background: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: '#e5e7eb',
                  pointerEvents: 'none',
                  zIndex: 100,
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltip.state.state}</div>
                <div>{formatCurrency(getSpendingPerCapita(tooltip.state))} / capita (highways)</div>
                <div>{METRIC_LABELS[metric]}: #{getRank(tooltip.state, metric)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#1a2744' }}>
          State Breakdown — click column to sort
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>
                  State
                </th>
                <th
                  onClick={() => handleSort('spending')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'spending' ? '#d97706' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}
                >
                  $/Capita (Highways){sortIndicator('spending')}
                </th>
                <th
                  onClick={() => handleSort('overall')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'overall' ? '#d97706' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}
                >
                  Overall{sortIndicator('overall')}
                </th>
                <th
                  onClick={() => handleSort('pavement')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'pavement' ? '#d97706' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}
                >
                  Pavement{sortIndicator('pavement')}
                </th>
                <th
                  onClick={() => handleSort('bridge')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'bridge' ? '#d97706' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}
                >
                  Bridges{sortIndicator('bridge')}
                </th>
                <th
                  onClick={() => handleSort('congestion')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'congestion' ? '#d97706' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}
                >
                  Congestion{sortIndicator('congestion')}
                </th>
                <th
                  onClick={() => handleSort('fatality')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'fatality' ? '#d97706' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}
                >
                  Fatality Rate{sortIndicator('fatality')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map((s, i) => (
                <tr key={s.state} style={{ borderTop: '1px solid #e5e7eb', background: i % 2 === 1 ? '#f9fafb' : undefined }}>
                  <td style={{ padding: '7px 12px', color: '#1a2744' }}>{s.state}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                    {getSpendingPerCapita(s) > 0 ? formatCurrency(getSpendingPerCapita(s)) : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151' }}>
                    {s.reasonOverallRank > 0 ? `#${s.reasonOverallRank}` : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151' }}>
                    {s.reasonPavementRank > 0 ? `#${s.reasonPavementRank}` : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151' }}>
                    {s.reasonBridgeRank > 0 ? `#${s.reasonBridgeRank}` : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151' }}>
                    {s.reasonCongestionRank > 0 ? `#${s.reasonCongestionRank}` : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151' }}>
                    {s.reasonFatalityRank > 0 ? `#${s.reasonFatalityRank}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6b7280' }}>
          Rankings from the Reason Foundation 29th Annual Highway Report (2026), based on 2023 state highway data.
        </p>
      </div>
    </div>
  )
}
