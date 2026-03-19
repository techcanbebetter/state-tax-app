# Federal Grants Breakdown Design

**Goal:** Add a by-function breakdown of federal grants to the Federal Grants tab, showing Medicaid & Welfare, Education, Health, Transportation, and Other as a stacked bar chart per state.

**Architecture:** Pull Census Individual Unit Files (annual ZIP downloads) as a new pipeline input. Parse the fixed-width format to extract state-government B-code rows per year. Add 5 new fields to `StateRecord`. Rebuild `FederalGrantsView` to use a 5-bucket stacked bar, following the `TotalRevenueView` pattern.

**Tech Stack:** Node.js pipeline scripts (mjs), existing Vite/React/TypeScript frontend, Census Individual Unit Files (fixed-width `.txt`, no API key), `adm-zip` npm package for ZIP extraction.

---

## Data Source

**Census Individual Unit Files** — annual flat files from the Census Annual Survey of State and Local Government Finances.

Download URLs (one ZIP per year, ~4 MB each). Note: the 2023 ZIP filename uses `_Files` (plural) while 2019–2022 use `_File` (singular) — these URLs cannot be generated from a single template:
```
https://www2.census.gov/programs-surveys/gov-finances/tables/2019/2019_Individual_Unit_File.zip
https://www2.census.gov/programs-surveys/gov-finances/tables/2020/2020_Individual_Unit_File.zip
https://www2.census.gov/programs-surveys/gov-finances/tables/2021/2021_Individual_Unit_File.zip
https://www2.census.gov/programs-surveys/gov-finances/tables/2022/2022_Individual_Unit_File.zip
https://www2.census.gov/programs-surveys/gov-finances/tables/2023/2023_Individual_Unit_Files.zip
```

No API key required.

**Fixed-width row format.** Each row is 32 characters. Field positions are 0-indexed:
```
Positions  0– 1  (2 chars):  State FIPS code, zero-padded (e.g. "01" = Alabama, "06" = California)
Positions  2–11  (10 chars): Unit ID; state-government rows start with "0000"
Positions 12–14  (3 chars):  Item code (e.g. "B79", "B21")
Positions 15–26  (12 chars): Amount in thousands of dollars, right-justified, space-padded
Positions 27–30  (4 chars):  Year (e.g. "2023")
Position  31     (1 char):   Flag — ignore
```

**Sample row (synthetic):**
```
010000226085B79    10983411 2023
^^          ^^^   ^^^^^^^^ ^^^^
01=Alabama  B79   $10,983,411k  year=2023
```

Verify positions by opening one raw `.txt` file and spot-checking a known state (e.g. Alabama FIPS `01`) against published state government finance totals.

Filter to rows where unit ID (chars 2–11) starts with `"0000"` (state government). Aggregate by state FIPS + year + B-code, summing amounts.

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

Any B-code rows in the file that are **not** in the 14 codes listed above are intentionally ignored — they are rare/small programs and are not rolled into `grantsOther`. Only the 14 listed codes are captured.

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
Add `individualUnitFiles` to `sources` as a list of 5 hardcoded URLs (not a template, due to the 2023 filename inconsistency). Add `individualUnitFileByYear` to `downloads` mapping year → output path `data/raw/downloads/census-individual-unit-{year}.txt`. Add `federalGrantsBreakdown` to `normalizedOutputs` pointing to `data/raw/federal-grants-breakdown.csv`.

### 2. `scripts/download-census-sources.mjs`
Add `adm-zip` as a dev dependency (`npm install --save-dev adm-zip`). Add download + unzip logic for the Individual Unit Files:
- For each year's URL, download as a binary buffer (use `response.arrayBuffer()`, not `response.text()`)
- Use `new AdmZip(Buffer.from(buffer))` to open the ZIP in memory
- Find the first `.txt` entry, extract its content as a string
- Write to `data/raw/downloads/census-individual-unit-{year}.txt`
- Skip if output file already exists (same pattern as other downloads)

### 3. `scripts/normalize-census-sources.mjs`
Add a `normalizeFederalGrantsBreakdown()` function. Add a `FIPS_TO_STATE` map at the top of the file (50 states + DC) — this does not exist elsewhere in the codebase and must be created here. Example entries:
```javascript
const FIPS_TO_STATE = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia',
  // ... all 50 states + DC
}
```

The function should:
- Read each `census-individual-unit-{year}.txt` (skip with warning if missing)
- Split on `\n` and call `.trimEnd()` on each line before slicing — Census flat files use CRLF line endings and the trailing `\r` will corrupt field positions if not stripped
- Parse each line: extract FIPS (chars 0–1), unitId (chars 2–11), bCode (chars 12–14), amountStr (chars 15–26), year (chars 27–30)
- Keep rows where `unitId.startsWith('0000')` and `bCode` is one of the 14 tracked codes
- Map FIPS to state name via `FIPS_TO_STATE`; skip rows where FIPS is not in the map (filters out territories, DC if not wanted, etc.)
- Filter to state names in the existing `VALID_STATES` set
- Aggregate amounts per state+year+bCode
- Emit `data/raw/federal-grants-breakdown.csv` with columns: `state,year,b_code,amount_thousands`
- Log a warning (not an error) if the output file already contains data

### 4. `data/config/ingestion.config.json`
Add `federalGrantsBreakdownCsv` to `input`:
```json
"federalGrantsBreakdownCsv": "data/raw/federal-grants-breakdown.csv"
```

Add `grantsBucketMap` top-level key mapping each B-code string to the field name it contributes to:
```json
"grantsBucketMap": {
  "B79": "grantsWelfare",
  "B21": "grantsEducation",
  "B42": "grantsHealth",
  "B43": "grantsHealth",
  "B46": "grantsTransportation",
  "B01": "grantsTransportation",
  "B22": "grantsOther",
  "B30": "grantsOther",
  "B50": "grantsOther",
  "B54": "grantsOther",
  "B59": "grantsOther",
  "B80": "grantsOther",
  "B89": "grantsOther"
}
```

### 5. `scripts/ingest-state-tax-data.mjs`
Read `federal-grants-breakdown.csv` using the same `readCsv` helper already used for other CSVs. Build a lookup `Map<string, number>` keyed by `"${state}|${year}|${b_code}"`. For each state record, accumulate the 5 `grants*` fields by iterating `config.grantsBucketMap` entries and summing matching CSV rows. All 5 fields default to `0` if no rows found.

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
- `maxMetricValue = Math.max(...sortedStates.map(s => getSimpleMetricValue(s.federalGrants, metric, s.population)))`
- Each segment width: `getSimpleMetricValue(bucketRaw, metric, population) / maxMetricValue * 100`
- Bar track is sized by `entry.federalGrants` (LF0004) — not the bucket sum — keeping values consistent with the Total Revenue tab. The ~12% gap between bucket sum and `federalGrants` appears as the gray track background; no separate segment is needed.

**Buckets array:**
```typescript
const GRANT_BUCKETS = [
  { key: 'grantsWelfare',        label: 'Medicaid & Welfare',  getValue: (s: StateRecord) => s.grantsWelfare },
  { key: 'grantsEducation',      label: 'Education',            getValue: (s: StateRecord) => s.grantsEducation },
  { key: 'grantsHealth',         label: 'Health',               getValue: (s: StateRecord) => s.grantsHealth },
  { key: 'grantsTransportation', label: 'Transportation',       getValue: (s: StateRecord) => s.grantsTransportation },
  { key: 'grantsOther',          label: 'Other',                getValue: (s: StateRecord) => s.grantsOther },
]
```

**Two-tier `hasData` guard:**
- If `activeStates.every(s => s.federalGrants === 0)`: show existing "no extended revenue data" message (pipeline not run)
- Else if `activeStates.every(s => s.grantsWelfare === 0)`: show a second message "Federal grants breakdown not available. Run `npm run data:refresh` to download the Individual Unit Files." — and render the single amber bar (no breakdown)
- Otherwise: render the full stacked bar view

**Layout (same as `TotalRevenueView`):**
- Panel with header ("Federal grants across states"), metric toggle (Total / Per capita)
- Stacked bar list with hover tooltip showing each bucket's value
- Color legend with 5 entries
- Choropleth map panel (unchanged — still uses `entry.federalGrants`)
- Breakdown table: State | Medicaid & Welfare | Education | Health | Transportation | Other | Total
- Footnote: compute coverage ratio dynamically: `(sum of grants* fields / federalGrants * 100).toFixed(0)%` averaged across states, display as "Breakdown covers state government grants (~X% of total). The remainder flows directly to local governments and cannot be attributed by function."

### `src/FederalGrantsView.test.tsx`
Remove or invert these two existing tests that conflict with the new design:
- `'does not render a breakdown table'` → replace with `'renders a breakdown table with 5 bucket column headers'`
- `'does not render a color legend'` → replace with `'renders a color legend with 5 entries'`

Add 5 new `grants*` fields to both mock state objects. Add new tests:
- Bars sorted by `federalGrants` total (not bucket sum)
- Breakdown table has correct column headers: Medicaid & Welfare, Education, Health, Transportation, Other
- Color legend has 5 entries
- Fallback message shown when all `grants*` fields are 0 but `federalGrants > 0`

### All other test files with `StateRecord` mocks
Add the 5 new fields (all defaulting to `0`) to every mock `StateRecord` in:
- `src/App.test.tsx`
- `src/TotalRevenueView.test.tsx`
- `src/OwnSourceView.test.tsx`
- `src/SpendingView.test.tsx`
- `src/ChoroplethMap.test.tsx`
- `src/PersonalCalculator.test.tsx`
- `src/format.test.ts`

`src/taxRates.test.ts` and `src/taxCalc.test.ts` do **not** use `StateRecord` mocks and require no changes.

---

## What Does Not Change

- Tab order and labels in `App.tsx` — Federal Grants stays in position 4
- `App.tsx` view routing — `FederalGrantsView` is already wired
- Choropleth map behavior — still sizes by `federalGrants` total
- All other tabs — no changes to `TotalRevenueView`, `OwnSourceView`, `RevenueView`, or `SpendingView`
