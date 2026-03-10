# State Comparison Selector + Choropleth Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a state comparison panel (hover checkboxes on bar chart) and a choropleth US map panel to the existing single-page dashboard.

**Architecture:** Two new components (`ComparisonPanel.tsx`, `ChoroplethMap.tsx`) receive shared state (`selectedStates`, `metric`) from `App.tsx`. Shared types and formatting utilities are extracted from `App.tsx` to `src/types.ts` and `src/format.ts` to avoid duplication. `react-simple-maps` renders the SVG map; `d3-scale` provides quantile color interpolation.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + React Testing Library, react-simple-maps v3, d3-scale

---

### Task 1: Install dependencies and set up test runner

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Create: `src/test-setup.ts`

**Step 1: Install runtime dependencies**

```bash
npm install react-simple-maps d3-scale
```

Expected: packages added to `dependencies` in `package.json`.

**Step 2: Install dev dependencies**

```bash
npm install --save-dev @types/d3-scale vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Step 3: Add test scripts to `package.json`**

In the `"scripts"` section add two entries:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Update `vite.config.ts` to configure Vitest**

Replace entire file content with:
```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/state-tax-app/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

**Step 5: Create `src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

**Step 6: Update `tsconfig.app.json` — add Vitest globals type**

Change the `"types"` field from:
```json
"types": ["vite/client"]
```
to:
```json
"types": ["vite/client", "vitest/globals"]
```

**Step 7: Verify build still passes**

```bash
npm run build
```

Expected: no TypeScript errors, `dist/` created successfully.

**Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.app.json src/test-setup.ts
git commit -m "feat: install react-simple-maps, d3-scale, and Vitest test runner"
```

---

### Task 2: Extract shared types and format utilities

`App.tsx` currently defines all types and helpers inline. The new components need them too, so we extract them first.

**Files:**
- Create: `src/types.ts`
- Create: `src/format.ts`
- Create: `src/format.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write failing tests for format utilities**

Create `src/format.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { compactCurrency, formatMetricValue, getMetricValue } from './format'
import type { StateRecord } from './types'

const mockState: StateRecord = {
  state: 'California',
  population: 39000000,
  totalRevenue: 500000,   // $500M in thousands
  perCapitaTotal: 12,     // ~$12k per capita in thousands
  perCapitaIncome: 45000, // $45,000 annual income
  breakdown: { property: 100000, income_individual: 200000 },
}

describe('compactCurrency', () => {
  it('formats billions', () => {
    expect(compactCurrency(1000000)).toBe('$1.0B')
  })
  it('formats millions', () => {
    expect(compactCurrency(5000)).toBe('$5.0M')
  })
  it('formats small values as dollars', () => {
    expect(compactCurrency(1)).toBe('$1,000')
  })
})

describe('getMetricValue', () => {
  it('returns totalRevenue for total metric', () => {
    expect(getMetricValue(mockState, 'total')).toBe(500000)
  })
  it('returns perCapitaTotal for perCapita metric', () => {
    expect(getMetricValue(mockState, 'perCapita')).toBe(12)
  })
  it('computes burden ratio for perCapitaBurden metric', () => {
    // (12 * 1000) / 45000 = 0.2667
    expect(getMetricValue(mockState, 'perCapitaBurden')).toBeCloseTo(0.2667, 3)
  })
  it('returns 0 for perCapitaBurden when income is 0', () => {
    expect(getMetricValue({ ...mockState, perCapitaIncome: 0 }, 'perCapitaBurden')).toBe(0)
  })
})

describe('formatMetricValue', () => {
  it('formats total metric as compact currency', () => {
    expect(formatMetricValue(1000000, 'total')).toContain('B')
  })
  it('formats perCapita metric with / resident suffix', () => {
    expect(formatMetricValue(12, 'perCapita')).toContain('/ resident')
  })
  it('formats perCapitaBurden as percentage', () => {
    expect(formatMetricValue(0.2667, 'perCapitaBurden')).toContain('% of income')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './format'`

**Step 3: Create `src/types.ts`**

```typescript
export type TaxType = {
  key: string
  label: string
}

export type StateRecord = {
  state: string
  population: number
  totalRevenue: number
  perCapitaTotal: number
  perCapitaIncome: number
  breakdown: Record<string, number>
}

export type DataPayload = {
  metadata: {
    year: number
    currency: string
    scope: string
    topN: number
    generatedAt?: string
    notes?: string[]
  }
  taxTypes: TaxType[]
  states: StateRecord[]
}

export type Metric = 'total' | 'perCapita' | 'perCapitaBurden'
```

**Step 4: Create `src/format.ts`**

```typescript
import type { StateRecord, Metric } from './types'

export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export const numberFormatter = new Intl.NumberFormat('en-US')

export const TAX_COLORS: Record<string, string> = {
  property: '#2563eb',
  sales_general: '#059669',
  sales_selective: '#34d399',
  income_individual: '#d97706',
  income_corporate: '#fbbf24',
  licenses: '#7c3aed',
  other: '#9ca3af',
}

// Revenue values are stored in thousands of dollars (Census Bureau native unit).
// Multiply by 1 000 before display, then abbreviate.
export const compactCurrency = (thousands: number): string => {
  const dollars = thousands * 1000
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(1)}B`
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(1)}M`
  return currencyFormatter.format(dollars)
}

export function getMetricValue(entry: StateRecord, metric: Metric): number {
  if (metric === 'total') return entry.totalRevenue
  if (metric === 'perCapita') return entry.perCapitaTotal
  return entry.perCapitaIncome > 0 ? (entry.perCapitaTotal * 1000) / entry.perCapitaIncome : 0
}

export function formatMetricValue(value: number, metric: Metric): string {
  if (metric === 'total') return compactCurrency(value)
  if (metric === 'perCapita') return `${currencyFormatter.format(value * 1000)} / resident`
  return `${(value * 100).toFixed(1)}% of income`
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests PASS.

**Step 6: Update `src/App.tsx` to import from shared modules**

At the top of `App.tsx`, add these two import lines after `import './App.css'`:
```typescript
import type { DataPayload, Metric } from './types'
import { compactCurrency, currencyFormatter, numberFormatter, TAX_COLORS } from './format'
```

Then remove from `App.tsx` (these are now in the shared modules):
- The `TaxType`, `StateRecord`, `DataPayload` type declarations
- The `currencyFormatter`, `numberFormatter` declarations and their `const` lines
- The `compactCurrency` function
- The `TAX_COLORS` constant

Keep `dateTimeFormatter` in `App.tsx` — it is only used there.

Change the `metric` state type annotation to use the extracted `Metric` type:
```typescript
const [metric, setMetric] = useState<Metric>('total')
```

**Step 7: Verify the build passes**

```bash
npm run build
```

Expected: no TypeScript errors, no unused variable warnings.

**Step 8: Commit**

```bash
git add src/types.ts src/format.ts src/format.test.ts src/App.tsx
git commit -m "refactor: extract shared types and format utilities from App.tsx"
```

---

### Task 3: ComparisonPanel component

**Files:**
- Create: `src/ComparisonPanel.tsx`
- Create: `src/ComparisonPanel.test.tsx`
- Modify: `src/App.css`

**Step 1: Write failing tests**

Create `src/ComparisonPanel.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComparisonPanel from './ComparisonPanel'
import type { StateRecord, TaxType } from './types'

const taxTypes: TaxType[] = [
  { key: 'property', label: 'Property' },
  { key: 'income_individual', label: 'Individual Income' },
]

const states: StateRecord[] = [
  {
    state: 'California',
    population: 39000000,
    totalRevenue: 300000000,
    perCapitaTotal: 7692,
    perCapitaIncome: 40000,
    breakdown: { property: 80000000, income_individual: 120000000 },
  },
  {
    state: 'Texas',
    population: 30000000,
    totalRevenue: 180000000,
    perCapitaTotal: 6000,
    perCapitaIncome: 35000,
    breakdown: { property: 90000000, income_individual: 0 },
  },
]

describe('ComparisonPanel', () => {
  it('renders nothing when no states are selected', () => {
    const { container } = render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set()}
        onToggleState={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a column header for each selected state', () => {
    render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set(['California', 'Texas'])}
        onToggleState={vi.fn()}
      />
    )
    expect(screen.getByText('California')).toBeInTheDocument()
    expect(screen.getByText('Texas')).toBeInTheDocument()
  })

  it('shows Total Revenue row label', () => {
    render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set(['California'])}
        onToggleState={vi.fn()}
      />
    )
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
  })

  it('shows tax type row labels', () => {
    render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set(['California'])}
        onToggleState={vi.fn()}
      />
    )
    expect(screen.getByText('Property')).toBeInTheDocument()
    expect(screen.getByText('Individual Income')).toBeInTheDocument()
  })

  it('calls onToggleState with state name when X button is clicked', async () => {
    const onToggle = vi.fn()
    render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set(['California'])}
        onToggleState={onToggle}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /remove california/i }))
    expect(onToggle).toHaveBeenCalledWith('California')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ComparisonPanel'`

**Step 3: Implement `src/ComparisonPanel.tsx`**

```typescript
import type { StateRecord, TaxType } from './types'
import { compactCurrency, currencyFormatter, getMetricValue } from './format'

type ComparisonPanelProps = {
  states: StateRecord[]
  taxTypes: TaxType[]
  selectedStates: Set<string>
  onToggleState: (name: string) => void
}

export default function ComparisonPanel({ states, taxTypes, selectedStates, onToggleState }: ComparisonPanelProps) {
  if (selectedStates.size === 0) return null

  const selected = states.filter((s) => selectedStates.has(s.state))

  return (
    <section className="comparison-panel panel">
      <h2>State Comparison</h2>
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th className="comparison-row-label" />
              {selected.map((s) => (
                <th key={s.state} className="comparison-state-header">
                  <span>{s.state}</span>
                  <button
                    type="button"
                    className="comparison-remove"
                    onClick={() => onToggleState(s.state)}
                    aria-label={`Remove ${s.state}`}
                  >
                    ×
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="comparison-row-label">Total Revenue</td>
              {selected.map((s) => (
                <td key={s.state}>{compactCurrency(getMetricValue(s, 'total'))}</td>
              ))}
            </tr>
            <tr>
              <td className="comparison-row-label">Per Capita</td>
              {selected.map((s) => (
                <td key={s.state}>{currencyFormatter.format(getMetricValue(s, 'perCapita') * 1000)} / resident</td>
              ))}
            </tr>
            <tr>
              <td className="comparison-row-label">% of Income</td>
              {selected.map((s) => (
                <td key={s.state}>
                  {s.perCapitaIncome > 0
                    ? `${(getMetricValue(s, 'perCapitaBurden') * 100).toFixed(1)}% of income`
                    : '—'}
                </td>
              ))}
            </tr>
            {taxTypes.map((taxType) => (
              <tr key={taxType.key}>
                <td className="comparison-row-label">{taxType.label}</td>
                {selected.map((s) => (
                  <td key={s.state}>{compactCurrency(s.breakdown[taxType.key] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests PASS.

**Step 5: Add comparison panel styles — append to `src/App.css`**

```css
/* ── Comparison Panel ─────────────────────────────────────── */
.comparison-panel {
  overflow-x: auto;
}

.comparison-table-wrap {
  overflow-x: auto;
}

.comparison-table {
  border-collapse: collapse;
  min-width: 100%;
  white-space: nowrap;
}

.comparison-table th,
.comparison-table td {
  padding: 0.5rem 1rem;
  text-align: right;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
}

.comparison-table th {
  background: #f9fafb;
  font-weight: 600;
}

.comparison-row-label {
  text-align: left !important;
  font-weight: 500;
  color: #374151;
  min-width: 140px;
}

.comparison-state-header {
  text-align: center !important;
  min-width: 160px;
}

.comparison-state-header span {
  display: block;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.comparison-remove {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.1rem 0.4rem;
  color: #6b7280;
}

.comparison-remove:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}
```

**Step 6: Verify build**

```bash
npm run build
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src/ComparisonPanel.tsx src/ComparisonPanel.test.tsx src/App.css
git commit -m "feat: add ComparisonPanel component with side-by-side state comparison"
```

---

### Task 4: ChoroplethMap component

`react-simple-maps` fetches a remote TopoJSON file at render time. Tests mock the library to avoid network requests and to control what geographies are rendered.

**Files:**
- Create: `src/ChoroplethMap.tsx`
- Create: `src/ChoroplethMap.test.tsx`
- Modify: `src/App.css`

**Step 1: Write failing tests**

Create `src/ChoroplethMap.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChoroplethMap from './ChoroplethMap'
import type { StateRecord } from './types'

// Mock react-simple-maps so tests don't make network requests.
// Geography renders as a <rect> with a data-testid and onClick wired up.
vi.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Geographies: ({
    children,
  }: {
    children: (args: { geographies: unknown[] }) => React.ReactNode
  }) =>
    children({
      geographies: [
        { rsmKey: 'CA', properties: { name: 'California' } },
        { rsmKey: 'TX', properties: { name: 'Texas' } },
      ],
    }),
  Geography: ({
    geography,
    onClick,
  }: {
    geography: { properties: { name: string } }
    onClick: () => void
  }) => (
    <rect
      data-testid={`geo-${geography.properties.name}`}
      onClick={onClick}
    />
  ),
}))

const states: StateRecord[] = [
  {
    state: 'California',
    population: 39000000,
    totalRevenue: 300000000,
    perCapitaTotal: 7692,
    perCapitaIncome: 40000,
    breakdown: {},
  },
  {
    state: 'Texas',
    population: 30000000,
    totalRevenue: 180000000,
    perCapitaTotal: 6000,
    perCapitaIncome: 35000,
    breakdown: {},
  },
]

describe('ChoroplethMap', () => {
  it('renders an SVG container', () => {
    const { container } = render(
      <ChoroplethMap states={states} metric="total" selectedStates={new Set()} onToggleState={vi.fn()} />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a geography element for each state in mock data', () => {
    render(
      <ChoroplethMap states={states} metric="total" selectedStates={new Set()} onToggleState={vi.fn()} />
    )
    expect(screen.getByTestId('geo-California')).toBeInTheDocument()
    expect(screen.getByTestId('geo-Texas')).toBeInTheDocument()
  })

  it('calls onToggleState with state name when a geography is clicked', async () => {
    const onToggle = vi.fn()
    render(
      <ChoroplethMap states={states} metric="total" selectedStates={new Set()} onToggleState={onToggle} />
    )
    await userEvent.click(screen.getByTestId('geo-California'))
    expect(onToggle).toHaveBeenCalledWith('California')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ChoroplethMap'`

**Step 3: Implement `src/ChoroplethMap.tsx`**

```typescript
import { useState } from 'react'
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

  const stateByName = new Map(states.map((s) => [s.state, s]))

  const colorScale = scaleQuantile<string>()
    .domain(states.map((s) => getMetricValue(s, metric)))
    .range(COLOR_RANGE)

  return (
    <div className="map-panel" style={{ position: 'relative' }}>
      <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: 'auto' }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name = (geo.properties as { name: string }).name
              const entry = stateByName.get(name)
              const value = entry ? getMetricValue(entry, metric) : 0
              const isSelected = selectedStates.has(name)

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={entry ? colorScale(value) : '#e5e7eb'}
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
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests PASS.

**Step 5: Add map styles — append to `src/App.css`**

```css
/* ── Choropleth Map ───────────────────────────────────────── */
.chart-map-row {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.chart-map-row > .panel {
  flex: 1 1 0;
  min-width: 0;
}

.map-panel-section {
  flex: 0 0 42% !important;
}

.map-panel {
  width: 100%;
}

.map-tooltip {
  position: absolute;
  background: rgba(17, 24, 39, 0.9);
  color: #fff;
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  z-index: 10;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .chart-map-row {
    flex-direction: column;
  }

  .map-panel-section {
    flex: 1 1 auto !important;
    width: 100%;
  }
}
```

**Step 6: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

**Step 7: Commit**

```bash
git add src/ChoroplethMap.tsx src/ChoroplethMap.test.tsx src/App.css
git commit -m "feat: add ChoroplethMap component with quantile color scale"
```

---

### Task 5: Wire up App.tsx — state, layout, and bar checkboxes

This integration task: adds `selectedStates` state + `toggleState` handler, wraps bar chart + map in a flex row, adds hover checkboxes to bar rows, and renders `ComparisonPanel`.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Step 1: Add imports for new components at the top of `App.tsx`**

After the existing imports, add:
```typescript
import ChoroplethMap from './ChoroplethMap'
import ComparisonPanel from './ComparisonPanel'
```

**Step 2: Add `selectedStates` state and `toggleState` handler**

Inside `function App()`, after the existing `useState` declarations, add:
```typescript
const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set())

const toggleState = (name: string) => {
  setSelectedStates((prev) => {
    const next = new Set(prev)
    if (next.has(name)) {
      next.delete(name)
    } else if (next.size < 5) {
      next.add(name)
    }
    return next
  })
}
```

**Step 3: Add checkbox to each bar row**

In the JSX, find each `<article key={entry.state} className="bar-row" ...>` element.

Change its `className` to conditionally add the selected class:
```tsx
className={`bar-row${selectedStates.has(entry.state) ? ' bar-row--selected' : ''}`}
```

Add this label element as the first child inside the `<article>`, before `<header>`:
```tsx
<label
  className="bar-checkbox-label"
  title={selectedStates.size >= 5 && !selectedStates.has(entry.state) ? 'Max 5 states' : ''}
>
  <input
    type="checkbox"
    className="bar-checkbox"
    checked={selectedStates.has(entry.state)}
    disabled={selectedStates.size >= 5 && !selectedStates.has(entry.state)}
    onChange={() => toggleState(entry.state)}
    aria-label={`Compare ${entry.state}`}
  />
</label>
```

**Step 4: Wrap bar chart section + add map section in a flex row**

Find the `<section className="panel">` that contains the bar chart (the one with `"Compare totals across states"` heading). Wrap it and a new map section in a `div`:

```tsx
<div className="chart-map-row">
  <section className="panel">
    {/* ... existing bar chart section content unchanged ... */}
  </section>
  <section className="panel map-panel-section">
    <h2>Tax by geography</h2>
    <ChoroplethMap
      states={data.states}
      metric={metric}
      selectedStates={selectedStates}
      onToggleState={toggleState}
    />
  </section>
</div>
```

**Step 5: Add ComparisonPanel below the chart-map-row div**

Immediately after the closing `</div>` of `chart-map-row`, add:
```tsx
<ComparisonPanel
  states={data.states}
  taxTypes={data.taxTypes}
  selectedStates={selectedStates}
  onToggleState={toggleState}
/>
```

**Step 6: Add bar checkbox styles — append to `src/App.css`**

```css
/* ── Bar chart checkboxes ─────────────────────────────────── */
.bar-row {
  position: relative;
}

.bar-checkbox-label {
  position: absolute;
  left: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}

.bar-row:hover .bar-checkbox-label,
.bar-row--selected .bar-checkbox-label {
  opacity: 1;
}

.bar-checkbox {
  cursor: pointer;
  width: 1rem;
  height: 1rem;
  accent-color: #2563eb;
}

.bar-checkbox:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.bar-row--selected {
  outline: 2px solid #f59e0b;
  outline-offset: -2px;
  border-radius: 4px;
}
```

**Step 7: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors, no unused variable warnings.

**Step 8: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

**Step 9: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:5173/state-tax-app/` and verify:
- [ ] Hovering a bar reveals a checkbox on its left edge
- [ ] Clicking a checkbox selects the state; the bar gets a gold outline
- [ ] The comparison panel appears below with one column per selected state
- [ ] The × button in the comparison panel deselects the state
- [ ] Clicking a state on the choropleth map selects it (and its bar gets checked too)
- [ ] Both map shading and comparison panel update when switching metric toggle
- [ ] Attempting to select a 6th state is blocked (checkbox disabled, tooltip shown)

**Step 10: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: wire up selectedStates, bar checkboxes, choropleth map, and comparison panel"
```
