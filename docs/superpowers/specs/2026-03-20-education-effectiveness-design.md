# Education Effectiveness Design

**Goal:** Add a new "Education" tab showing K-12 spending per student alongside NAEP achievement scores (4th grade reading, 8th grade math) for all 50 states.

---

## Data Sources

### Census F-33 Survey (K-12 per-pupil spending)

Annual Survey of Public Elementary-Secondary School System Finances. One fixed-width CSV file per year, ~14k rows of district-level data.

Download URLs (direct HTTP, no auth required):
```
https://www2.census.gov/programs-surveys/school-finances/tables/{year}/secondary-education-finance/elsec{yy}t.txt
```
Where `{yy}` is the 2-digit year (e.g. `22` for 2022). Available for years 2019–2023.

**Aggregation:** Sum `ENROLL` and `TOTALEXP` (in thousands) by state FIPS code (`FIPST`) across all district rows. Per-pupil spending = `(TOTALEXP * 1000) / ENROLL` (full dollars).

**Key columns:** `FIPST` (2-digit state FIPS), `ENROLL` (student enrollment), `TOTALEXP` (total expenditure in thousands).

**Fiscal year note:** The F-33 "2022" file covers school year 2021–22; "2023" covers 2022–23. This lag is noted in the UI footnote but does not affect the data model.

**Scope:** K-12 public schools only. This is intentionally narrower than the existing `spendingBreakdown.education` field (Census LF0106), which includes higher education. These are separate fields and should not be compared directly.

### NAEP NDEDataService API (achievement scores)

Nation's Report Card state-level average scale scores. No API key required.

Endpoint:
```
https://www.nationsreportcard.gov/NDEDataService/ChartHandler.aspx?type=sp_state_map_datatable&subject={SUBJECT}&year={YEAR}R3&cohort={COHORT}
```

Parameters:
- `subject`: `RED` (reading) or `MAT` (mathematics)
- `year`: `2019` or `2022` (biennial; 2020, 2021, 2023 not available)
- `cohort`: `1` (grade 4) or `2` (grade 8)

Returns JSON; state scores are in `result.StateMap_DataTableData.Statedata[].MN` (average scale score, 0–500 range).

**Available years:** 2019 and 2022 only. NAEP is biennial and was paused during COVID. No 2020, 2021, or 2023 data exists.

**4 API calls total:** reading/math × 2019/2022.

---

## New StateRecord Fields

Add to `src/types.ts` after existing extended revenue fields:

```typescript
// Education effectiveness (K-12 only; from Census F-33 and NAEP)
educationPerPupil: number    // K-12 per-pupil expenditure in dollars (0 if not ingested)
naepGrade4Reading: number    // NAEP 4th grade reading score, ~200–240 range (0 if no data for year)
naepGrade8Math: number       // NAEP 8th grade math score, ~255–290 range (0 if no data for year)
```

All three fields default to `0` if the corresponding data is unavailable for a given state/year.

---

## Pipeline Changes

### `data/config/source-download.config.json`

Add to `sources`:
```json
"f33": {
  "description": "Census F-33 K-12 finance data — district-level enrollment and expenditure by state",
  "urlTemplate": "https://www2.census.gov/programs-surveys/school-finances/tables/{year}/secondary-education-finance/elsec{yy}t.txt",
  "note": "yy is 2-digit year suffix: 2019→19, 2020→20, ..., 2023→23"
}
```

Add to `downloads`:
```json
"f33ByYear": "data/raw/downloads/census-f33-{year}.txt"
```

Add to `normalizedOutputs`:
```json
"f33": "data/raw/education-per-pupil.csv",
"naep": "data/raw/naep-scores.csv"
```

### `scripts/download-census-sources.mjs`

Add F-33 download loop (one file per year, skip if already downloaded — same pattern as Individual Unit Files). The URL `{yy}` suffix is derived from the last 2 digits of the year (e.g. `2022` → `22`).

### `scripts/normalize-census-sources.mjs`

**`normalizeF33(config)`** — reads each `census-f33-{year}.txt`, parses CSV, aggregates `ENROLL` and `TOTALEXP` by `FIPST` (filtering to valid state FIPS codes via a `FIPS_TO_STATE` map — same map already added for Individual Unit Files), computes `per_pupil = round((TOTALEXP * 1000) / ENROLL)`. Writes `data/raw/education-per-pupil.csv` with columns `state, year, per_pupil`.

**`normalizeNaep(config)`** — fetches the 4 NAEP API endpoints (reading/math × 2019/2022), maps jurisdiction names to state names (trimming " Public" suffix that NAEP appends), writes `data/raw/naep-scores.csv` with columns `state, year, grade4_reading, grade8_math`.

Both functions warn (non-fatal) and return empty arrays if files/API are unavailable.

### `data/config/ingestion.config.json`

Add to `input`:
```json
"f33Csv": "data/raw/education-per-pupil.csv",
"naepCsv": "data/raw/naep-scores.csv"
```

### `scripts/ingest-state-tax-data.mjs`

Read both CSVs gracefully (non-fatal if missing — same pattern as `federalGrantsBreakdownCsv`). Build lookup maps keyed by `${state}||${year}`. Populate the 3 new fields in the state record mapping; default to `0` if no row found.

---

## Frontend Changes

### `src/types.ts`

Add 3 fields to `StateRecord` as described above.

### `src/EducationView.tsx` (new component)

Props: `activeStates: StateRecord[]`

**Structure:**

1. **Scatter plot panel** — SVG-based, using `d3-scale` (already in project via choropleth map) for axis scaling.
   - X-axis: `educationPerPupil`
   - Y-axis: NAEP score (active metric)
   - Toggle: "4th Grade Reading" / "8th Grade Math" (controls Y-axis)
   - Each state: circle + abbreviated state label
   - Hover tooltip: state name, spending formatted as currency, score
   - All dots same color (`#3b82f6`)
   - Fallback: if `educationPerPupil` is 0 for all states, show "Run `npm run data:refresh` to load education data"

2. **Ranked table panel** — all 50 states
   - Columns: State | $/Student | 4th Gr. Reading | 8th Gr. Math
   - Default sort: $/Student descending
   - Click any column header to toggle sort (ascending/descending)
   - Footnote: "K-12 spending from Census F-33 Survey. NAEP scores from the Nation's Report Card. F-33 fiscal year lags calendar year by ~1 year."

### `App.tsx`

- Add "Education" as the 6th tab
- Pass `activeStates` to `EducationView` (same as other views)
- **Year selector behavior when Education tab is active:** Disable year buttons for 2020, 2021, 2023 (rendered with `opacity: 0.4`, `cursor: not-allowed`, `pointer-events: none`). Show note: "NAEP scores available for 2019 and 2022 only." If the currently selected year is 2020, 2021, or 2023 when the user switches to Education tab, auto-select 2022.

### All test files with `StateRecord` mocks

Add zeroed values for the 3 new fields to every mock `StateRecord` in:
- `src/format.test.ts`
- `src/App.test.tsx`
- `src/TotalRevenueView.test.tsx`
- `src/OwnSourceView.test.tsx`
- `src/SpendingView.test.tsx`
- `src/ChoroplethMap.test.tsx`
- `src/PersonalCalculator.test.tsx`
- `src/FederalGrantsView.test.tsx`

### `src/EducationView.test.tsx` (new)

Tests:
- Renders scatter plot SVG when `educationPerPupil > 0`
- Renders "4th Grade Reading" and "8th Grade Math" toggle buttons
- Clicking toggle switches Y-axis metric
- Renders ranked table with correct column headers
- Table sorted by $/Student by default
- Clicking column header re-sorts
- Shows fallback message when all `educationPerPupil` values are 0

---

## What Does Not Change

- Existing `spendingBreakdown.education` (LF0106) — untouched
- All other tabs — no changes
- The choropleth map is not included in `EducationView` (the scatter plot serves the geographic distribution story for this tab)
- No new npm dependencies (SVG + d3-scale is sufficient)
