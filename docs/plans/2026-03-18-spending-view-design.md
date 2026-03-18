# State Spending View — Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Overview

Add a parallel spending analysis view to the app. Users can switch between the existing Tax Revenue dashboard and a new Spending dashboard via a top-level tab bar. The spending view mirrors the revenue view in structure: stacked bar chart, choropleth map, and breakdown table. Data comes from the same Census Bureau Annual Survey of State and Local Government Finances already used for revenue — specifically the same raw `census-tax-source-{year}.json` files, which already contain all 235+ AGG_DESC codes including expenditure rows.

## Navigation

A tab bar sits below the hero section, above the summary cards and year selector:

```
[ Tax Revenue ]  [ Spending ]
```

The year selector remains visible and applies to both views. The `view` state (`'revenue' | 'spending'`) lives in `App.tsx`. Each view owns its own metric state independently — revenue uses `Metric`, spending uses `SpendingMetric` — so no reset is needed on tab switch.

## Data Model

### New type

```ts
// types.ts
export type SpendingMetric = 'total' | 'perCapita'
```

`perCapitaBurden` (spending as % of income) is deliberately omitted — it is not meaningful for government expenditure totals in the same way it is for tax burden, and is out of scope for this feature.

### Extended `StateRecord`

```ts
export type StateRecord = {
  // ... existing fields unchanged ...
  spendingTotal: number                       // total general expenditure, full dollars (converted from Census $thousands, same convention as totalRevenue)
  spendingBreakdown: Record<string, number>   // by spending category key, full dollars
}
```

`population` is already populated for all states and years by the existing revenue pipeline. Per-capita spending is computed inline as `spendingTotal / population` (with a `population > 0` guard returning `0` if missing) — consistent with how bar segment widths are computed inline in the revenue view.

### Extended `MultiYearPayload`

```ts
export type MultiYearPayload = {
  // ... existing fields unchanged ...
  spendingTypes: { key: string; label: string }[]
}
```

`spendingTypes` always contains all 7 entries (the 6 named categories + `other`) regardless of what the raw data yields for a given state/year. Missing category amounts are written as `0`.

### Spending categories

| Key | Label | Census LF codes summed |
|---|---|---|
| `education` | Education | `LF0106` |
| `public_welfare` | Public Welfare | `LF0122` |
| `health_hospitals` | Health & Hospitals | `LF0128` + `LF0131` |
| `highways` | Highways | `LF0140` |
| `police_corrections` | Police & Corrections | `LF0152` + `LF0158` |
| `natural_resources` | Natural Resources | `LF0164` + `LF0167` |
| `other` | Other | `Math.max(0, spendingTotal - sum of above)` |

`spendingTotal` is sourced from `LF0090` (Total General Expenditure — excludes insurance trust, utilities, and liquor stores).

The `other` bucket absorbs financial administration, judicial/legal, fire protection, libraries, interest on debt, and other uncategorized functions. `Math.max(0, ...)` guards against rounding edge cases.

## Data Pipeline

### No change to `download-census-sources.mjs`

The existing `census-tax-source-{year}.json` files already contain all expenditure rows. The Census `timeseries/govs` endpoint returns all AGG_DESC codes; the normalize script currently discards non-tax ones.

### `source-download.config.json`

Add one entry under `normalizedOutputs`:

```json
"spending": "data/raw/state-local-spending-by-function.csv"
```

### `normalize-census-sources.mjs`

Add a new function `normalizeSpendingFromCensusApiRows(rows, config)` alongside the existing `normalizeTaxFromCensusApiRows`. It takes the same Census API row array, extracts rows where `AGG_DESC` is one of:

```
LF0090, LF0106, LF0122, LF0128, LF0131, LF0140, LF0152, LF0158, LF0164, LF0167
```

For each matching row, sums state (GOVTYPE `002`) and local (GOVTYPE `003`) amounts together per state/year/LF code. Returns normalized rows: `{ state, year, lf_code, amount }`.

In `run()`: the spending function is called on the same `allTaxApiRows` array already assembled by the existing per-year loop (no additional file reads needed). The result is written via `writeCsv(config.normalizedOutputs.spending, spendingRows, ['state', 'year', 'lf_code', 'amount'])`.

Logs a warning per missing LF code per state/year but does not fail.

### `ingestion.config.json`

Add under `input`:

```json
"spendingByFunctionCsv": "data/raw/state-local-spending-by-function.csv"
```

Add top-level `spendingCategoryMap` (LF code → category key) and `spendingCategoryLabels` (key → display label), mirroring the existing `taxTypeMap` / `taxTypeLabels` pattern.

### `ingest-state-tax-data.mjs`

Extended to read `spendingByFunctionCsv` and populate `spendingTotal` and `spendingBreakdown` on each `StateRecord` by mapping LF codes to category keys. `spendingTypes` (all 7 entries, always) is written once to the payload root.

All amounts converted from Census `$thousands` to full dollars (×1000), matching the `totalRevenue` convention.

Output file unchanged: `public/data/state-tax-summary-2019-2023.json`.

## UI Architecture

### Summary cards

The "Top state" card is view-aware and tracks the active metric in both views:
- Revenue view: existing behavior (label reflects active `Metric`)
- Spending view: label shows "Top state (Total spend)" or "Top state (Per capita spend)" based on active `SpendingMetric`

### Component changes

**`App.tsx`** (refactored to thin shell)
- Loads data, manages `selectedYear` and `view`
- Renders hero, tab bar, year selector, summary cards (view-aware)
- Delegates to `RevenueView` or `SpendingView` — **`App.tsx` no longer renders `ChoroplethMap` directly**

**`RevenueView.tsx`** (new — extracted from `App.tsx`)
- Contains the bar chart panel, choropleth, breakdown table, and `PersonalCalculator`
- `PersonalCalculator` moves here because it is tax-specific; `states2023` is passed to `RevenueView` solely to feed `PersonalCalculator`
- `hoveredState` / `setHoveredState` are local to this component
- Props: `data: MultiYearPayload`, `activeStates: StateRecord[]`, `states2023: StateRecord[]`, `metric: Metric`, `setMetric: (m: Metric) => void`

**`SpendingView.tsx`** (new)
- Mirrors `RevenueView` structure: bar chart panel (Total / Per Capita toggle), choropleth, breakdown table
- `hoveredState` / `setHoveredState` are local to this component
- Bars sorted high-to-low by `getSpendingMetricValue(state, metric)`
- Props: `data: MultiYearPayload`, `activeStates: StateRecord[]`, `metric: SpendingMetric`, `setMetric: (m: SpendingMetric) => void`
- Renders "no spending data available" if `!data.spendingTypes || data.spendingTypes.length === 0`

**Bar chart rendering in `SpendingView`:**

Bar segment widths follow the same pattern as the revenue view:

```
maxMetricValue = Math.max(...sortedStates.map(s => getSpendingMetricValue(s, metric)))

segmentRaw =
  metric === 'total'
    ? spendingBreakdown[key]
    : state.population > 0 ? spendingBreakdown[key] / state.population : 0

segmentWidth = maxMetricValue === 0 ? 0 : (segmentRaw / maxMetricValue) * 100
```

**Bar chart tooltip in `SpendingView`:**
- Hovered state shows a tooltip with one row per spending category
- `'total'` metric: category value formatted as `compactCurrency(breakdown[key])`
- `'perCapita'` metric: `currencyFormatter.format(breakdown[key] / population) + ' / resident'` (with `population > 0` guard)
- Bottom row: formatted total (`formatSpendingMetricValue(spendingTotal, metric)`)

**`ChoroplethMap.tsx`** (interface change)
- Replace `metric: Metric` prop with two required props:
  - `getValue: (s: StateRecord) => number`
  - `formatValue: (value: number) => string`
- Remove direct imports of `getMetricValue`, `formatMetricValue`, and `Metric` from inside `ChoroplethMap.tsx`
- `colorScale` domain uses `states.map(s => getValue(s))`; tooltip uses `formatValue(value)`
- `RevenueView` constructs these from its local `metric` state using existing helpers
- `SpendingView` passes its own using `getSpendingMetricValue` / `formatSpendingMetricValue`

**`format.ts`** (additions)
- `getSpendingMetricValue(state: StateRecord, metric: SpendingMetric): number`
  - `'total'` → `state.spendingTotal`
  - `'perCapita'` → `state.population > 0 ? state.spendingTotal / state.population : 0`
- `formatSpendingMetricValue(value: number, metric: SpendingMetric): string`
  - `'total'` → `compactCurrency(value)`
  - `'perCapita'` → `currencyFormatter.format(value) + ' / resident'`
- `SPENDING_COLORS: Record<string, string>` — color palette for the 7 spending categories, distinct from `TAX_COLORS`
- `compactCurrency` extended: add `>= 1e12` branch returning `$X.XT` before the existing `>= 1e9` branch. Current code: `if (dollars >= 1e9) ... if (dollars >= 1e6) ...`; new code prepends `if (dollars >= 1e12) return \`$${(dollars / 1e12).toFixed(1)}T\``

## Error Handling

- JSON predates spending data (`spendingTypes` is `undefined` or empty array): `SpendingView` renders "no spending data available"
- Missing per-state values: `spendingBreakdown[key] ?? 0` throughout
- Zero population: `getSpendingMetricValue` returns `0` for per-capita when `population === 0`
- Negative `other` bucket: `Math.max(0, ...)` guard in ingest script, with warning log

## Testing

- `format.test.ts` — unit tests for `getSpendingMetricValue` (including `population === 0` case), `formatSpendingMetricValue`, and `compactCurrency` with trillion-range values
- `SpendingView.test.tsx` — renders correctly with mock spending data; renders "no data" state when `spendingTypes` is undefined or empty
