import { useState, useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { scaleQuantile } from 'd3-scale'
import type { StateRecord } from './types'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const COLOR_RANGE = [
  '#eff6ff', '#bfdbfe', '#93c5fd', '#60a5fa',
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af',
]

type TooltipState = {
  name: string
  value: string
  x: number
  y: number
} | null

type ChoroplethMapProps = {
  states: StateRecord[]
  getValue: (s: StateRecord) => number
  formatValue: (value: number) => string
}

export default function ChoroplethMap({ states, getValue, formatValue }: ChoroplethMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  const stateByName = useMemo(() => new Map(states.map((s) => [s.state, s])), [states])

  const colorScale = useMemo(
    () => scaleQuantile<string>().domain(states.map((s) => getValue(s))).range(COLOR_RANGE),
    [states, getValue]
  )

  const { domainMin, domainMax } = useMemo(() => {
    if (!states.length) return { domainMin: 0, domainMax: 0 }
    const values = states.map((s) => getValue(s))
    return { domainMin: Math.min(...values), domainMax: Math.max(...values) }
  }, [states, getValue])

  return (
    <div className="map-panel" style={{ position: 'relative' }}>
      <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: 'auto' }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name = typeof (geo.properties as Record<string, unknown>).name === 'string'
                ? (geo.properties as Record<string, unknown>).name as string
                : null
              if (!name) return null
              const entry = stateByName.get(name)
              const value = entry ? getValue(entry) : 0

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={entry ? (colorScale(value) ?? COLOR_RANGE[0]) : '#e5e7eb'}
                  stroke="#fff"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', filter: 'brightness(0.85)' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={(e: React.MouseEvent) => {
                    if (!entry) return
                    const rect = (e.currentTarget as SVGElement).closest('.map-panel')?.getBoundingClientRect()
                    setTooltip({
                      name,
                      value: formatValue(value),
                      x: e.clientX - (rect?.left ?? 0),
                      y: e.clientY - (rect?.top ?? 0),
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 8, top: tooltip.y - 8 }}>
          <strong>{tooltip.name}</strong>
          <span>{tooltip.value}</span>
        </div>
      )}

      <div className="map-legend">
        <div className="map-legend-title">Color scale</div>
        <div className="map-legend-bar">
          {COLOR_RANGE.map((color, i) => (
            <div key={i} className="map-legend-segment" style={{ background: color }} />
          ))}
        </div>
        <div className="map-legend-ticks">
          <span className="map-legend-tick">{formatValue(domainMin)}</span>
          <span className="map-legend-tick">{formatValue(domainMax)}</span>
        </div>
      </div>
    </div>
  )
}
