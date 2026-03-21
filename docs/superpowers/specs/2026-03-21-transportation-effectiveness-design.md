# Transportation Effectiveness Design

**Goal:** Add a new "Transportation" tab showing state highway spending per capita alongside Reason Foundation highway performance rankings for all 50 states.

---

## Data Sources

### Reason Foundation 29th Annual Highway Report

Pre-downloaded CSV at `data/raw/downloads/29th Annual Highway Report - Reason Foundation.csv`. Based on 2023 state highway data submitted to the federal government, supplemented by National Bridge Inventory data and INRIX congestion data.

**Columns in the CSV:**
```
State, Overall, Capital & Bridge Disbursements Ratio, Maintenance Disbursements Ratio,
Admin Disbursements Ratio, Other Disbursements Ratio, Rural Interstate Pavement Condition,
Urban Interstate Pavement Condition, Rural Arterial Pavement Condition,
Urban Arterial Pavement Condition, Urbanized Area Congestion,
Structurally Deficient Bridges, Rural Fatality Rate, Urban Fatality Rate, Other Fatality Rate
```

All values are **rankings** (1 = best in the country, 50 = worst). 51 rows total (header + 50 states).

**Aggregation:** The 14 raw columns are collapsed into 5 metrics:
- `overall_rank` — "Overall" column directly
- `pavement_rank` — `round(mean(Rural Interstate, Urban Interstate, Rural Arterial, Urban Arterial))`
- `bridge_rank` — "Structurally Deficient Bridges" column directly
- `congestion_rank` — "Urbanized Area Congestion" column directly
- `fatality_rank` — `round(mean(Rural Fatality Rate, Urban Fatality Rate, Other Fatality Rate))`

**Year note:** This is a single snapshot (2023 data). The same rankings are applied to all years in the dataset; the UI locks the Transportation tab to 2023.

**Spending metric:** Highway spending per capita is computed in the view from existing `spendingBreakdown.highways` (stored in thousands of dollars) and `population`: `(spendingBreakdown.highways * 1000) / population`. No new StateRecord field needed.

---

## New StateRecord Fields

Add to `src/types.ts` after the education effectiveness fields:

```typescript
// Transportation effectiveness (from Reason Foundation 29th Annual Highway Report)
reasonOverallRank: number      // 1 = best, 50 = worst; 0 if not ingested
reasonPavementRank: number     // avg of 4 pavement sub-rankings, rounded; 0 if not ingested
reasonBridgeRank: number       // Structurally Deficient Bridges ranking; 0 if not ingested
reasonCongestionRank: number   // Urbanized Area Congestion ranking; 0 if not ingested
reasonFatalityRank: number     // avg of 3 fatality rate sub-rankings, rounded; 0 if not ingested
```

All five fields default to `0` if not ingested.

---

## Pipeline Changes

### `data/config/source-download.config.json`

Add to `normalizedOutputs`:
```json
"reasonHighway": "data/raw/reason-highway-report.csv"
```

No new `downloads` entry — the file is already in `data/raw/downloads/` and will not be re-downloaded. The `normalizedOutputs` entry is informational (documents where the normalize script writes its output) and does not drive runtime behavior — the output path is used directly in the normalize script.

### `scripts/normalize-census-sources.mjs`

Add **`normalizeReasonHighway(config)`**:
- Reads `data/raw/downloads/29th Annual Highway Report - Reason Foundation.csv` using Papa.parse with `header: true`
- For each of the 50 state rows, computes the 5 aggregated metrics as described above
- Writes `data/raw/reason-highway-report.csv` with columns: `state, overall_rank, pavement_rank, bridge_rank, congestion_rank, fatality_rank`
- If the file is missing, warns non-fatally and returns an empty array (same pattern as F-33/NAEP)
- Call `normalizeReasonHighway(config)` from the `run()` function and log the row count

### `data/config/ingestion.config.json`

Add to `input`:
```json
"reasonHighwayCsv": "data/raw/reason-highway-report.csv"
```

### `scripts/ingest-state-tax-data.mjs`

- Read `reasonHighwayCsv` gracefully (non-fatal if missing — same pattern as `f33Csv`/`naepCsv`)
- Build a lookup map keyed by state name: `Map<string, { overall_rank, pavement_rank, bridge_rank, congestion_rank, fatality_rank }>`
- Since the Reason Foundation data has no year column (it's a single snapshot), apply the same rankings to all years
- Populate the 5 new fields in the state record mapping; default each to `0` if no row found

---

## Frontend Changes

### `src/types.ts`

Add 5 fields to `StateRecord` as described above.

### `src/TransportationView.tsx` (new component)

Props: `activeStates: StateRecord[]`

**Toggle metrics** (type `TransportMetric`):
```typescript
type TransportMetric = 'overall' | 'pavement' | 'bridge' | 'congestion' | 'fatality'
```

**Helper to get rank value:**
```typescript
const getRank = (s: StateRecord, metric: TransportMetric): number => {
  switch (metric) {
    case 'overall': return s.reasonOverallRank
    case 'pavement': return s.reasonPavementRank
    case 'bridge': return s.reasonBridgeRank
    case 'congestion': return s.reasonCongestionRank
    case 'fatality': return s.reasonFatalityRank
  }
}
```

**Helper to compute highway spending per capita:**
```typescript
const getSpendingPerCapita = (s: StateRecord): number =>
  s.population > 0 ? Math.round((s.spendingBreakdown.highways * 1000) / s.population) : 0
```

**Structure:**

1. **Scatter plot panel** — SVG-based using `d3-scale`, same dimensions as `EducationView` (`SVG_W=680`, `SVG_H=260`, same margins).
   - X axis: highway spending per capita (dollars)
   - Y axis: selected rank, **inverted** — domain `[51, 1]` mapped to range `[PLOT_H, 0]` so rank 1 appears at the top and rank 50 at the bottom. Domain starts at 51 (not 50) and ends at 1 (not 0) to keep the sentinel value 0 ("no data") off the visible plot area and ensure tick labels only show valid ranks.
   - Y axis label changes with toggle: "Overall Rank" / "Pavement Rank" / "Bridge Rank" / "Congestion Rank" / "Fatality Rate Rank"
   - Toggle buttons: "Overall" | "Pavement" | "Bridges" | "Congestion" | "Fatality Rate"
   - Each state: `circle` (r=5, fill `#3b82f6`, opacity 0.75) + state abbreviation label (`#6b7280`, fontSize 9)
   - Hover tooltip (fixed position): state name, spending per capita formatted as currency, selected rank
   - `plotStates` filtered to states where `getSpendingPerCapita(s) > 0 && getRank(s, metric) > 0`
   - Fallback: if `reasonOverallRank === 0` for all states, show "Run `npm run data:refresh` to load transportation data."

2. **Ranked table panel** — all 50 states
   - Columns: State | $/Capita (Highways) | Overall | Pavement | Bridges | Congestion | Fatality Rate
   - Default sort: Overall rank **ascending** (rank 1 = best at top — note: opposite default direction from EducationView which defaults descending)
   - Click any column header to re-sort; clicking the active column toggles asc/desc
   - States with rank `0` (no data) sort to the bottom regardless of direction
   - Footnote: "Rankings from the Reason Foundation 29th Annual Highway Report (2026), based on 2023 state highway data."

**Color scheme:** Same light-theme colors as `EducationView` — panel background is white (`className="panel"`), state names `#1a2744`, data values `#374151`, active sort column `#d97706`, alternating row background `#f9fafb`, borders `#e5e7eb`.

**State abbreviations:** Duplicate the `STATE_ABBREVS` map from `EducationView` (do not extract to a shared module — YAGNI).

### `App.tsx`

- Add `'transportation'` to the `View` type
- Add Transportation as the **6th tab** (between Spending and Education)
- Tab tooltip: `"State highway spending per capita vs. Reason Foundation highway performance rankings — shows which states get the most from their transportation dollars."`
- Year lock: same pattern as Education — `useEffect` auto-selects 2023 when `view === 'transportation'`, year toggle hidden when `view === 'transportation'`. The existing year-toggle guard `view !== 'education'` must be updated to `view !== 'education' && view !== 'transportation'`.
- Top state card for Transportation view: state with the lowest (best) `reasonOverallRank` among `activeStates` (filter to `> 0` first, then sort ascending), label "Best overall rank". Use `activeStates` (same as all other views), not `states2023`.

### `src/App.test.tsx`

- Add test: Transportation tab is the 6th button in the view toggle
- Add test: year toggle hidden and year auto-set to 2023 when Transportation tab is active
- Add 5 zeroed fields to all mock `StateRecord` objects

### `src/TransportationView.test.tsx` (new)

Tests:
- Renders scatter plot SVG when `reasonOverallRank > 0`
- Renders all 5 toggle buttons: Overall, Pavement, Bridges, Congestion, Fatality Rate
- Clicking a toggle button switches the Y axis metric
- Renders ranked table with correct column headers (State, $/Capita, Overall, Pavement, Bridges, Congestion, Fatality Rate)
- Table sorted by Overall rank ascending by default (rank 1 first)
- Clicking a column header re-sorts
- Shows fallback message when all `reasonOverallRank` values are 0

### All test files with `StateRecord` mocks

Add zeroed values for the 5 new fields to every mock `StateRecord` in:
- `src/format.test.ts`
- `src/App.test.tsx`
- `src/TotalRevenueView.test.tsx`
- `src/OwnSourceView.test.tsx`
- `src/SpendingView.test.tsx`
- `src/ChoroplethMap.test.tsx`
- `src/PersonalCalculator.test.tsx`
- `src/FederalGrantsView.test.tsx`
- `src/EducationView.test.tsx`

---

## What Does Not Change

- Existing `spendingBreakdown.highways` field (LF0140) — used as-is, not modified
- The Education tab — no changes
- All other tabs — no changes
- No new npm dependencies
