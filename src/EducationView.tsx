import { useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import type { StateRecord } from './types'

type NAEPMetric = 'grade4Reading' | 'grade8Math'
type SortKey = 'perPupil' | 'grade4Reading' | 'grade8Math'
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

const getScore = (s: StateRecord, metric: NAEPMetric) =>
  metric === 'grade4Reading' ? s.naepGrade4Reading : s.naepGrade8Math

type Props = { activeStates: StateRecord[] }

const SVG_W = 680
const SVG_H = 260
const MARGIN = { top: 20, right: 20, bottom: 50, left: 60 }
const PLOT_W = SVG_W - MARGIN.left - MARGIN.right
const PLOT_H = SVG_H - MARGIN.top - MARGIN.bottom

export default function EducationView({ activeStates }: Props) {
  const [naepMetric, setNaepMetric] = useState<NAEPMetric>('grade4Reading')
  const [sortKey, setSortKey] = useState<SortKey>('perPupil')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [tooltip, setTooltip] = useState<{ x: number; y: number; state: StateRecord } | null>(null)

  const hasData = activeStates.some((s) => s.educationPerPupil > 0)

  const plotStates = useMemo(
    () => activeStates.filter((s) => s.educationPerPupil > 0 && getScore(s, naepMetric) > 0),
    [activeStates, naepMetric],
  )

  const xScale = useMemo(() => {
    if (!plotStates.length) return scaleLinear().domain([0, 1]).range([0, PLOT_W])
    const vals = plotStates.map((s) => s.educationPerPupil)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.1 || 1000
    return scaleLinear().domain([min - pad, max + pad]).range([0, PLOT_W])
  }, [plotStates])

  const yScale = useMemo(() => {
    if (!plotStates.length) return scaleLinear().domain([0, 1]).range([PLOT_H, 0])
    const vals = plotStates.map((s) => getScore(s, naepMetric))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.1 || 3
    return scaleLinear().domain([min - pad, max + pad]).range([PLOT_H, 0])
  }, [plotStates, naepMetric])

  const yTicks = useMemo(() => {
    const [lo, hi] = yScale.domain()
    const step = (hi - lo) / 4
    return [0, 1, 2, 3, 4].map((i) => lo + i * step)
  }, [yScale])

  const xTicks = useMemo(() => {
    const [lo, hi] = xScale.domain()
    const step = (hi - lo) / 4
    return [0, 1, 2, 3, 4].map((i) => lo + i * step)
  }, [xScale])

  const sortedStates = useMemo(() => {
    return [...activeStates].sort((a, b) => {
      let aVal: number, bVal: number
      if (sortKey === 'perPupil') { aVal = a.educationPerPupil; bVal = b.educationPerPupil }
      else if (sortKey === 'grade4Reading') { aVal = a.naepGrade4Reading; bVal = b.naepGrade4Reading }
      else { aVal = a.naepGrade8Math; bVal = b.naepGrade8Math }
      if (aVal === 0 && bVal === 0) return 0
      if (aVal === 0) return 1
      if (bVal === 0) return -1
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [activeStates, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return ''
    return sortDir === 'desc' ? ' ↓' : ' ↑'
  }

  const yLabel = naepMetric === 'grade4Reading' ? '4th Grade Reading Score' : '8th Grade Math Score'

  return (
    <div className="education-view">
      <div className="chart-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: '#e5e7eb' }}>K-12 Spending per Student vs. Achievement</h3>
          <div role="group" aria-label="NAEP metric toggle" style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className={naepMetric === 'grade4Reading' ? 'active' : ''}
              onClick={() => setNaepMetric('grade4Reading')}
            >
              4th Grade Reading
            </button>
            <button
              type="button"
              className={naepMetric === 'grade8Math' ? 'active' : ''}
              onClick={() => setNaepMetric('grade8Math')}
            >
              8th Grade Math
            </button>
          </div>
        </div>

        {!hasData ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>
            No education data loaded. Run <code>npm run data:refresh</code> to load education data.
          </p>
        ) : (
          <div style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', fontFamily: 'inherit' }}>
              <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                {yTicks.map((tick) => (
                  <line
                    key={tick}
                    x1={0} y1={yScale(tick)} x2={PLOT_W} y2={yScale(tick)}
                    stroke="#1f2937" strokeWidth={0.5} strokeDasharray="4,4"
                  />
                ))}
                {xTicks.map((tick) => (
                  <line
                    key={tick}
                    x1={xScale(tick)} y1={0} x2={xScale(tick)} y2={PLOT_H}
                    stroke="#1f2937" strokeWidth={0.5} strokeDasharray="4,4"
                  />
                ))}
                {yTicks.map((tick) => (
                  <text key={`yl-${tick}`} x={-6} y={yScale(tick)} fill="#6b7280" fontSize={9} textAnchor="end" dominantBaseline="middle">
                    {Math.round(tick)}
                  </text>
                ))}
                {xTicks.map((tick) => (
                  <text key={`xl-${tick}`} x={xScale(tick)} y={PLOT_H + 16} fill="#6b7280" fontSize={9} textAnchor="middle">
                    ${Math.round(tick / 1000)}k
                  </text>
                ))}
                <text x={PLOT_W / 2} y={PLOT_H + 36} fill="#9ca3af" fontSize={10} textAnchor="middle">
                  K-12 Spending per Student
                </text>
                <text x={-(PLOT_H / 2)} y={-44} fill="#9ca3af" fontSize={10} textAnchor="middle" transform="rotate(-90)">
                  {yLabel}
                </text>
                {plotStates.map((s) => {
                  const cx = xScale(s.educationPerPupil)
                  const cy = yScale(getScore(s, naepMetric))
                  const abbrev = STATE_ABBREVS[s.state] ?? s.state.slice(0, 2).toUpperCase()
                  return (
                    <g
                      key={s.state}
                      onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, state: s })}
                      onMouseLeave={() => setTooltip(null)}
                      style={{ cursor: 'default' }}
                    >
                      <circle cx={cx} cy={cy} r={5} fill="#3b82f6" opacity={0.75} />
                      <text x={cx + 7} y={cy + 4} fill="#9ca3af" fontSize={9}>{abbrev}</text>
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
                <div>{formatCurrency(tooltip.state.educationPerPupil)} / student</div>
                <div>4th Grade Reading: {tooltip.state.naepGrade4Reading || '—'}</div>
                <div>8th Grade Math: {tooltip.state.naepGrade8Math || '—'}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="chart-panel" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#e5e7eb' }}>
          State Breakdown — click column to sort
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th
                  style={{ padding: '8px 12px', textAlign: 'left', color: '#9ca3af', fontWeight: 600 }}
                >
                  State
                </th>
                <th
                  onClick={() => handleSort('perPupil')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'perPupil' ? '#d97706' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}
                >
                  $ / Student{sortIndicator('perPupil')}
                </th>
                <th
                  onClick={() => handleSort('grade4Reading')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'grade4Reading' ? '#d97706' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}
                >
                  4th Gr. Reading{sortIndicator('grade4Reading')}
                </th>
                <th
                  onClick={() => handleSort('grade8Math')}
                  style={{ padding: '8px 12px', textAlign: 'right', color: sortKey === 'grade8Math' ? '#d97706' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}
                >
                  8th Gr. Math{sortIndicator('grade8Math')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map((s, i) => (
                <tr key={s.state} style={{ borderTop: '1px solid #1f2937', background: i % 2 === 1 ? '#0d1623' : undefined }}>
                  <td style={{ padding: '7px 12px', color: '#e5e7eb' }}>{s.state}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                    {s.educationPerPupil > 0 ? formatCurrency(s.educationPerPupil) : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#e5e7eb' }}>
                    {s.naepGrade4Reading > 0 ? s.naepGrade4Reading : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#e5e7eb' }}>
                    {s.naepGrade8Math > 0 ? s.naepGrade8Math : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6b7280' }}>
          K-12 spending from Census F-33 Survey. NAEP scores from the Nation&apos;s Report Card. F-33 fiscal year lags calendar year by ~1 year.
        </p>
      </div>
    </div>
  )
}
