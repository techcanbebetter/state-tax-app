import { useState, useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { scaleQuantile } from 'd3-scale'
import type { StateRecord, Metric } from './types'
import { getMetricValue, formatMetricValue } from './format'

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
  metric: Metric
  selectedStates: Set<string>
  onToggleState: (name: string) => void
}

export default function ChoroplethMap({ states, metric, selectedStates, onToggleState }: ChoroplethMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  const stateByName = useMemo(() => new Map(states.map((s) => [s.state, s])), [states])

  const colorScale = useMemo(
    () => scaleQuantile<string>().domain(states.map((s) => getMetricValue(s, metric))).range(COLOR_RANGE),
    [states, metric]
  )

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
              const value = entry ? getMetricValue(entry, metric) : 0
              const isSelected = selectedStates.has(name)

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={entry ? (colorScale(value) ?? COLOR_RANGE[0]) : '#e5e7eb'}
                  stroke={isSelected ? '#f59e0b' : '#fff'}
                  strokeWidth={isSelected ? 2.5 : 0.5}
                  style={{
                    default: { outline: 'none', cursor: 'pointer' },
                    hover: { outline: 'none', filter: 'brightness(0.85)' },
                    pressed: { outline: 'none' },
                  }}
                  onClick={() => {
                    if (entry) onToggleState(name)
                  }}
                  onMouseEnter={(e: React.MouseEvent) => {
                    if (!entry) return
                    const rect = (e.currentTarget as SVGElement).closest('.map-panel')?.getBoundingClientRect()
                    setTooltip({
                      name,
                      value: formatMetricValue(value, metric),
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
    </div>
  )
}
