# Revenue Views Expansion — Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Overview

Add three new views to the app alongside the existing Tax Revenue and Spending tabs. The tab bar expands from 2 to 5 tabs, ordered as a left-to-right narrative: where the money comes from → where it goes.

```
[ Total Revenue ]  [ Federal Grants ]  [ Tax Revenue ]  [ Non-Federal Revenue ]  [ Spending ]
```

Data for all new views comes from the same Census Bureau `timeseries/govs` raw files already downloaded — specifically LF codes for revenue categories currently discarded by the normalize script.

---

## Navigation

The `view` state in `App.tsx` expands:

```ts
type View = 'totalRevenue' | 'federalGrants' | 'revenue' | 'ownSource' | 'spending'
```

The tab bar renders all five buttons in story order. Each view owns its own metric state independently (no reset on tab switch). Default view on load remains `'revenue'` (Tax Revenue) to preserve existing behavior.

---

## Data Model

### New fields on `StateRecord`

```ts
export type StateRecord = {
  // ...existing fields unchanged...
  federalGrants: number      // LF0004, full dollars (Census $thousands × 1000)
  chargesFees: number        // LF0040, full dollars
  trustUtility: number       // LF0074 + LF0068 combined, full dollars
  miscRevenue: number        // LF0058, full dollars
  totalRevenueFull: number   // LF0001, full dollars (authoritative Census total)
}
```

`ownSourceTotal` is never stored — always computed inline as `Math.max(0, s.totalRevenueFull - s.federalGrants)`. The `Math.max(0, …)` guard handles any rounding edge cases where LF codes don't sum perfectly.

All amounts: Census reports in $thousands; pipeline multiplies by 1000, matching the existing `totalRevenue` convention.

### New type

```ts
// Add to types.ts first, then replace SpendingMetric body with alias:
export type SimpleMetric = 'total' | 'perCapita'
export type SpendingMetric = SimpleMetric   // was: 'total' | 'perCapita' — identical at runtime
```

Step order matters: declare `SimpleMetric` first, then change `SpendingMetric` to reference it. No behavior change in `SpendingView` or its helpers.

### `MultiYearPayload`

No new top-level fields required. The five new `StateRecord` fields are sufficient; there are no new category-label arrays (unlike `spendingTypes`).

---

## Revenue Buckets

### Total Revenue — 5 segments

| Key | Label | Census code(s) | `StateRecord` field | Color |
|---|---|---|---|---|
| `taxes` | Taxes | sum of existing tax breakdown | `state.totalRevenue` | `#1a2744` (navy) |
| `federalGrants` | Federal Grants | `LF0004` | `state.federalGrants` | `#d97706` (amber) |
| `chargesFees` | Charges & Fees | `LF0040` | `state.chargesFees` | `#059669` (green) |
| `trustUtility` | Trust & Utility | `LF0074` + `LF0068` | `state.trustUtility` | `#7c3aed` (purple) |
| `misc` | Misc | `LF0058` | `state.miscRevenue` | `#9ca3af` (gray) |

Note: the color map key is `misc` but the `StateRecord` field is `miscRevenue`. Implementations must map between them explicitly (see format.ts section).

### Non-Federal Revenue — 4 segments

Same as Total Revenue minus the `federalGrants` segment. Total value = `Math.max(0, state.totalRevenueFull - state.federalGrants)`.

| Key | Label | `StateRecord` field | Color |
|---|---|---|---|
| `taxes` | Taxes | `state.totalRevenue` | `#1a2744` |
| `chargesFees` | Charges & Fees | `state.chargesFees` | `#059669` |
| `trustUtility` | Trust & Utility | `state.trustUtility` | `#7c3aed` |
| `misc` | Misc | `state.miscRevenue` | `#9ca3af` |

### Federal Grants — no segments

Single solid amber bar (`#d97706`). No sub-categories in this release (federal grants breakdown by function is deferred to a future feature).

---

## Data Pipeline

### No change to `download-census-sources.mjs`

The existing `census-tax-source-{year}.json` downloads already contain all LF revenue codes.

### `normalize-census-sources.mjs`

Add new function `normalizeRevenueExtendedFromCensusApiRows(rows)` alongside the existing tax and spending normalizers.

Extracts rows where `AGG_DESC` is one of:

```
LF0001, LF0004, LF0040, LF0058, LF0068, LF0074
```

For each matching row, sums state (GOVTYPE `002`) and local (GOVTYPE `003`) amounts per state/year/LF code. Returns rows: `{ state, year, lf_code, amount }`.

Called on the same `allTaxApiRows` array already assembled by the per-year loop — no additional file reads.

In `run()`, wire the output:

```js
const normalizedRevenueExtendedRows = taxRowsLookLikeCensusApi
  ? normalizeRevenueExtendedFromCensusApiRows(allTaxApiRows)
  : []

// ...after existing writeCsv calls:
const revenueExtendedOutput = await writeCsv(
  config.normalizedOutputs.revenueExtended,
  normalizedRevenueExtendedRows,
  ['state', 'year', 'lf_code', 'amount']
)
console.log(`Normalized revenue-extended rows: ${normalizedRevenueExtendedRows.length} -> ${path.relative(projectRoot, revenueExtendedOutput)}`)
```

Logs a warning per missing LF code per state/year but does not fail.

### `source-download.config.json`

Add one entry under `normalizedOutputs`:

```json
"revenueExtended": "data/raw/state-local-revenue-extended.csv"
```

### `ingestion.config.json`

Add under `input`:

```json
"revenueExtendedCsv": "data/raw/state-local-revenue-extended.csv"
```

Add top-level `revenueExtendedLfMap`. The values here are **ingest-script-internal labels only** — they are not `StateRecord` field names. The ingest script uses them as intermediate buckets before combining into the final fields:

```json
"revenueExtendedLfMap": {
  "LF0001": "totalRevenueFull",
  "LF0004": "federalGrants",
  "LF0040": "chargesFees",
  "LF0058": "miscRevenue",
  "LF0068": "_utilityRevenue",
  "LF0074": "_trustRevenue"
}
```

`_utilityRevenue` and `_trustRevenue` (prefixed with `_` to mark as internal) are summed together in the ingest script into `state.trustUtility = _trustRevenue + _utilityRevenue`. Neither appears on `StateRecord`. The other four map values (`totalRevenueFull`, `federalGrants`, `chargesFees`, `miscRevenue`) happen to match `StateRecord` field names, but they are still resolved through the same intermediate step — do not skip the combine step for any code, including those four.

### `ingest-state-tax-data.mjs`

Extended to read `revenueExtendedCsv` and populate the five new `StateRecord` fields per state/year:

- `totalRevenueFull` ← `LF0001` × 1000
- `federalGrants` ← `LF0004` × 1000
- `chargesFees` ← `LF0040` × 1000
- `miscRevenue` ← `LF0058` × 1000
- `trustUtility` ← (`LF0074` + `LF0068`) × 1000

Missing LF codes default to `0`. A warning is logged per missing code per state/year.

All five new fields are rounded to the nearest integer (`Math.round`) after the `×1000` conversion, consistent with the existing `totalRevenue` and `spendingTotal` convention. This prevents floating-point drift from appearing in the UI or in the `ownSourceTotal` subtraction.

Output file unchanged: `public/data/state-tax-summary-2019-2023.json`.

---

## UI Architecture

### `format.ts` additions

```ts
// Bucket color map. Note: key 'misc' maps to StateRecord field 'miscRevenue'.
// Callers use the key for color lookup and the field name to read the value.
export const REVENUE_BUCKET_COLORS: Record<string, string> = {
  taxes:        '#1a2744',
  federalGrants:'#d97706',
  chargesFees:  '#059669',
  trustUtility: '#7c3aed',
  misc:         '#9ca3af',
}

// Single helper — takes a pre-computed dollar value (not a StateRecord field).
// Callers pass the appropriate total for their view (totalRevenueFull, federalGrants, ownSourceTotal, etc.)
export function getSimpleMetricValue(
  rawValue: number,
  metric: SimpleMetric,
  population: number
): number
// 'total'    → rawValue
// 'perCapita' → population > 0 ? rawValue / population : 0

export function formatSimpleMetricValue(value: number, metric: SimpleMetric): string
// 'total'    → compactCurrency(value)
// 'perCapita' → currencyFormatter.format(value) + ' / resident'
```

### Sort order (all three new views)

States are sorted high-to-low by the **active metric value** of their view's primary total — consistent with `RevenueView` and `SpendingView`. For example, `TotalRevenueView` sorts by `getSimpleMetricValue(s.totalRevenueFull, metric, s.population)`.

### "Top state" summary card labels

The existing card shows "Top state (label)" where label is metric-dependent. For the three new views:

| View | Label (total metric) | Label (perCapita metric) |
|---|---|---|
| Total Revenue | `Total revenue` | `Per capita revenue` |
| Federal Grants | `Total grants` | `Per capita grants` |
| Non-Federal Revenue | `Total non-federal` | `Per capita non-federal` |

### `PersonalCalculator`

None of the three new views include `PersonalCalculator`. It remains exclusive to `RevenueView` (Tax Revenue tab) as it is specific to estimating individual tax burden.

### `TotalRevenueView.tsx` (new)

Mirrors `RevenueView` structure: metric toggle, bar chart, choropleth map, breakdown table, color legend. No `PersonalCalculator`.

**Props:** `data: MultiYearPayload`, `activeStates: StateRecord[]`, `metric: SimpleMetric`, `setMetric: (m: SimpleMetric) => void`

**Bar segments:** 5 buckets. Segment values read directly from `StateRecord` fields (see Revenue Buckets table above).

**Bar segment widths:**
```
viewTotal(s) = s.totalRevenueFull
maxValue = Math.max(...sortedStates.map(s => getSimpleMetricValue(viewTotal(s), metric, s.population)))

segmentRaw =
  metric === 'total'
    ? bucketValue
    : s.population > 0 ? bucketValue / s.population : 0

segmentWidth = maxValue === 0 ? 0 : (segmentRaw / maxValue) * 100
```

**Choropleth:**
```ts
getValue = s => getSimpleMetricValue(s.totalRevenueFull, metric, s.population)
formatValue = v => formatSimpleMetricValue(v, metric)
```

**Breakdown table:** one row per state, one column per bucket key + total. Values formatted with `formatSimpleMetricValue`. Note: unlike `RevenueView`'s breakdown table (which uses `compactCurrency` unconditionally), this table is metric-aware — per-capita view shows per-capita values in every cell.

**Color legend:** renders below bar chart, same pattern as `RevenueView`'s `tax-legend` div. One swatch + label per bucket.

**"No data" guard:** renders a notice if `data.years` has no year where any state has `totalRevenueFull > 0`. Do not check `activeStates[0]` (unsorted); instead check whether the current year's data has been ingested by verifying `activeStates.some(s => s.totalRevenueFull > 0)`.

### `FederalGrantsView.tsx` (new)

Simpler than the others — single-color bars, no segments, no breakdown table, no color legend.

**Props:** `data: MultiYearPayload`, `activeStates: StateRecord[]`, `metric: SimpleMetric`, `setMetric: (m: SimpleMetric) => void`

**Bar:** single solid amber block. Width proportional to `getSimpleMetricValue(s.federalGrants, metric, s.population)` over max.

**Tooltip:** state name + `formatSimpleMetricValue(value, metric)`.

**Choropleth:**
```ts
getValue = s => getSimpleMetricValue(s.federalGrants, metric, s.population)
formatValue = v => formatSimpleMetricValue(v, metric)
```

**No breakdown table, no color legend.**

**Bar DOM structure:** reuse the same `bar-row` article / `bar-track` div / `bar-segment` div pattern from the existing views, with a single segment spanning the full metric width. The `bar-tooltip` div shows state name and formatted value on hover. This keeps `FederalGrantsView` visually consistent without custom bar markup.

**"No data" guard:** `!activeStates.some(s => s.federalGrants > 0)` — same pattern as `TotalRevenueView`.

### `OwnSourceView.tsx` (new)

Mirrors `TotalRevenueView` with 4 segments (no `federalGrants` bucket).

**Props:** `data: MultiYearPayload`, `activeStates: StateRecord[]`, `metric: SimpleMetric`, `setMetric: (m: SimpleMetric) => void`

**Per-state total:**
```ts
const ownSourceTotal = (s: StateRecord) => Math.max(0, s.totalRevenueFull - s.federalGrants)
```

**Choropleth:**
```ts
getValue = s => getSimpleMetricValue(ownSourceTotal(s), metric, s.population)
formatValue = v => formatSimpleMetricValue(v, metric)
```

**Breakdown table:** 4 bucket columns + total. Values formatted with `formatSimpleMetricValue`. Metric-aware (same as `TotalRevenueView` — unlike `RevenueView`'s table).

**Color legend:** 4 swatches (no amber Federal Grants entry).

**"No data" guard:** `!activeStates.some(s => Math.max(0, s.totalRevenueFull - s.federalGrants) > 0)` — checks own-source total directly rather than `totalRevenueFull` as a proxy.

### `App.tsx` changes

- Expand `view` type to `'totalRevenue' | 'federalGrants' | 'revenue' | 'ownSource' | 'spending'`
- Add `SimpleMetric` metric states: `totalRevenueMetric`, `federalGrantsMetric`, `ownSourceMetric` (each initialized to `'total'`)
- Render 5-button tab bar in story order
- Update "Top state" summary card label using the table above
- Render the appropriate view component based on `view`

**`topStateName` / `topStateLabel` useMemo must handle all five views.** The existing else-branch falls through to spending for any non-revenue view. With five views this breaks. The useMemo must branch explicitly on all five values:

```ts
const { topStateName, topStateLabel } = useMemo(() => {
  if (!activeStates.length) return { topStateName: '—', topStateLabel: '' }
  switch (view) {
    case 'revenue': {
      const sorted = [...activeStates].sort((a, b) => getMetricValue(b, revenueMetric) - getMetricValue(a, revenueMetric))
      const label = revenueMetric === 'total' ? 'Total' : revenueMetric === 'perCapita' ? 'Per capita' : '% of income'
      return { topStateName: sorted[0]?.state ?? '—', topStateLabel: label }
    }
    case 'spending': {
      const sorted = [...activeStates].sort((a, b) => getSpendingMetricValue(b, spendingMetric) - getSpendingMetricValue(a, spendingMetric))
      const label = spendingMetric === 'total' ? 'Total spend' : 'Per capita spend'
      return { topStateName: sorted[0]?.state ?? '—', topStateLabel: label }
    }
    case 'totalRevenue': {
      const sorted = [...activeStates].sort((a, b) => getSimpleMetricValue(b.totalRevenueFull, totalRevenueMetric, b.population) - getSimpleMetricValue(a.totalRevenueFull, totalRevenueMetric, a.population))
      const label = totalRevenueMetric === 'total' ? 'Total revenue' : 'Per capita revenue'
      return { topStateName: sorted[0]?.state ?? '—', topStateLabel: label }
    }
    case 'federalGrants': {
      const sorted = [...activeStates].sort((a, b) => getSimpleMetricValue(b.federalGrants, federalGrantsMetric, b.population) - getSimpleMetricValue(a.federalGrants, federalGrantsMetric, a.population))
      const label = federalGrantsMetric === 'total' ? 'Total grants' : 'Per capita grants'
      return { topStateName: sorted[0]?.state ?? '—', topStateLabel: label }
    }
    case 'ownSource': {
      const sorted = [...activeStates].sort((a, b) => getSimpleMetricValue(Math.max(0, b.totalRevenueFull - b.federalGrants), ownSourceMetric, b.population) - getSimpleMetricValue(Math.max(0, a.totalRevenueFull - a.federalGrants), ownSourceMetric, a.population))
      const label = ownSourceMetric === 'total' ? 'Total non-federal' : 'Per capita non-federal'
      return { topStateName: sorted[0]?.state ?? '—', topStateLabel: label }
    }
  }
}, [activeStates, view, revenueMetric, spendingMetric, totalRevenueMetric, federalGrantsMetric, ownSourceMetric])
```

### `ChoroplethMap.tsx`

No changes — the existing `getValue`/`formatValue` callback interface already supports the new views.

---

## Error Handling

- `!activeStates.some(s => s.totalRevenueFull > 0)`: all new views (except `FederalGrantsView` which checks `federalGrants`) render a notice: "No extended revenue data available. Re-run `npm run data:ingest` after updating the pipeline."
- Missing LF codes: default to `0`; ingest logs a warning per missing code per state/year
- `population === 0`: `getSimpleMetricValue` returns `0` for per-capita
- Negative `ownSourceTotal`: `Math.max(0, …)` guard applied at every call site

---

## Testing

- `format.test.ts`: unit tests for `getSimpleMetricValue` (including `population === 0` and `metric === 'perCapita'`) and `formatSimpleMetricValue`
- `TotalRevenueView.test.tsx`: renders bar segments and table with mock data; renders "no data" notice when `totalRevenueFull === 0` for all states
- `FederalGrantsView.test.tsx`: renders single-color bars; renders "no data" when `federalGrants === 0` for all states
- `OwnSourceView.test.tsx`: renders 4 segments; own-source total computed as `totalRevenueFull - federalGrants` with `Math.max(0, …)` guard

---

## Out of Scope

- Federal grants breakdown by function (Medicaid, Education, Transportation, etc.) — deferred; see future feature backlog
- Burden (% of income) metric for new views — not meaningful when including federal transfers and insurance trust flows
- Liquor store revenue (`LF0073`) — omitted; included in `totalRevenueFull` via LF0001 but not broken out separately
