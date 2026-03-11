# Multi-Year Historical Trends — Design Doc

**Date:** 2026-03-10
**Feature:** Feature 5 — Multi-year historical trends (2019–2023)

---

## Goal

Extend the existing bar chart and choropleth map to support historical data across five years (2019–2023). Users switch years via a toggle row; all panels except the Personal Calculator update to reflect the selected year.

---

## Architecture

### Approach

Single combined JSON file (`public/data/state-tax-summary-2019-2023.json`) containing all five years. App.tsx loads it once on mount and filters to the selected year in memory. No lazy loading, no extra fetches — file size is negligible (~50KB uncompressed).

---

## Data Pipeline

Three existing scripts are modified; no new scripts added.

### `scripts/download-census-sources.mjs`
- Add `YEARS = [2019, 2020, 2021, 2022, 2023]` constant.
- Loop over years to download:
  - **Census Annual Survey tax data** — one request per year (`time=YYYY` query param)
  - **ACS per-capita income** — one request per year (`/data/YYYY/acs/acs1` endpoint)
- **Population CSV** — single download (NST-EST2023-ALLDATA.csv already contains all years).

### `scripts/normalize-census-sources.mjs`
- Already preserves `year` in tax and population CSVs.
- Minor: ensure all 5 years flow through without being filtered to a single year.

### `scripts/ingest-state-tax-data.mjs`
- After merging tax + population + income, group records by year.
- Output structure changes from flat `states` array to `years` array (see Schema below).
- Output file: `public/data/state-tax-summary-2019-2023.json`

### Pipeline command
`npm run data:refresh` — unchanged entry point, updated output.

---

## Schema

`StateRecord` is unchanged. `DataPayload` is replaced by `MultiYearPayload` in `src/types.ts`:

```typescript
type MultiYearPayload = {
  metadata: {
    year: number              // most recent year (2023)
    yearRange: [number, number]  // [2019, 2023]
    currency: string
    scope: string
    topN: number
    generatedAt?: string
    notes?: string[]
  }
  taxTypes: TaxType[]
  years: Array<{
    year: number
    states: StateRecord[]
  }>
}
```

### Sample file
`public/data/state-tax-summary-sample.json` is updated to the new schema (one entry in `years` with 2023 data only), so the App.tsx fallback path works without special-casing.

---

## UI

All changes confined to `src/App.tsx`. No new components. No new CSS.

### `selectedYear` state
- Default: `2023`
- Derives active states: `data.years.find(y => y.year === selectedYear)?.states ?? []`

### Year toggle
- Placed above the chart-map row.
- Reuses existing `.metric-toggle` button styles.
- Buttons: `2019 | 2020 | 2021 | 2022 | 2023` — active year highlighted.

### Panel behavior by year toggle

| Panel | Responds to year toggle |
|---|---|
| Summary cards | Yes |
| Bar chart | Yes |
| Choropleth map | Yes |
| Breakdown table | Yes |
| Personal Calculator | **No** — always uses 2023 static rates |

### Personal Calculator
Receives `data.years.find(y => y.year === 2023)?.states` — always pinned to 2023 regardless of `selectedYear`.

---

## Testing

- **Pipeline tests**: validate that all 5 years are present in the output JSON; validate `StateRecord` shape per year.
- **UI tests**: year toggle renders 5 buttons; selecting a year updates the displayed data.
- **Existing tests**: all 40 passing tests must continue to pass.

---

## Out of Scope

- Trend line / sparkline charts (future visual design pass)
- Year-over-year delta indicators
- Animated transitions between years
- Personal Calculator historical rates
