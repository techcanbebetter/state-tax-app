# Tax Burden as % of Income Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a third comparison metric — per-capita tax load as a percentage of per-capita personal income — alongside the existing "Total" and "Per capita" views.

**Architecture:** Pull per-capita personal income by state from the BEA Regional Economic Accounts API (SAINC1, Line 3), normalize it into a simple CSV, merge it in the existing ingestion pipeline, then expose a new `perCapitaBurden` metric toggle in the React UI.

**Tech Stack:** Node.js ESM scripts, PapaParse, React 19, TypeScript, Vite.

---

## Background

### How revenue values are stored

All revenue figures in the ingested JSON (and source CSVs) are in **thousands of dollars** (Census Bureau native unit).

- `totalRevenue = 350275780` → means $350,275,780,000 (350 billion)
- `perCapitaTotal = 8.99` → means $8,990 per resident

This is confirmed in `App.tsx:199`:
```ts
const displayValue = metric === 'perCapita' ? rawValue * 1000 : rawValue
```

So `perCapitaBurden` computation: `(perCapitaTotal * 1000) / perCapitaIncome * 100`

### BEA data format

BEA API returns JSON like:
```json
{
  "BEAAPI": {
    "Results": {
      "Data": [
        { "GeoFips": "01000", "GeoName": "Alabama", "TimePeriod": "2023", "DataValue": "52218" },
        ...
      ]
    }
  }
}
```
- `GeoName` may include `" *"` suffix (revision indicator) — strip it.
- `GeoFips` for DC is `"11000"` — exclude (not a state in VALID_STATES set).
- `DataValue` is per-capita personal income in **actual dollars** (not thousands).

---

## Task 1: Add per-capita income source to download config

**Files:**
- Modify: `data/config/source-download.config.json`

### Step 1: Edit the config

Add a new `income` entry under `sources`, `downloads`, and `normalizedOutputs`:

```json
{
  "year": 2023,
  "sources": {
    "tax": { ... },
    "population": { ... },
    "income": {
      "url": "https://apps.bea.gov/api/data/?UserID=DEMO_KEY&method=GetData&datasetname=Regional&TableName=SAINC1&LineCode=3&GeoFips=STATE&Year=2023&ResultFormat=JSON",
      "description": "BEA SAINC1 — Per capita personal income by state (2023)"
    }
  },
  "downloads": {
    "tax": "data/raw/downloads/census-tax-source.csv",
    "population": "data/raw/downloads/census-population-source.csv",
    "income": "data/raw/downloads/bea-income-source.json"
  },
  "normalization": {
    "tax": { ... },
    "population": { ... }
  },
  "normalizedOutputs": {
    "tax": "data/raw/state-local-tax-by-type.csv",
    "population": "data/raw/state-population.csv",
    "income": "data/raw/state-per-capita-income.csv"
  }
}
```

### Step 2: Verify structure

Confirm the file has all three entries in `sources`, `downloads`, and `normalizedOutputs`.

### Step 3: Commit

```bash
git add data/config/source-download.config.json
git commit -m "config: add BEA per-capita income source to download config"
```

---

## Task 2: Extend download script to fetch BEA income data

**Files:**
- Modify: `scripts/download-census-sources.mjs`

### Step 1: Add income download

After the existing two `downloadTo` calls (around line 49-52), add:

```js
const incomeUrl = ensureUrl(config.sources?.income?.url, 'income source')
const incomeOutput = await downloadTo(incomeUrl, config.downloads.income)
console.log(`Downloaded income source: ${path.relative(projectRoot, incomeOutput)}`)
```

> Note: `downloadTo` uses `response.text()` which works fine for JSON — the BEA API returns a JSON text body.

### Step 2: Run the download

```bash
npm run data:download
```

Expected output (3 lines):
```
Downloaded tax source: data/raw/downloads/census-tax-source.csv
Downloaded population source: data/raw/downloads/census-population-source.csv
Downloaded income source: data/raw/downloads/bea-income-source.json
```

Spot-check: `data/raw/downloads/bea-income-source.json` should exist and contain `"BEAAPI"` at the top level.

### Step 3: Commit

```bash
git add scripts/download-census-sources.mjs
git commit -m "feat: download BEA per-capita income data in download script"
```

---

## Task 3: Extend normalize script to produce income CSV

**Files:**
- Modify: `scripts/normalize-census-sources.mjs`

### Step 1: Add BEA JSON parser function

After the existing `parseCsv` / `parseCensusApiJson` / `parseSourceRows` functions (around line 150), add:

```js
const parseBEAIncomeJson = (rawText) => {
  const parsed = JSON.parse(rawText)
  const dataArray = parsed?.BEAAPI?.Results?.Data
  if (!Array.isArray(dataArray)) {
    throw new Error('Unexpected BEA API JSON format — missing BEAAPI.Results.Data array')
  }
  return dataArray
}
```

### Step 2: Add income normalization logic

Inside the `run` function, after the existing population normalization (around line 270), add:

```js
const incomeRawText = await readFile(path.resolve(projectRoot, config.downloads.income), 'utf8')
const beaRows = parseBEAIncomeJson(incomeRawText)
const year = config.year

const normalizedIncomeRows = beaRows
  .map((row) => ({
    state: normalizeState(String(row.GeoName ?? '').replace(/\s*\*+\s*$/, '')),
    year,
    per_capita_income: Math.round(parseNumeric(row.DataValue)),
  }))
  .filter((row) => row.state && row.per_capita_income > 0 && VALID_STATES.has(row.state))

if (!normalizedIncomeRows.length) {
  throw new Error('Income normalization produced zero rows. Check BEA download in data/raw/downloads/bea-income-source.json.')
}

const incomeOutput = await writeCsv(config.normalizedOutputs.income, normalizedIncomeRows, [
  'state',
  'year',
  'per_capita_income',
])

console.log(`Normalized income rows: ${normalizedIncomeRows.length} -> ${path.relative(projectRoot, incomeOutput)}`)
```

> `readFile` is already imported at the top of the script.

### Step 3: Run normalize

```bash
npm run data:normalize
```

Expected: 3 output lines, the income line should show ~50 rows, and `data/raw/state-per-capita-income.csv` should exist.

Spot-check: open `data/raw/state-per-capita-income.csv` — should start with:
```
state,year,per_capita_income
Alabama,2023,52218
...
```
(Values will vary; California should be ~$79,000+.)

### Step 4: Commit

```bash
git add scripts/normalize-census-sources.mjs
git commit -m "feat: normalize BEA per-capita income data to CSV"
```

---

## Task 4: Extend ingestion config and script to merge income data

**Files:**
- Modify: `data/config/ingestion.config.json`
- Modify: `scripts/ingest-state-tax-data.mjs`

### Step 1: Add income input to ingestion config

In `data/config/ingestion.config.json`, add `incomeCsv` under `input` and `income` under `columns`:

```json
{
  "year": 2023,
  "topNStates": 50,
  "input": {
    "taxByTypeCsv": "data/raw/state-local-tax-by-type.csv",
    "populationCsv": "data/raw/state-population.csv",
    "incomeCsv": "data/raw/state-per-capita-income.csv"
  },
  "columns": {
    "tax": { ... },
    "population": { ... },
    "income": {
      "state": "state",
      "year": "year",
      "perCapitaIncome": "per_capita_income"
    }
  },
  ...
}
```

### Step 2: Load income CSV in ingest script

In `scripts/ingest-state-tax-data.mjs`, inside the `run` function, add income loading after the existing `populationRows` load (around line 135):

```js
const incomeCsvPath = path.resolve(projectRoot, config.input.incomeCsv)
const incomeRows = await readCsv(incomeCsvPath)
const incomeColumns = config.columns.income

const perCapitaIncomeByState = new Map()
for (const row of incomeRows) {
  const rowYear = Number(row[incomeColumns.year])
  if (Number.isFinite(rowYear) && rowYear !== config.year) {
    continue
  }

  const state = normalizeState(row[incomeColumns.state])
  if (!state || !VALID_STATES.has(state)) {
    continue
  }

  const income = parseNumeric(row[incomeColumns.perCapitaIncome])
  if (income > 0) {
    perCapitaIncomeByState.set(state, income)
  }
}

if (!perCapitaIncomeByState.size) {
  throw new Error(`No per-capita income rows found for year ${config.year}.`)
}
```

### Step 3: Attach income to each state record

In the `.map()` that builds the final `states` array (around line 215-224), add `perCapitaIncome`:

```js
const states = [...stateAggregation.values()]
  .map((state) => {
    const population = state.population || 0
    const perCapitaTotal = population > 0 ? state.totalRevenue / population : 0
    const perCapitaIncome = perCapitaIncomeByState.get(state.state) ?? 0

    return {
      ...state,
      totalRevenue: Math.round(state.totalRevenue),
      perCapitaTotal: Number(perCapitaTotal.toFixed(2)),
      perCapitaIncome,
    }
  })
  .sort((a, b) => b.totalRevenue - a.totalRevenue)
```

### Step 4: Run ingest

```bash
npm run data:ingest
```

Expected: `Wrote 50 states to public/data/state-tax-summary-2023.json`

Spot-check: open `public/data/state-tax-summary-2023.json`, find California. Should now have `"perCapitaIncome": 79XXXX` (some value around 79,000).

### Step 5: Commit

```bash
git add data/config/ingestion.config.json scripts/ingest-state-tax-data.mjs public/data/state-tax-summary-2023.json
git commit -m "feat: add perCapitaIncome field to ingested state records"
```

---

## Task 5: Update TypeScript types and add metric to React app

**Files:**
- Modify: `src/App.tsx`

### Step 1: Extend `StateRecord` type

In `src/App.tsx`, change `StateRecord` (around line 9) to include `perCapitaIncome`:

```ts
type StateRecord = {
  state: string
  population: number
  totalRevenue: number
  perCapitaTotal: number
  perCapitaIncome: number   // added: BEA per-capita personal income in actual dollars
  breakdown: Record<string, number>
}
```

### Step 2: Extend metric type

Change the metric state type (line 65) to include the new option:

```ts
const [metric, setMetric] = useState<'total' | 'perCapita' | 'perCapitaBurden'>('total')
```

### Step 3: Update `sortedStates` sort logic

In the `sortedStates` useMemo (around line 100-106), add the new sort case:

```ts
return [...data.states].sort((a, b) => {
  if (metric === 'total') return b.totalRevenue - a.totalRevenue
  if (metric === 'perCapita') return b.perCapitaTotal - a.perCapitaTotal
  // perCapitaBurden: sort by (perCapitaTotal * 1000) / perCapitaIncome
  const burdenA = a.perCapitaIncome > 0 ? (a.perCapitaTotal * 1000) / a.perCapitaIncome : 0
  const burdenB = b.perCapitaIncome > 0 ? (b.perCapitaTotal * 1000) / b.perCapitaIncome : 0
  return burdenB - burdenA
})
```

### Step 4: Update `maxMetricValue`

In the `maxMetricValue` useMemo (around line 109-117):

```ts
const maxMetricValue = useMemo(() => {
  if (sortedStates.length === 0) return 0
  if (metric === 'total') return Math.max(...sortedStates.map((e) => e.totalRevenue))
  if (metric === 'perCapita') return Math.max(...sortedStates.map((e) => e.perCapitaTotal))
  // perCapitaBurden: raw ratio (not percentage) used as denominator for bar widths
  return Math.max(
    ...sortedStates.map((e) => (e.perCapitaIncome > 0 ? (e.perCapitaTotal * 1000) / e.perCapitaIncome : 0))
  )
}, [metric, sortedStates])
```

### Step 5: Add the third toggle button

In the metric toggle `<div>` (around line 177-193), add a third button after the Per capita button:

```tsx
<button
  className={metric === 'perCapitaBurden' ? 'active' : ''}
  onClick={() => setMetric('perCapitaBurden')}
  type="button"
>
  % of income
</button>
```

### Step 6: Update summary card label

In the summary card "Top state" (around line 165), extend the label:

```tsx
<h2>Top state ({metric === 'total' ? 'Total' : metric === 'perCapita' ? 'Per capita' : '% of income'})</h2>
```

### Step 7: Update bar row display value

In the bar row (around line 197-214), compute and display burden:

```tsx
const rawValue = metric === 'total'
  ? entry.totalRevenue
  : metric === 'perCapita'
    ? entry.perCapitaTotal
    : entry.perCapitaIncome > 0 ? (entry.perCapitaTotal * 1000) / entry.perCapitaIncome : 0

const displayValue = metric === 'perCapita'
  ? rawValue * 1000
  : metric === 'perCapitaBurden'
    ? rawValue * 100  // convert ratio to percentage
    : rawValue
```

Update the value display label in the `<p>` (around line 211-214):

```tsx
<p>
  {metric === 'total'
    ? compactCurrency(displayValue)
    : metric === 'perCapita'
      ? `${currencyFormatter.format(displayValue)} / resident`
      : `${(displayValue).toFixed(1)}% of income`}
</p>
```

### Step 8: Update bar segment width calculation

In the segment width calculation (around line 219-220), generalize for the new metric:

```tsx
const segmentRaw =
  metric === 'total'
    ? breakdownRaw
    : metric === 'perCapita'
      ? breakdownRaw / entry.population
      : entry.perCapitaIncome > 0
        ? (breakdownRaw / entry.population) / (entry.perCapitaIncome / 1000)  // ratio vs income, in same "thousands" unit
        : 0
const segmentWidth = maxMetricValue === 0 ? 0 : (segmentRaw / maxMetricValue) * 100
```

> Note: `breakdownRaw` is in thousands. `entry.population` is raw count. `entry.perCapitaIncome` is actual dollars.
> Per-capita segment in thousands: `breakdownRaw / entry.population`
> Per-capita segment in dollars: `(breakdownRaw / entry.population) * 1000`
> As ratio of income: `(breakdownRaw / entry.population) * 1000 / entry.perCapitaIncome`
> Simplified: `(breakdownRaw / entry.population) / (entry.perCapitaIncome / 1000)`

### Step 9: Update tooltip values

In the tooltip (around line 234-237), extend the ternary:

```tsx
const tooltipValue =
  metric === 'total'
    ? compactCurrency(breakdownRaw)
    : metric === 'perCapita'
      ? `${currencyFormatter.format((breakdownRaw / entry.population) * 1000)} / resident`
      : entry.perCapitaIncome > 0
        ? `${(((breakdownRaw / entry.population) * 1000) / entry.perCapitaIncome * 100).toFixed(2)}% of income`
        : '—'
```

### Step 10: Update hero description text

In the `<p>` inside `<section className="hero">` (around line 146-149), update to mention the new view:

```tsx
<p>
  One-year nominal-dollar comparison across all 50 states, including total tax revenue,
  per-capita views, and tax burden as a percentage of per-capita personal income.
</p>
```

### Step 11: Add BEA as a data source

In the sources panel (around line 295-320), add a third `<li>`:

```tsx
<li>
  <a
    href="https://apps.bea.gov/regional/downloadzip.cfm?tool=SAINC1"
    target="_blank"
    rel="noreferrer"
  >
    U.S. Bureau of Economic Analysis — SAINC1 Per Capita Personal Income by State (2023)
  </a>
</li>
```

### Step 12: Build and verify

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

Open `npm run dev` and verify:
- All three buttons show: "Total", "Per capita", "% of income"
- "% of income" sorts states by burden, with values like "11.5% of income"
- Tooltip shows "X.XX% of income" per tax type
- Bar widths are proportional

### Step 13: Commit

```bash
git add src/App.tsx
git commit -m "feat: add tax burden as % of income metric view"
```

---

## Task 6: Update data pipeline documentation

**Files:**
- Modify: `scripts/source-catalog.md`

### Step 1: Add BEA income source section

Append to `scripts/source-catalog.md`:

```markdown
3. **U.S. Bureau of Economic Analysis — SAINC1 Per Capita Personal Income**
   - BEA API endpoint (DEMO_KEY works for personal/dev use):
   - `https://apps.bea.gov/api/data/?UserID=DEMO_KEY&method=GetData&datasetname=Regional&TableName=SAINC1&LineCode=3&GeoFips=STATE&Year=2023&ResultFormat=JSON`
   - Line 3 = Per capita personal income in actual dollars.
   - Normalized to `state,year,per_capita_income` CSV before ingestion.
```

Also update the Income file schema block:

```markdown
### Income file (`data/raw/state-per-capita-income.csv`)

- `state`
- `year`
- `per_capita_income` (actual dollars, not thousands)
```

### Step 2: Commit

```bash
git add scripts/source-catalog.md
git commit -m "docs: add BEA income source to source catalog"
```

---

## Full refresh command

After all tasks are complete, a full data refresh runs as:

```bash
npm run data:refresh
```

This now executes: download (tax + population + income) → normalize (all three) → ingest.
