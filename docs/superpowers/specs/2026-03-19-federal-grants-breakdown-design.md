# Federal Grants Breakdown Design

**Goal:** Add a by-function breakdown of federal grants to the Federal Grants tab, showing Medicaid & Welfare, Education, Health, Transportation, and Other as a stacked bar chart per state.

**Architecture:** Pull Census Individual Unit Files (annual ZIP downloads) as a new pipeline input. Parse the fixed-width format to extract state-government B-code rows per year. Add 5 new fields to `StateRecord`. Rebuild `FederalGrantsView` to use a 5-bucket stacked bar, following the `TotalRevenueView` pattern.

**Tech Stack:** Node.js pipeline scripts (mjs), existing Vite/React/TypeScript frontend, Census Individual Unit Files (fixed-width `.txt`, no API key).

---

## Data Source

**Census Individual Unit Files** — annual flat files from the Census Annual Survey of State and Local Government Finances.

Download URLs (one ZIP per year, ~4 MB each):
```
https://www2.census.gov/programs-surveys/gov-finances/tables/2019/2019_Individual_Unit_File.zip
https://www2.census.gov/programs-surveys/gov-finances/tables/2020/2020_Individual_Unit_File.zip
https://www2.census.gov/programs-surveys/gov-finances/tables/2021/2021_Individual_Unit_File.zip
https://www2.census.gov/programs-surveys/gov-finances/tables/2022/2022_Individual_Unit_File.zip
https://www2.census.gov/programs-surveys/gov-finances/tables/2023/2023_Individual_Unit_Files.zip
```

No API key required.

**Fixed-width row format (space-delimited positions):**
```
Positions 0–1:   State FIPS code (e.g. "01" = Alabama)
Positions 2–11:  Unit ID (10 chars; state-government rows start with "0000")
Positions 12–14: Item code (3 chars, e.g. "B79")
Positions 15–26: Amount in thousands of dollars (12 chars, right-justified)
Positions 27–30: Year (4 chars)
Position  31:    Flag (1 char, ignore)
```

Filter to rows where unit ID starts with `"0000"` (state government). Aggregate by state FIPS + year + B-code.

**Coverage:** State-government records cover approximately 88% of total state+local federal grants (LF0004). The remaining ~12% flows directly to local governments and is not broken down by function in this dataset.

---

## B-code → Bucket Mapping

| Bucket | Label | Census B-codes | Contents |
|--------|-------|---------------|----------|
| `grantsWelfare` | Medicaid & Welfare | B79 | Medicaid, TANF, SNAP pass-through, public welfare |
| `grantsEducation` | Education | B21 | Title I, IDEA, vocational education |
| `grantsHealth` | Health | B42, B43 | CHIP, hospital grants, public health, environmental health |
| `grantsTransportation` | Transportation | B46, B01 | Highway formula funds, airport grants |
| `grantsOther` | Other | B22, B30, B50, B54, B59, B80, B89 | Housing, natural resources, employment security, sewerage, all other |

Amounts are in thousands in the raw files; multiply by 1000 to get full dollars (matching existing pipeline convention).

---

## New StateRecord Fields

Add to `src/types.ts`:

```typescript
grantsWelfare: number        // B79
grantsEducation: number      // B21
grantsHealth: number         // B42 + B43
grantsTransportation: number // B46 + B01
grantsOther: number          // B22 + B30 + B50 + B54 + B59 + B80 + B89
```

All fields default to `0` if Individual Unit File data is unavailable for a given state/year.

---

## Pipeline Changes

### 1. `data/config/source-download.config.json`
Add `individualUnitFileByYear` to `sources` (URL template with `{year}`) and `individualUnitFileByYear` to `downloads` (output path template). Add `federalGrantsBreakdown` to `normalizedOutputs` pointing to `data/raw/federal-grants-breakdown.csv`.

### 2. `scripts/download-census-sources.mjs`
Add download + unzip logic for the Individual Unit Files. For each year, download the ZIP, extract the `.txt` file, save to `data/raw/downloads/census-individual-unit-{year}.txt`. Skip years already downloaded.

### 3. `scripts/normalize-census-sources.mjs`
Add `normalizeFederalGrantsBreakdown()` function:
- Read each `census-individual-unit-{year}.txt`
- Parse fixed-width rows; keep rows where unit ID starts with `"0000"` and item code is one of the 14 B-codes above
- Aggregate: sum amounts by state FIPS + year + b_code
- Map state FIPS → state name (reuse existing FIPS map)
- Emit `data/raw/federal-grants-breakdown.csv` with columns: `state, year, b_code, amount_thousands`

### 4. `data/config/ingestion.config.json`
Add `federalGrantsBreakdownCsv` to `input`. Add `grantsBucketMap` object mapping B-codes to the 5 bucket keys.

### 5. `scripts/ingest-state-tax-data.mjs`
Read `federal-grants-breakdown.csv`. For each row, multiply `amount_thousands × 1000` and accumulate into the appropriate bucket for that state/year. Populate all 5 `grants*` fields on each state record. Missing rows default to `0`.

### 6. `public/data/state-tax-summary-2019-2023.json`
Regenerate via `npm run data:refresh`.

---

## Frontend Changes

### `src/format.ts`
Add `FEDERAL_GRANT_COLORS` constant:
```typescript
export const FEDERAL_GRANT_COLORS: Record<string, string> = {
  grantsWelfare:        '#1e40af',
  grantsEducation:      '#059669',
  grantsHealth:         '#dc2626',
  grantsTransportation: '#9333ea',
  grantsOther:          '#9ca3af',
}
```

### `src/FederalGrantsView.tsx`
Replace the single amber bar with a 5-bucket stacked bar following the `TotalRevenueView` pattern:

**Bar sizing:**
- Bar track width driven by `entry.federalGrants` (LF0004) — keeps values consistent with the Total Revenue tab
- Each segment width: `getSimpleMetricValue(bucketRaw, metric, population) / maxMetricValue * 100`
- The ~12% gap between bucket sum and `federalGrants` appears as the gray track background — no separate segment needed

**Buckets array:**
```typescript
const GRANT_BUCKETS = [
  { key: 'grantsWelfare',        label: 'Medicaid & Welfare',  getValue: (s) => s.grantsWelfare },
  { key: 'grantsEducation',      label: 'Education',            getValue: (s) => s.grantsEducation },
  { key: 'grantsHealth',         label: 'Health',               getValue: (s) => s.grantsHealth },
  { key: 'grantsTransportation', label: 'Transportation',       getValue: (s) => s.grantsTransportation },
  { key: 'grantsOther',          label: 'Other',                getValue: (s) => s.grantsOther },
]
```

**`hasData` guard:** show fallback if all `grantsWelfare` values are 0 (Individual Unit File not yet ingested).

**Layout (same as `TotalRevenueView`):**
- Panel with header ("Federal grants across states"), metric toggle (Total / Per capita)
- Stacked bar list with hover tooltip showing each bucket's value
- Color legend
- Choropleth map panel (unchanged — still uses `entry.federalGrants`)
- Breakdown table: State | Medicaid & Welfare | Education | Health | Transportation | Other | Total
- Footnote: "Breakdown covers state government grants (~88% of total federal grants). The remainder flows directly to local governments and cannot be attributed by function."

### `src/FederalGrantsView.test.tsx`
Update tests: mock states need 5 new `grants*` fields. Update existing tests for new structure. Add:
- Test that bars are sorted by `federalGrants` total (not bucket sum)
- Test that breakdown table has 5 bucket column headers
- Test that color legend has 5 entries
- Test fallback when all `grants*` fields are 0

### All other test files with `StateRecord` mocks
Add the 5 new fields (defaulting to `0`) to every mock `StateRecord` in: `App.test.tsx`, `TotalRevenueView.test.tsx`, `OwnSourceView.test.tsx`, `SpendingView.test.tsx`, `ChoroplethMap.test.tsx`, `PersonalCalculator.test.tsx`, `format.test.ts`.

---

## What Does Not Change

- Tab order and labels in `App.tsx` — Federal Grants stays in position 4
- `App.tsx` view routing — `FederalGrantsView` is already wired
- Choropleth map behavior — still sizes by `federalGrants` total
- All other tabs — no changes to `TotalRevenueView`, `OwnSourceView`, `RevenueView`, or `SpendingView`
