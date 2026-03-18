# Spending View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a state spending analysis dashboard alongside the existing tax revenue view, with a tab bar to switch between them.

**Architecture:** Extend `StateRecord` and `MultiYearPayload` with spending fields populated from existing Census raw data (no new downloads); refactor `App.tsx` into a thin shell with `RevenueView` and `SpendingView` components; update `ChoroplethMap` to use callback props instead of a `Metric` dependency.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, @testing-library/react, Census `timeseries/govs` API (already downloaded), papaparse.

---

## Chunk 1: Foundation — Types and Format Utilities

### Task 1: Extend data types and update all test fixtures

**Files:**
- Modify: `src/types.ts`
- Modify: `src/format.test.ts` (add `spendingTotal`/`spendingBreakdown` to `mockState`)
- Modify: `src/ChoroplethMap.test.tsx` (add fields to `states` array)
- Modify: `src/App.test.tsx` (add fields to all `states` entries in `testPayload`)
- Modify: `src/PersonalCalculator.test.tsx` (add fields to `states` array)

- [ ] **Step 1.1: Add `SpendingMetric`, extend `StateRecord` and `MultiYearPayload` in `types.ts`**

Replace the contents of `src/types.ts` with:

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
  spendingTotal: number
  spendingBreakdown: Record<string, number>
}

export type YearRecord = {
  year: number
  states: StateRecord[]
}

export type MultiYearPayload = {
  metadata: {
    year: number
    yearRange: [number, number]
    currency: string
    scope: string
    topN: number
    generatedAt?: string
    notes?: string[]
  }
  taxTypes: TaxType[]
  spendingTypes: TaxType[]
  years: YearRecord[]
}

// Backward-compat alias
export type DataPayload = MultiYearPayload

export type Metric = 'total' | 'perCapita' | 'perCapitaBurden'

export type SpendingMetric = 'total' | 'perCapita'
```

- [ ] **Step 1.2: Confirm TypeScript compilation fails with the old test fixtures**

Run: `npm run build 2>&1 | head -40`

Expected: TypeScript errors complaining that `StateRecord` mock objects are missing `spendingTotal` and `spendingBreakdown`. This confirms we need to update fixtures.

- [ ] **Step 1.3: Update `src/format.test.ts` mock state**

Change the `mockState` constant to add the two new fields:

```typescript
const mockState: StateRecord = {
  state: 'California',
  population: 39000000,
  totalRevenue: 350000000000,
  perCapitaTotal: 12000,
  perCapitaIncome: 45000,
  breakdown: { property: 100000000000, income_individual: 200000000000 },
  spendingTotal: 280000000000,
  spendingBreakdown: {
    education: 90000000000,
    public_welfare: 60000000000,
    health_hospitals: 45000000000,
    highways: 22000000000,
    police_corrections: 18000000000,
    natural_resources: 12000000000,
    other: 33000000000,
  },
}
```

- [ ] **Step 1.4: Update `src/ChoroplethMap.test.tsx` state fixtures**

Add `spendingTotal` and `spendingBreakdown` to both states in the `states` array:

```typescript
const states: StateRecord[] = [
  {
    state: 'California',
    population: 39000000,
    totalRevenue: 300000000,
    perCapitaTotal: 7692,
    perCapitaIncome: 40000,
    breakdown: {},
    spendingTotal: 250000000,
    spendingBreakdown: {},
  },
  {
    state: 'Texas',
    population: 30000000,
    totalRevenue: 180000000,
    perCapitaTotal: 6000,
    perCapitaIncome: 35000,
    breakdown: {},
    spendingTotal: 150000000,
    spendingBreakdown: {},
  },
]
```

- [ ] **Step 1.5: Update `src/PersonalCalculator.test.tsx` state fixtures**

Add `spendingTotal` and `spendingBreakdown` to all three states:

```typescript
const states: StateRecord[] = [
  { state: 'California', population: 39000000, totalRevenue: 300000, perCapitaTotal: 7, perCapitaIncome: 80000, breakdown: {}, spendingTotal: 0, spendingBreakdown: {} },
  { state: 'Texas', population: 30000000, totalRevenue: 200000, perCapitaTotal: 6, perCapitaIncome: 60000, breakdown: {}, spendingTotal: 0, spendingBreakdown: {} },
  { state: 'Florida', population: 22000000, totalRevenue: 150000, perCapitaTotal: 5, perCapitaIncome: 55000, breakdown: {}, spendingTotal: 0, spendingBreakdown: {} },
]
```

- [ ] **Step 1.6: Update `src/App.test.tsx` — add `spendingTypes` to payload and spending fields to all state records**

Add `spendingTypes` to `testPayload` at the top level (after `taxTypes`):

```typescript
spendingTypes: [
  { key: 'education', label: 'Education' },
  { key: 'public_welfare', label: 'Public Welfare' },
  { key: 'health_hospitals', label: 'Health & Hospitals' },
  { key: 'highways', label: 'Highways' },
  { key: 'police_corrections', label: 'Police & Corrections' },
  { key: 'natural_resources', label: 'Natural Resources' },
  { key: 'other', label: 'Other' },
],
```

Add `spendingTotal: 0, spendingBreakdown: {}` to every `StateRecord` object inside `testPayload.years`. There are 10 total (2 states × 5 years) — add both fields to each.

- [ ] **Step 1.7: Verify tests pass**

Run: `npm test -- --run 2>&1 | tail -20`

Expected: All existing tests pass. No TypeScript errors.

- [ ] **Step 1.8: Commit**

```bash
git add src/types.ts src/format.test.ts src/ChoroplethMap.test.tsx src/PersonalCalculator.test.tsx src/App.test.tsx
git commit -m "feat: add SpendingMetric type and spending fields to StateRecord and MultiYearPayload"
```

---

### Task 2: Extend format utilities — spending helpers and trillion support

**Files:**
- Modify: `src/format.ts`
- Modify: `src/format.test.ts`

- [ ] **Step 2.1: Write failing tests for new format functions**

Add to `src/format.test.ts` after the existing `describe` blocks:

```typescript
describe('compactCurrency — trillion support', () => {
  it('formats values >= 1 trillion with T suffix', () => {
    expect(compactCurrency(1_000_000_000_000)).toBe('$1.0T')
  })
  it('formats 2.5 trillion', () => {
    expect(compactCurrency(2_500_000_000_000)).toBe('$2.5T')
  })
  it('still formats billions correctly', () => {
    expect(compactCurrency(500_000_000_000)).toBe('$500.0B')
  })
})

describe('getSpendingMetricValue', () => {
  it('returns spendingTotal for total metric', () => {
    expect(getSpendingMetricValue(mockState, 'total')).toBe(280000000000)
  })
  it('computes per-capita for perCapita metric', () => {
    // 280000000000 / 39000000 ≈ 7179.49
    expect(getSpendingMetricValue(mockState, 'perCapita')).toBeCloseTo(7179.49, 1)
  })
  it('returns 0 for perCapita when population is 0', () => {
    expect(getSpendingMetricValue({ ...mockState, population: 0 }, 'perCapita')).toBe(0)
  })
})

describe('formatSpendingMetricValue', () => {
  it('formats total as compact currency', () => {
    expect(formatSpendingMetricValue(280000000000, 'total')).toBe('$280.0B')
  })
  it('formats perCapita with / resident suffix', () => {
    expect(formatSpendingMetricValue(7179, 'perCapita')).toBe('$7,179 / resident')
  })
})
```

Update the import line at the top of `format.test.ts` to include the new exports:

```typescript
import { compactCurrency, formatMetricValue, getMetricValue, getSpendingMetricValue, formatSpendingMetricValue } from './format'
import type { StateRecord } from './types'
```

- [ ] **Step 2.2: Run tests to confirm they fail**

Run: `npm test -- --run src/format.test.ts 2>&1 | tail -20`

Expected: FAIL — `getSpendingMetricValue` and `formatSpendingMetricValue` are not exported, trillion test fails.

- [ ] **Step 2.3: Implement the new format utilities in `src/format.ts`**

Replace `src/format.ts` with:

```typescript
import type { StateRecord, Metric, SpendingMetric } from './types'

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

export const SPENDING_COLORS: Record<string, string> = {
  education: '#0ea5e9',
  public_welfare: '#ec4899',
  health_hospitals: '#ef4444',
  highways: '#f59e0b',
  police_corrections: '#3b82f6',
  natural_resources: '#22c55e',
  other: '#9ca3af',
}

// Revenue values are stored in dollars (ingest script converts from Census thousands).
export const compactCurrency = (dollars: number): string => {
  if (dollars >= 1e12) return `$${(dollars / 1e12).toFixed(1)}T`
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(1)}B`
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(1)}M`
  return currencyFormatter.format(dollars)
}

export function getMetricValue(entry: StateRecord, metric: Metric): number {
  if (metric === 'total') return entry.totalRevenue
  if (metric === 'perCapita') return entry.perCapitaTotal
  return entry.perCapitaIncome > 0 ? entry.perCapitaTotal / entry.perCapitaIncome : 0
}

/**
 * Format a metric value for display.
 * For `perCapita`, `value` is dollars per resident.
 * For `perCapitaBurden`, `value` is a ratio (0–1); multiply by 100 for percentage display.
 */
export function formatMetricValue(value: number, metric: Metric): string {
  if (metric === 'total') return compactCurrency(value)
  if (metric === 'perCapita') return `${currencyFormatter.format(value)} / resident`
  return `${(value * 100).toFixed(1)}% of income`
}

export function getSpendingMetricValue(entry: StateRecord, metric: SpendingMetric): number {
  if (metric === 'total') return entry.spendingTotal
  return entry.population > 0 ? entry.spendingTotal / entry.population : 0
}

export function formatSpendingMetricValue(value: number, metric: SpendingMetric): string {
  if (metric === 'total') return compactCurrency(value)
  return `${currencyFormatter.format(value)} / resident`
}
```

- [ ] **Step 2.4: Run tests to confirm they pass**

Run: `npm test -- --run src/format.test.ts 2>&1 | tail -20`

Expected: All tests in `format.test.ts` PASS.

- [ ] **Step 2.5: Run full test suite to confirm no regressions**

Run: `npm test -- --run 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 2.6: Commit**

```bash
git add src/format.ts src/format.test.ts
git commit -m "feat: add SPENDING_COLORS, getSpendingMetricValue, formatSpendingMetricValue; extend compactCurrency for trillions"
```

---

## Chunk 2: Data Pipeline

### Task 3: Update config files

**Files:**
- Modify: `data/config/source-download.config.json`
- Modify: `data/config/ingestion.config.json`

- [ ] **Step 3.1: Add spending output path to `source-download.config.json`**

Add `"spending": "data/raw/state-local-spending-by-function.csv"` to the `normalizedOutputs` object. Final `normalizedOutputs`:

```json
"normalizedOutputs": {
  "tax": "data/raw/state-local-tax-by-type.csv",
  "population": "data/raw/state-population.csv",
  "income": "data/raw/state-per-capita-income.csv",
  "spending": "data/raw/state-local-spending-by-function.csv"
}
```

- [ ] **Step 3.2: Add spending config to `ingestion.config.json`**

Add `"spendingByFunctionCsv"` to the `input` block and add two new top-level keys `spendingCategoryMap` and `spendingCategoryLabels`:

```json
"input": {
  "taxByTypeCsv": "data/raw/state-local-tax-by-type.csv",
  "populationCsv": "data/raw/state-population.csv",
  "incomeCsv": "data/raw/state-per-capita-income.csv",
  "spendingByFunctionCsv": "data/raw/state-local-spending-by-function.csv"
},
```

```json
"spendingCategoryMap": {
  "LF0106": "education",
  "LF0122": "public_welfare",
  "LF0128": "health_hospitals",
  "LF0131": "health_hospitals",
  "LF0140": "highways",
  "LF0152": "police_corrections",
  "LF0158": "police_corrections",
  "LF0164": "natural_resources",
  "LF0167": "natural_resources"
},
"spendingCategoryLabels": {
  "education": "Education",
  "public_welfare": "Public Welfare",
  "health_hospitals": "Health & Hospitals",
  "highways": "Highways",
  "police_corrections": "Police & Corrections",
  "natural_resources": "Natural Resources",
  "other": "Other"
}
```

- [ ] **Step 3.3: Commit**

```bash
git add data/config/source-download.config.json data/config/ingestion.config.json
git commit -m "feat: add spending output path and category config to pipeline configs"
```

---

### Task 4: Extend `normalize-census-sources.mjs` to extract spending rows

**Files:**
- Modify: `scripts/normalize-census-sources.mjs`

- [ ] **Step 4.1: Add `normalizeSpendingFromCensusApiRows` function**

In `scripts/normalize-census-sources.mjs`, add this function immediately after the closing brace of `normalizeTaxFromCensusApiRows`:

```javascript
const SPENDING_LF_CODES = new Set([
  'LF0090', // Total General Expenditure (spendingTotal)
  'LF0106', // Education
  'LF0122', // Public Welfare
  'LF0128', // Hospitals
  'LF0131', // Health
  'LF0140', // Highways
  'LF0152', // Police Protection
  'LF0158', // Correction
  'LF0164', // Natural Resources
  'LF0167', // Parks and Recreation
])

const normalizeSpendingFromCensusApiRows = (rows, config) => {
  const bucket = new Map()

  for (const row of rows) {
    const state = normalizeState(row.NAME ?? row.state ?? row.State)
    const year = Number(row.YEAR ?? row.year ?? config.year)
    const code = String(row.AGG_DESC ?? '').trim()
    const govType = String(row.GOVTYPE ?? '').trim()

    if (!state || !VALID_STATES.has(state) || !SPENDING_LF_CODES.has(code) || !['002', '003'].includes(govType)) {
      continue
    }

    const amount = parseNumeric(row.AMOUNT)
    const mapKey = `${state}||${year}||${code}`
    const current = bucket.get(mapKey) ?? { state, year, lf_code: code, amount: 0 }
    current.amount += amount
    bucket.set(mapKey, current)
  }

  return [...bucket.values()]
}
```

- [ ] **Step 4.2: Wire `normalizeSpendingFromCensusApiRows` into `run()`**

In the `run()` function, find the `normalizedTaxRows` block — the call to `normalizeTaxFromCensusApiRows(taxRows, config)`. After that block, and before the population normalization loop, add:

```javascript
  // Spending: reuse the same allTaxApiRows (already contains expenditure LF codes)
  const normalizedSpendingRows = taxRowsLookLikeCensusApi
    ? normalizeSpendingFromCensusApiRows(taxRows, config)
    : []

  if (taxRowsLookLikeCensusApi && normalizedSpendingRows.length === 0) {
    console.warn('Spending normalization produced zero rows. Check LF code availability in the raw Census files.')
  }
```

- [ ] **Step 4.3: Write the spending CSV output at the end of `run()`**

After the existing `writeCsv` calls for tax, population, and income, add:

```javascript
  const spendingOutput = await writeCsv(config.normalizedOutputs.spending, normalizedSpendingRows, [
    'state',
    'year',
    'lf_code',
    'amount',
  ])
  console.log(`Normalized spending rows: ${normalizedSpendingRows.length} -> ${path.relative(projectRoot, spendingOutput)}`)
```

- [ ] **Step 4.4: Run the normalize script and check output**

Run: `node scripts/normalize-census-sources.mjs 2>&1`

Expected output includes a line like:
```
Normalized spending rows: 2500 -> data/raw/state-local-spending-by-function.csv
```

Check the file exists and has reasonable content:
```bash
head -5 data/raw/state-local-spending-by-function.csv
wc -l data/raw/state-local-spending-by-function.csv
```

Expected: CSV with columns `state,year,lf_code,amount`. Line count should be ~2500 (50 states × 5 years × 10 LF codes).

- [ ] **Step 4.5: Commit**

```bash
git add scripts/normalize-census-sources.mjs data/raw/state-local-spending-by-function.csv
git commit -m "feat: extract spending rows from Census data in normalize script"
```

---

### Task 5: Extend `ingest-state-tax-data.mjs` to populate spending fields

**Files:**
- Modify: `scripts/ingest-state-tax-data.mjs`

- [ ] **Step 5.1: Read spending CSV and build spending lookup map**

In `run()`, after the three existing `readCsv` calls (tax, population, income), add:

```javascript
  // Spending: read gracefully — missing file is non-fatal (older dataset without spending data)
  const spendingCsvPath = path.resolve(projectRoot, config.input.spendingByFunctionCsv)
  let spendingRows = []
  try {
    spendingRows = await readCsv(spendingCsvPath)
  } catch {
    console.warn('Spending CSV not found — spendingTotal and spendingBreakdown will be 0 for all states.')
  }

  // Build spending lookup: `${state}||${year}||${lf_code}` → amount in dollars
  const spendingByStateYearCode = new Map()
  for (const row of spendingRows) {
    const state = normalizeState(row.state)
    const year = Number(row.year)
    const lfCode = String(row.lf_code ?? '').trim()
    if (!state || !VALID_STATES.has(state) || !Number.isFinite(year) || !lfCode) continue
    // normalize script outputs Census thousands — convert to full dollars
    const amount = parseNumeric(row.amount) * 1000
    spendingByStateYearCode.set(`${state}||${year}||${lfCode}`, amount)
  }
```

- [ ] **Step 5.2: Add spending fields when building each `StateRecord`**

Find the `.map((state) => {` block inside the year loop (around line 269). Replace the `return { ...state, ... }` statement to include spending fields:

```javascript
        const spendingCategoryMap = config.spendingCategoryMap ?? {}
        const spendingTotal = spendingByStateYearCode.get(`${state.state}||${year}||LF0090`) ?? 0
        const spendingBreakdown = {}
        for (const [lfCode, category] of Object.entries(spendingCategoryMap)) {
          const amount = spendingByStateYearCode.get(`${state.state}||${year}||${lfCode}`) ?? 0
          spendingBreakdown[category] = (spendingBreakdown[category] ?? 0) + amount
        }
        const categoriesSum = Object.values(spendingBreakdown).reduce((s, v) => s + v, 0)
        spendingBreakdown.other = Math.max(0, spendingTotal - categoriesSum)

        return {
          ...state,
          totalRevenue: Math.round(state.totalRevenue),
          perCapitaTotal: Number(perCapitaTotal.toFixed(2)),
          perCapitaIncome,
          spendingTotal: Math.round(spendingTotal),
          spendingBreakdown: Object.fromEntries(
            Object.entries(spendingBreakdown).map(([k, v]) => [k, Math.round(v)])
          ),
        }
```

- [ ] **Step 5.3: Add `spendingTypes` to the payload**

Find the `payload` object construction (around line 289). Add `spendingTypes` after `taxTypes`:

```javascript
    spendingTypes: config.spendingCategoryLabels
      ? Object.entries(config.spendingCategoryLabels).map(([key, label]) => ({ key, label }))
      : [],
```

- [ ] **Step 5.4: Run the ingest script and verify spending data in output**

Run: `node scripts/ingest-state-tax-data.mjs 2>&1`

Expected: Script completes without error.

Check spending data in output:
```bash
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('public/data/state-tax-summary-2019-2023.json'));
console.log('spendingTypes:', d.spendingTypes.length);
const ca2023 = d.years.find(y=>y.year===2023).states.find(s=>s.state==='California');
console.log('CA 2023 spendingTotal:', ca2023.spendingTotal);
console.log('CA 2023 spendingBreakdown keys:', Object.keys(ca2023.spendingBreakdown));
"
```

Expected: `spendingTypes` has 7 entries, `spendingTotal` is a large positive number (hundreds of billions), and `spendingBreakdown` has 7 keys.

- [ ] **Step 5.5: Commit**

```bash
git add scripts/ingest-state-tax-data.mjs public/data/state-tax-summary-2019-2023.json
git commit -m "feat: populate spendingTotal, spendingBreakdown, and spendingTypes in ingest script"
```

---

## Chunk 3: ChoroplethMap Refactor

### Task 6: Replace `metric: Metric` prop with `getValue` / `formatValue` callbacks

**Files:**
- Modify: `src/ChoroplethMap.tsx`
- Modify: `src/ChoroplethMap.test.tsx`
- Modify: `src/App.tsx` (temporary — update the one call site until RevenueView is extracted in Chunk 4)

- [ ] **Step 6.1: Update `ChoroplethMap.test.tsx` to use the new prop interface**

Replace the existing `ChoroplethMapProps` usage. Update `src/ChoroplethMap.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChoroplethMap from './ChoroplethMap'
import type { StateRecord } from './types'
import { getMetricValue, formatMetricValue } from './format'

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
        { rsmKey: 'XX', properties: { name: 'Unknown State' } },
      ],
    }),
  Geography: ({
    geography,
  }: {
    geography: { properties: { name: string } }
  }) => (
    <rect
      data-testid={`geo-${geography.properties.name}`}
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
    spendingTotal: 250000000,
    spendingBreakdown: {},
  },
  {
    state: 'Texas',
    population: 30000000,
    totalRevenue: 180000000,
    perCapitaTotal: 6000,
    perCapitaIncome: 35000,
    breakdown: {},
    spendingTotal: 150000000,
    spendingBreakdown: {},
  },
]

describe('ChoroplethMap', () => {
  it('renders an SVG container', () => {
    const { container } = render(
      <ChoroplethMap
        states={states}
        getValue={(s) => getMetricValue(s, 'total')}
        formatValue={(v) => formatMetricValue(v, 'total')}
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a geography element for each state in mock data', () => {
    render(
      <ChoroplethMap
        states={states}
        getValue={(s) => getMetricValue(s, 'total')}
        formatValue={(v) => formatMetricValue(v, 'total')}
      />
    )
    expect(screen.getByTestId('geo-California')).toBeInTheDocument()
    expect(screen.getByTestId('geo-Texas')).toBeInTheDocument()
  })

  it('renders without error when a spending getValue is used', () => {
    const { container } = render(
      <ChoroplethMap
        states={states}
        getValue={(s) => s.spendingTotal}
        formatValue={(v) => `$${v}`}
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
```

- [ ] **Step 6.2: Run tests to confirm they fail**

Run: `npm test -- --run src/ChoroplethMap.test.tsx 2>&1 | tail -20`

Expected: FAIL — `ChoroplethMap` does not accept `getValue`/`formatValue` props yet.

- [ ] **Step 6.3: Rewrite `ChoroplethMap.tsx` with new prop interface**

Replace `src/ChoroplethMap.tsx` with:

```typescript
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
    </div>
  )
}
```

- [ ] **Step 6.4: Update `App.tsx` to pass callbacks to `ChoroplethMap`**

In `src/App.tsx`, find the `<ChoroplethMap>` render and update it:

```typescript
// Change from:
<ChoroplethMap
  states={activeStates}
  metric={metric}
/>
// Change to:
<ChoroplethMap
  states={activeStates}
  getValue={(s) => getMetricValue(s, metric)}
  formatValue={(v) => formatMetricValue(v, metric)}
/>
```

Also add `formatMetricValue` to the import from `./format`:
```typescript
import { compactCurrency, currencyFormatter, formatMetricValue, formatSpendingMetricValue, getMetricValue, numberFormatter, TAX_COLORS } from './format'
```

- [ ] **Step 6.5: Run tests to confirm all pass**

Run: `npm test -- --run 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 6.6: Commit**

```bash
git add src/ChoroplethMap.tsx src/ChoroplethMap.test.tsx src/App.tsx
git commit -m "refactor: replace ChoroplethMap metric prop with getValue/formatValue callbacks"
```

---

## Chunk 4: RevenueView Extraction and App.tsx Tab Bar

### Task 7: Extract `RevenueView.tsx` from `App.tsx`

**Files:**
- Create: `src/RevenueView.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 7.1: Create `src/RevenueView.tsx`**

Create `src/RevenueView.tsx` by moving the bar chart panel, choropleth map, breakdown table, and `PersonalCalculator` out of `App.tsx`. The component receives all the data it needs as props:

```typescript
import { useMemo, useState } from 'react'
import type { MultiYearPayload, Metric, StateRecord } from './types'
import { compactCurrency, currencyFormatter, formatMetricValue, getMetricValue, numberFormatter, TAX_COLORS } from './format'
import ChoroplethMap from './ChoroplethMap'
import PersonalCalculator from './PersonalCalculator'

type RevenueViewProps = {
  data: MultiYearPayload
  activeStates: StateRecord[]
  states2023: StateRecord[]
  metric: Metric
  setMetric: (m: Metric) => void
}

export default function RevenueView({ data, activeStates, states2023, metric, setMetric }: RevenueViewProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  const sortedStates = useMemo(() => {
    return [...activeStates].sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
  }, [activeStates, metric])

  const maxMetricValue = useMemo(() => {
    if (sortedStates.length === 0) return 0
    return Math.max(...sortedStates.map((e) => getMetricValue(e, metric)))
  }, [metric, sortedStates])

  const topState = sortedStates[0]

  return (
    <>
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
            {sortedStates.map((entry) => (
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
                            ? (breakdownRaw / entry.population) / entry.perCapitaIncome
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
                            ? `${currencyFormatter.format(breakdownRaw / entry.population)} / resident`
                            : entry.perCapitaIncome > 0
                              ? `${((breakdownRaw / entry.population) / entry.perCapitaIncome * 100).toFixed(2)}% of income`
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
            ))}
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
            getValue={(s) => getMetricValue(s, metric)}
            formatValue={(v) => formatMetricValue(v, metric)}
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
    </>
  )
}
```

- [ ] **Step 7.2: Slim down `App.tsx` to delegate to `RevenueView`**

Replace `src/App.tsx` with a thin shell that:
1. Keeps data loading, `selectedYear`, `view` state (`'revenue' | 'spending'`), `revenueMetric`, `spendingMetric`
2. Keeps hero, summary cards, year toggle, sources panel
3. Renders `RevenueView` or `SpendingView` (import `SpendingView` — it doesn't exist yet, so comment it out for now)

```typescript
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
  const [spendingMetric, setSpendingMetric] = useState<SpendingMetric>('total')

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
```

- [ ] **Step 7.3: Verify build passes**

Run: `npm run build 2>&1 | head -40`

- [ ] **Step 7.4: Run tests**

Run: `npm test -- --run 2>&1 | tail -30`

Expected: All tests pass. The `App.test.tsx` tests for year toggle should still pass since the year toggle is still in `App.tsx`.

Note: `App.test.tsx` tests for bar chart content will still pass since those tests just check for rendered data, not which component renders it.

- [ ] **Step 7.5: Commit**

```bash
git add src/RevenueView.tsx src/App.tsx
git commit -m "refactor: extract RevenueView from App.tsx; add view tab bar and per-view metric state"
```

---

## Chunk 5: SpendingView

### Task 8: Create `SpendingView.tsx` and wire it into `App.tsx`

**Files:**
- Create: `src/SpendingView.tsx`
- Create: `src/SpendingView.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 8.1: Write failing tests for `SpendingView`**

Create `src/SpendingView.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpendingView from './SpendingView'
import type { MultiYearPayload, StateRecord } from './types'

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
  }: {
    geography: { properties: { name: string } }
  }) => <rect data-testid={`geo-${geography.properties.name}`} />,
}))

const mockStates: StateRecord[] = [
  {
    state: 'California',
    population: 39000000,
    totalRevenue: 310000000000,
    perCapitaTotal: 7948,
    perCapitaIncome: 43000,
    breakdown: {},
    spendingTotal: 250000000000,
    spendingBreakdown: {
      education: 80000000000,
      public_welfare: 50000000000,
      health_hospitals: 40000000000,
      highways: 20000000000,
      police_corrections: 15000000000,
      natural_resources: 10000000000,
      other: 35000000000,
    },
  },
  {
    state: 'Texas',
    population: 30000000,
    totalRevenue: 270000000000,
    perCapitaTotal: 9000,
    perCapitaIncome: 34000,
    breakdown: {},
    spendingTotal: 180000000000,
    spendingBreakdown: {
      education: 60000000000,
      public_welfare: 35000000000,
      health_hospitals: 28000000000,
      highways: 18000000000,
      police_corrections: 12000000000,
      natural_resources: 8000000000,
      other: 19000000000,
    },
  },
]

const mockData: MultiYearPayload = {
  metadata: {
    year: 2023,
    yearRange: [2019, 2023],
    currency: 'USD',
    scope: 'state+local',
    topN: 2,
    generatedAt: '2024-01-01T00:00:00.000Z',
  },
  taxTypes: [{ key: 'income_individual', label: 'Individual income' }],
  spendingTypes: [
    { key: 'education', label: 'Education' },
    { key: 'public_welfare', label: 'Public Welfare' },
    { key: 'health_hospitals', label: 'Health & Hospitals' },
    { key: 'highways', label: 'Highways' },
    { key: 'police_corrections', label: 'Police & Corrections' },
    { key: 'natural_resources', label: 'Natural Resources' },
    { key: 'other', label: 'Other' },
  ],
  years: [{ year: 2023, states: mockStates }],
}

const mockDataNoSpending: MultiYearPayload = {
  ...mockData,
  spendingTypes: [],
}

describe('SpendingView', () => {
  it('renders a bar chart sorted by spending total (highest first)', () => {
    render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    const articles = screen.getAllByRole('article')
    expect(articles[0]).toHaveTextContent('California')
    expect(articles[1]).toHaveTextContent('Texas')
  })

  it('renders Total and Per Capita metric toggle buttons', () => {
    render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(screen.getByRole('button', { name: /^total$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /per capita/i })).toBeInTheDocument()
  })

  it('calls setMetric when Per Capita button is clicked', async () => {
    const setMetric = vi.fn()
    render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={setMetric}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /per capita/i }))
    expect(setMetric).toHaveBeenCalledWith('perCapita')
  })

  it('renders a choropleth map', () => {
    const { container } = render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a breakdown table with spending category columns', () => {
    render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Education')).toBeInTheDocument()
    expect(screen.getByText('Highways')).toBeInTheDocument()
  })

  it('shows "no spending data" message when spendingTypes is empty', () => {
    render(
      <SpendingView
        data={mockDataNoSpending}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(screen.getByText(/no spending data/i)).toBeInTheDocument()
  })

  it('shows "no spending data" message when spendingTypes is undefined', () => {
    const dataWithoutSpendingTypes = { ...mockData, spendingTypes: undefined as unknown as [] }
    render(
      <SpendingView
        data={dataWithoutSpendingTypes}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(screen.getByText(/no spending data/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 8.2: Run tests to confirm they fail**

Run: `npm test -- --run src/SpendingView.test.tsx 2>&1 | tail -20`

Expected: FAIL — `SpendingView` module does not exist.

- [ ] **Step 8.3: Create `src/SpendingView.tsx`**

```typescript
import { useMemo, useState } from 'react'
import type { MultiYearPayload, SpendingMetric, StateRecord } from './types'
import { compactCurrency, currencyFormatter, formatSpendingMetricValue, getSpendingMetricValue, numberFormatter, SPENDING_COLORS } from './format'
import ChoroplethMap from './ChoroplethMap'

type SpendingViewProps = {
  data: MultiYearPayload
  activeStates: StateRecord[]
  metric: SpendingMetric
  setMetric: (m: SpendingMetric) => void
}

export default function SpendingView({ data, activeStates, metric, setMetric }: SpendingViewProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  if (!data.spendingTypes || data.spendingTypes.length === 0) {
    return (
      <section className="panel">
        <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
          No spending data available. Run <code>npm run data:refresh</code> to regenerate the dataset.
        </p>
      </section>
    )
  }

  const sortedStates = useMemo(() => {
    return [...activeStates].sort((a, b) => getSpendingMetricValue(b, metric) - getSpendingMetricValue(a, metric))
  }, [activeStates, metric])

  const maxMetricValue = useMemo(() => {
    if (sortedStates.length === 0) return 0
    return Math.max(...sortedStates.map((e) => getSpendingMetricValue(e, metric)))
  }, [metric, sortedStates])

  const topState = sortedStates[0]

  return (
    <>
      <div className="chart-map-row">
        <section className="panel">
          <div className="panel-header">
            <h2>Compare spending across states</h2>
            <div className="metric-toggle" role="group" aria-label="Spending metric toggle">
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
                  <p>{formatSpendingMetricValue(getSpendingMetricValue(entry, metric), metric)}</p>
                </header>
                <div className="bar-track">
                  {data.spendingTypes.map((spendingType) => {
                    const breakdownRaw = entry.spendingBreakdown[spendingType.key] ?? 0
                    const segmentRaw =
                      metric === 'total'
                        ? breakdownRaw
                        : entry.population > 0
                          ? breakdownRaw / entry.population
                          : 0
                    const segmentWidth = maxMetricValue === 0 ? 0 : (segmentRaw / maxMetricValue) * 100
                    return (
                      <div
                        key={spendingType.key}
                        className="bar-segment"
                        style={{ width: `${segmentWidth}%`, background: SPENDING_COLORS[spendingType.key] ?? '#9ca3af' }}
                      />
                    )
                  })}
                </div>
                {hoveredState === entry.state && (
                  <div className="bar-tooltip">
                    {data.spendingTypes.map((spendingType) => {
                      const breakdownRaw = entry.spendingBreakdown[spendingType.key] ?? 0
                      const tooltipValue =
                        metric === 'total'
                          ? compactCurrency(breakdownRaw)
                          : entry.population > 0
                            ? `${currencyFormatter.format(breakdownRaw / entry.population)} / resident`
                            : '—'
                      return (
                        <div key={spendingType.key} className="tooltip-row">
                          <span className="tooltip-swatch" style={{ background: SPENDING_COLORS[spendingType.key] ?? '#9ca3af' }} />
                          <span className="tooltip-label">{spendingType.label}</span>
                          <span className="tooltip-value">{tooltipValue}</span>
                        </div>
                      )
                    })}
                    <div className="tooltip-row tooltip-total">
                      <span className="tooltip-swatch" style={{ background: 'transparent' }} />
                      <span className="tooltip-label">Total</span>
                      <span className="tooltip-value">{formatSpendingMetricValue(getSpendingMetricValue(entry, metric), metric)}</span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="tax-legend">
            {data.spendingTypes.map((spendingType) => (
              <span key={spendingType.key} className="legend-item">
                <span className="legend-swatch" style={{ background: SPENDING_COLORS[spendingType.key] ?? '#9ca3af' }} />
                {spendingType.label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel map-panel-section">
          <h2>Spending by geography</h2>
          <ChoroplethMap
            states={activeStates}
            getValue={(s) => getSpendingMetricValue(s, metric)}
            formatValue={(v) => formatSpendingMetricValue(v, metric)}
          />
        </section>
      </div>

      <section className="panel">
        <h2>Breakout by spending category</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>State</th>
                {data.spendingTypes.map((spendingType) => (
                  <th key={spendingType.key}>{spendingType.label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map((entry) => (
                <tr key={entry.state}>
                  <td>{entry.state}</td>
                  {data.spendingTypes.map((spendingType) => (
                    <td key={spendingType.key}>{compactCurrency(entry.spendingBreakdown[spendingType.key] ?? 0)}</td>
                  ))}
                  <td>{compactCurrency(entry.spendingTotal)}</td>
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
    </>
  )
}
```

- [ ] **Step 8.4: Run `SpendingView` tests to confirm they pass**

Run: `npm test -- --run src/SpendingView.test.tsx 2>&1 | tail -20`

Expected: All 7 tests PASS.

- [ ] **Step 8.5: Wire `SpendingView` into `App.tsx`**

In `src/App.tsx`:

1. Add the import at the top:
```typescript
import SpendingView from './SpendingView'
```

2. Replace the placeholder `<div>` in the `view === 'spending'` branch with:
```typescript
          ) : (
            <SpendingView
              data={data}
              activeStates={activeStates}
              metric={spendingMetric}
              setMetric={setSpendingMetric}
            />
          )}
```

3. Remove the `// SpendingView will be imported in Chunk 5` comment.

- [ ] **Step 8.6: Update `App.test.tsx` to add view tab bar tests**

Add a new `describe` block at the end of `src/App.test.tsx`:

```typescript
describe('App view tab bar', () => {
  it('renders Tax Revenue and Spending tab buttons', async () => {
    render(<App />)
    const viewToggle = await screen.findByRole('group', { name: /view toggle/i })
    const buttons = viewToggle.querySelectorAll('button')
    expect(buttons[0].textContent).toBe('Tax Revenue')
    expect(buttons[1].textContent).toBe('Spending')
  })

  it('defaults to Tax Revenue tab active', async () => {
    render(<App />)
    const revenueBtn = await screen.findByRole('button', { name: /tax revenue/i })
    expect(revenueBtn.className).toContain('active')
  })

  it('switches to Spending view when Spending tab is clicked', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /tax revenue/i })
    await userEvent.click(screen.getByRole('button', { name: /spending/i }))
    expect(screen.getByRole('button', { name: /spending/i }).className).toContain('active')
    expect(screen.getByRole('button', { name: /tax revenue/i }).className).not.toContain('active')
  })
})
```

Note: the existing `testPayload` in `App.test.tsx` already has `spendingTypes` (added in Task 1). The spending view will render normally with that data.

- [ ] **Step 8.7: Run full test suite**

Run: `npm test -- --run 2>&1 | tail -30`

Expected: All tests pass, including the 3 new view tab bar tests.

- [ ] **Step 8.8: Build to confirm no TypeScript errors**

Run: `npm run build 2>&1 | tail -20`

Expected: Build succeeds with no errors.

- [ ] **Step 8.9: Commit**

```bash
git add src/SpendingView.tsx src/SpendingView.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add SpendingView with bar chart, choropleth, and breakdown table; wire tab bar in App"
```
