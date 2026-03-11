# Multi-Year Historical Trends Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the data pipeline to fetch 2019–2023 Census data for all 50 states and add a year toggle to the UI that switches the bar chart, choropleth map, and breakdown table to show the selected year.

**Architecture:** The pipeline is updated to loop over years; all data lands in a single `public/data/state-tax-summary-2019-2023.json` file whose top-level `states` array is replaced by a `years` array. App.tsx replaces `DataPayload` with `MultiYearPayload`, adds `selectedYear` state defaulting to 2023, and renders a year toggle row above the chart-map row. The Personal Calculator is pinned to 2023 data regardless of the selected year.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library (already installed); Node.js ESM pipeline scripts using PapaParse (already installed).

**Design doc:** `docs/plans/2026-03-10-multi-year-trends-design.md`

---

## Key facts about the existing codebase

Read these before touching any file:

- **`scripts/download-census-sources.mjs`** — fetches 3 sources: Census tax API (JSON, `time=2023`), population CSV (single multi-year wide file), ACS income API (JSON, year in URL path). Reads config from `data/config/source-download.config.json`.
- **`scripts/normalize-census-sources.mjs`** — parses raw downloads, emits three normalized CSVs: `data/raw/state-local-tax-by-type.csv`, `data/raw/state-population.csv`, `data/raw/state-per-capita-income.csv`. Population normalization currently reads a single `POPESTIMATE2023` column; tax normalization already reads a `YEAR` field from each Census API row.
- **`scripts/ingest-state-tax-data.mjs`** — reads the three normalized CSVs, filters everything to `config.year` (2023), outputs `public/data/state-tax-summary-2023.json` with a flat `states` array.
- **`data/config/source-download.config.json`** — contains source URLs and normalization aliases. Tax URL has `&time=2023` hardcoded. Income URL has `/2023/acs/` hardcoded.
- **`data/config/ingestion.config.json`** — contains `"year": 2023` used to filter rows. Output path is `public/data/state-tax-summary-2023.json`.
- **`public/data/state-tax-summary-sample.json`** — fallback for local dev; uses the OLD `DataPayload` schema (flat `states` array, no `years`).
- **`src/types.ts`** — defines `DataPayload` (flat `states`), `StateRecord`, `TaxType`, `Metric`. App.tsx imports `DataPayload`.
- **`src/App.tsx`** — fetches `state-tax-summary-2023.json`, falls back to `state-tax-summary-sample.json`. Uses `data.states` to build the bar chart, map, and table.
- **Population CSV note:** `NST-EST2023-ALLDATA.csv` covers the 2020–2023 vintage. Columns are wide-format: `POPESTIMATE2020`, `POPESTIMATE2021`, `POPESTIMATE2022`, `POPESTIMATE2023`. There is no `POPESTIMATE2019` column. Years without population data are skipped by the ingest script (inner join across all three sources). 2019 tax and income data will be fetched but the ingest will produce 4 years of output (2020–2023) since 2019 lacks population.

---

## Task 1: Update `src/types.ts` and sample file

**Files:**
- Modify: `src/types.ts`
- Modify: `public/data/state-tax-summary-sample.json`

### Step 1: Update `src/types.ts`

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
}

export type YearRecord = {
  year: number
  states: StateRecord[]
}

export type MultiYearPayload = {
  metadata: {
    /** Most recent year in the dataset */
    year: number
    /** Inclusive range of years present, e.g. [2020, 2023] */
    yearRange: [number, number]
    currency: string
    scope: string
    topN: number
    generatedAt?: string
    notes?: string[]
  }
  taxTypes: TaxType[]
  years: YearRecord[]
}

// Backward-compat alias used by App.tsx during migration (removed in Task 5)
export type DataPayload = MultiYearPayload

export type Metric = 'total' | 'perCapita' | 'perCapitaBurden'
```

### Step 2: Verify the build still passes

```bash
npm run build
```

Expected: no TypeScript errors. App.tsx still compiles because `DataPayload` is exported as an alias for `MultiYearPayload`. The existing `data.states` references in App.tsx will show TS errors — that is expected and will be fixed in Task 5.

If there are TS errors, ignore them for now and proceed; they will be resolved in Task 5.

### Step 3: Update `public/data/state-tax-summary-sample.json`

Replace the entire file contents with the multi-year schema. Use 2022 and 2023 data (two years) so the year toggle can be exercised in tests. Keep only the same 6 states as before.

```json
{
  "metadata": {
    "year": 2023,
    "yearRange": [2022, 2023],
    "currency": "USD",
    "scope": "state+local",
    "topN": 6,
    "notes": [
      "Sample dataset for UI development only.",
      "Replace by running npm run data:refresh with Census source files."
    ]
  },
  "taxTypes": [
    { "key": "income_individual", "label": "Individual income" },
    { "key": "income_corporate", "label": "Corporate income" },
    { "key": "sales_general", "label": "General sales" },
    { "key": "sales_selective", "label": "Selective sales" },
    { "key": "property", "label": "Property" },
    { "key": "licenses", "label": "Licenses" },
    { "key": "other", "label": "Other" }
  ],
  "years": [
    {
      "year": 2022,
      "states": [
        {
          "state": "California",
          "population": 38965193,
          "totalRevenue": 340000000000,
          "perCapitaTotal": 8727,
          "perCapitaIncome": 77358,
          "breakdown": {
            "income_individual": 108000000000,
            "income_corporate": 26000000000,
            "sales_general": 54000000000,
            "sales_selective": 22000000000,
            "property": 92000000000,
            "licenses": 9000000000,
            "other": 29000000000
          }
        },
        {
          "state": "Texas",
          "population": 30503301,
          "totalRevenue": 255000000000,
          "perCapitaTotal": 8360,
          "perCapitaIncome": 60000,
          "breakdown": {
            "income_individual": 0,
            "income_corporate": 7400000000,
            "sales_general": 70000000000,
            "sales_selective": 24000000000,
            "property": 117000000000,
            "licenses": 7400000000,
            "other": 29200000000
          }
        },
        {
          "state": "Florida",
          "population": 22610726,
          "totalRevenue": 168000000000,
          "perCapitaTotal": 7430,
          "perCapitaIncome": 55000,
          "breakdown": {
            "income_individual": 0,
            "income_corporate": 5100000000,
            "sales_general": 50000000000,
            "sales_selective": 20000000000,
            "property": 68000000000,
            "licenses": 4900000000,
            "other": 20000000000
          }
        },
        {
          "state": "New York",
          "population": 19571216,
          "totalRevenue": 220000000000,
          "perCapitaTotal": 11241,
          "perCapitaIncome": 72000,
          "breakdown": {
            "income_individual": 79000000000,
            "income_corporate": 12000000000,
            "sales_general": 38000000000,
            "sales_selective": 17000000000,
            "property": 52000000000,
            "licenses": 4000000000,
            "other": 18000000000
          }
        },
        {
          "state": "Pennsylvania",
          "population": 12961683,
          "totalRevenue": 112000000000,
          "perCapitaTotal": 8641,
          "perCapitaIncome": 58000,
          "breakdown": {
            "income_individual": 20000000000,
            "income_corporate": 4100000000,
            "sales_general": 23000000000,
            "sales_selective": 10000000000,
            "property": 42000000000,
            "licenses": 3100000000,
            "other": 9800000000
          }
        },
        {
          "state": "Illinois",
          "population": 12549689,
          "totalRevenue": 110000000000,
          "perCapitaTotal": 8766,
          "perCapitaIncome": 60000,
          "breakdown": {
            "income_individual": 27000000000,
            "income_corporate": 7200000000,
            "sales_general": 23000000000,
            "sales_selective": 10000000000,
            "property": 33000000000,
            "licenses": 2200000000,
            "other": 7600000000
          }
        }
      ]
    },
    {
      "year": 2023,
      "states": [
        {
          "state": "California",
          "population": 38965193,
          "totalRevenue": 362500000000,
          "perCapitaTotal": 9303,
          "perCapitaIncome": 80440,
          "breakdown": {
            "income_individual": 117000000000,
            "income_corporate": 28600000000,
            "sales_general": 57100000000,
            "sales_selective": 24100000000,
            "property": 96000000000,
            "licenses": 9700000000,
            "other": 30000000000
          }
        },
        {
          "state": "Texas",
          "population": 30503301,
          "totalRevenue": 270400000000,
          "perCapitaTotal": 8865,
          "perCapitaIncome": 65000,
          "breakdown": {
            "income_individual": 0,
            "income_corporate": 7900000000,
            "sales_general": 74400000000,
            "sales_selective": 25500000000,
            "property": 124500000000,
            "licenses": 7900000000,
            "other": 30100000000
          }
        },
        {
          "state": "Florida",
          "population": 22610726,
          "totalRevenue": 178700000000,
          "perCapitaTotal": 7904,
          "perCapitaIncome": 57000,
          "breakdown": {
            "income_individual": 0,
            "income_corporate": 5500000000,
            "sales_general": 53600000000,
            "sales_selective": 21700000000,
            "property": 72300000000,
            "licenses": 5200000000,
            "other": 20400000000
          }
        },
        {
          "state": "New York",
          "population": 19571216,
          "totalRevenue": 234900000000,
          "perCapitaTotal": 12002,
          "perCapitaIncome": 75000,
          "breakdown": {
            "income_individual": 85000000000,
            "income_corporate": 12900000000,
            "sales_general": 41100000000,
            "sales_selective": 18100000000,
            "property": 54800000000,
            "licenses": 4300000000,
            "other": 18700000000
          }
        },
        {
          "state": "Pennsylvania",
          "population": 12961683,
          "totalRevenue": 119600000000,
          "perCapitaTotal": 9229,
          "perCapitaIncome": 60000,
          "breakdown": {
            "income_individual": 21500000000,
            "income_corporate": 4400000000,
            "sales_general": 24700000000,
            "sales_selective": 11100000000,
            "property": 44200000000,
            "licenses": 3300000000,
            "other": 10400000000
          }
        },
        {
          "state": "Illinois",
          "population": 12549689,
          "totalRevenue": 117900000000,
          "perCapitaTotal": 9395,
          "perCapitaIncome": 62000,
          "breakdown": {
            "income_individual": 28900000000,
            "income_corporate": 7700000000,
            "sales_general": 24600000000,
            "sales_selective": 11100000000,
            "property": 34700000000,
            "licenses": 2300000000,
            "other": 8600000000
          }
        }
      ]
    }
  ]
}
```

### Step 4: Commit

```bash
git add src/types.ts public/data/state-tax-summary-sample.json
git commit -m "feat: add MultiYearPayload type and update sample file to multi-year schema"
```

---

## Task 2: Update `ingest-state-tax-data.mjs` for multi-year output

**Files:**
- Modify: `data/config/ingestion.config.json`
- Modify: `scripts/ingest-state-tax-data.mjs`

The goal: the ingest script now reads normalized CSVs containing multiple years of data and emits a `years` array instead of a flat `states` array. We can smoke-test this with the existing 2023-only normalized CSVs — the output will be `years: [{year: 2023, states: [...]}]` which validates the new code path.

### Step 1: Update `data/config/ingestion.config.json`

Replace the entire file with:

```json
{
  "topNStates": 50,
  "yearRange": [2019, 2023],
  "input": {
    "taxByTypeCsv": "data/raw/state-local-tax-by-type.csv",
    "populationCsv": "data/raw/state-population.csv",
    "incomeCsv": "data/raw/state-per-capita-income.csv"
  },
  "columns": {
    "tax": {
      "state": "state",
      "year": "year",
      "taxType": "tax_type",
      "stateTaxRevenue": "state_tax_revenue",
      "localTaxRevenue": "local_tax_revenue"
    },
    "population": {
      "state": "state",
      "year": "year",
      "population": "population"
    },
    "income": {
      "state": "state",
      "year": "year",
      "perCapitaIncome": "per_capita_income"
    }
  },
  "taxTypeMap": {
    "Individual income tax": "income_individual",
    "Corporate income tax": "income_corporate",
    "General sales tax": "sales_general",
    "Selective sales tax": "sales_selective",
    "Property tax": "property",
    "License tax": "licenses",
    "Other tax": "other"
  },
  "taxTypeLabels": {
    "income_individual": "Individual income",
    "income_corporate": "Corporate income",
    "sales_general": "General sales",
    "sales_selective": "Selective sales",
    "property": "Property",
    "licenses": "Licenses",
    "other": "Other"
  },
  "output": {
    "json": "public/data/state-tax-summary-2019-2023.json"
  }
}
```

Key changes from the old config: `year` removed, `yearRange` added, `output.json` path updated.

### Step 2: Replace `scripts/ingest-state-tax-data.mjs`

Replace the entire file with:

```javascript
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const configPath = process.argv[2]
  ? path.resolve(projectRoot, process.argv[2])
  : path.join(projectRoot, 'data/config/ingestion.config.json')

const VALID_STATES = new Set([
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
])

const parseNumeric = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const normalized = String(value).replace(/[$,]/g, '').replace(/\((.*)\)/, '-$1').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeState = (value) => String(value ?? '').trim()

const toTaxTypeKey = (value) =>
  String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const readCsv = async (filePath) => {
  let content
  try {
    content = await readFile(filePath, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      const relativePath = path.relative(projectRoot, filePath)
      throw new Error(
        `Missing required source file: ${relativePath}. Run npm run data:refresh first.`,
      )
    }
    throw error
  }
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true })
  if (parsed.errors?.length) {
    throw new Error(
      `CSV parsing failed for ${path.relative(projectRoot, filePath)}: ${parsed.errors
        .map((item) => item.message)
        .join('; ')}`,
    )
  }
  return parsed.data
}

const loadConfig = async () => {
  const content = await readFile(configPath, 'utf8')
  return JSON.parse(content)
}

const run = async () => {
  const config = await loadConfig()
  const taxCsvPath = path.resolve(projectRoot, config.input.taxByTypeCsv)
  const populationCsvPath = path.resolve(projectRoot, config.input.populationCsv)
  const incomeCsvPath = path.resolve(projectRoot, config.input.incomeCsv)

  const taxRows = await readCsv(taxCsvPath)
  const populationRows = await readCsv(populationCsvPath)
  const incomeRows = await readCsv(incomeCsvPath)

  const taxColumns = config.columns.tax
  const populationColumns = config.columns.population
  const incomeColumns = config.columns.income

  // Build population lookup: year -> state -> population
  const populationByYear = new Map()
  for (const row of populationRows) {
    const rowYear = Number(row[populationColumns.year])
    if (!Number.isFinite(rowYear)) continue
    const state = normalizeState(row[populationColumns.state])
    if (!state || !VALID_STATES.has(state)) continue
    const population = parseNumeric(row[populationColumns.population])
    if (population <= 0) continue
    if (!populationByYear.has(rowYear)) populationByYear.set(rowYear, new Map())
    populationByYear.get(rowYear).set(state, population)
  }
  if (!populationByYear.size) throw new Error('No population rows found in normalized CSV.')

  // Build income lookup: year -> state -> per capita income
  const incomeByYear = new Map()
  for (const row of incomeRows) {
    const rowYear = Number(row[incomeColumns.year])
    if (!Number.isFinite(rowYear)) continue
    const state = normalizeState(row[incomeColumns.state])
    if (!state || !VALID_STATES.has(state)) continue
    const income = parseNumeric(row[incomeColumns.perCapitaIncome])
    if (income <= 0) continue
    if (!incomeByYear.has(rowYear)) incomeByYear.set(rowYear, new Map())
    incomeByYear.get(rowYear).set(state, income)
  }
  if (!incomeByYear.size) throw new Error('No income rows found in normalized CSV.')

  // Build tax aggregation: year -> state -> { totalRevenue, breakdown }
  const taxByYear = new Map()
  const taxTypeSeen = new Set()
  const taxTypeOrder = []
  for (const row of taxRows) {
    const rowYear = Number(row[taxColumns.year])
    if (!Number.isFinite(rowYear)) continue
    const state = normalizeState(row[taxColumns.state])
    if (!VALID_STATES.has(state)) continue
    const rawTaxType = String(row[taxColumns.taxType] ?? '').trim()
    if (!rawTaxType) continue
    const taxTypeKey = config.taxTypeMap?.[rawTaxType] ?? toTaxTypeKey(rawTaxType)
    if (!taxTypeSeen.has(taxTypeKey)) {
      taxTypeSeen.add(taxTypeKey)
      taxTypeOrder.push(taxTypeKey)
    }
    const totalTax = parseNumeric(row[taxColumns.stateTaxRevenue]) + parseNumeric(row[taxColumns.localTaxRevenue])
    if (!taxByYear.has(rowYear)) taxByYear.set(rowYear, new Map())
    const yearMap = taxByYear.get(rowYear)
    const existing = yearMap.get(state) ?? { state, totalRevenue: 0, breakdown: {} }
    existing.breakdown[taxTypeKey] = (existing.breakdown[taxTypeKey] ?? 0) + totalTax
    existing.totalRevenue += totalTax
    yearMap.set(state, existing)
  }
  if (!taxByYear.size) throw new Error('No tax rows found in normalized CSV.')

  // Determine top states using the most recent year's population
  const latestPopYear = Math.max(...populationByYear.keys())
  const latestPop = populationByYear.get(latestPopYear)
  const topStates = [...latestPop.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.topNStates)
    .map(([state]) => state)
  const topStateSet = new Set(topStates)

  // Build years array — inner join on all three sources
  const availableYears = [...new Set([
    ...taxByYear.keys(),
    ...populationByYear.keys(),
    ...incomeByYear.keys(),
  ])].sort()

  const yearsOutput = []
  for (const yr of availableYears) {
    const yearTax = taxByYear.get(yr)
    const yearPop = populationByYear.get(yr)
    const yearInc = incomeByYear.get(yr)
    if (!yearTax || !yearPop || !yearInc) {
      console.warn(`Skipping year ${yr}: missing ${!yearTax ? 'tax' : !yearPop ? 'population' : 'income'} data.`)
      continue
    }
    const states = []
    for (const state of topStates) {
      if (!topStateSet.has(state)) continue
      const taxData = yearTax.get(state)
      if (!taxData) continue
      const population = yearPop.get(state) ?? 0
      const perCapitaIncome = yearInc.get(state) ?? 0
      const perCapitaTotal = population > 0 ? taxData.totalRevenue / population : 0
      states.push({
        state,
        population,
        totalRevenue: Math.round(taxData.totalRevenue),
        perCapitaTotal: Number(perCapitaTotal.toFixed(2)),
        perCapitaIncome,
        breakdown: taxData.breakdown,
      })
    }
    states.sort((a, b) => b.totalRevenue - a.totalRevenue)
    if (states.length > 0) yearsOutput.push({ year: yr, states })
  }

  if (!yearsOutput.length) throw new Error('No complete year data found — pipeline produced zero year records.')

  const firstYear = yearsOutput[0].year
  const lastYear = yearsOutput[yearsOutput.length - 1].year

  const payload = {
    metadata: {
      year: lastYear,
      yearRange: [firstYear, lastYear],
      currency: 'USD',
      scope: 'state+local',
      topN: config.topNStates,
      notes: [
        'Nominal dollars.',
        'Top states selected by population for the most recent year.',
        'Years without complete data across all three Census sources are omitted.',
      ],
      generatedAt: new Date().toISOString(),
    },
    taxTypes: taxTypeOrder.map((key) => ({
      key,
      label: config.taxTypeLabels?.[key] ?? key,
    })),
    years: yearsOutput,
  }

  const outputPath = path.resolve(projectRoot, config.output.json)
  await writeFile(outputPath, JSON.stringify(payload, null, 2))

  console.log(`Wrote ${yearsOutput.length} year(s) to ${path.relative(projectRoot, outputPath)}`)
  for (const yr of yearsOutput) {
    console.log(`  ${yr.year}: ${yr.states.length} states`)
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
```

### Step 3: Smoke-test with existing 2023 CSVs

The existing normalized CSVs have only 2023 data. Run the updated ingest to verify it produces the new JSON shape:

```bash
node scripts/ingest-state-tax-data.mjs
```

Expected output:
```
Wrote 1 year(s) to public/data/state-tax-summary-2019-2023.json
  2023: 50 states
```

Verify the output file has the new schema:
```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('public/data/state-tax-summary-2019-2023.json', 'utf8'))
console.log('years:', d.years.length)
console.log('yearRange:', d.metadata.yearRange)
console.log('first year states:', d.years[0].states.length)
console.log('has perCapitaIncome:', 'perCapitaIncome' in d.years[0].states[0])
"
```

Expected:
```
years: 1
yearRange: [ 2023, 2023 ]
first year states: 50
has perCapitaIncome: true
```

### Step 4: Commit

```bash
git add data/config/ingestion.config.json scripts/ingest-state-tax-data.mjs public/data/state-tax-summary-2019-2023.json
git commit -m "feat: update ingest script for multi-year output with years array"
```

---

## Task 3: Update `download-census-sources.mjs` for multi-year downloads

**Files:**
- Modify: `data/config/source-download.config.json`
- Modify: `scripts/download-census-sources.mjs`

The download script now loops over years for the tax API and income API. Population is still a single CSV download (the wide-format NST file covers 2020–2023). Income is downloaded as one file per year to `data/raw/downloads/census-acs-income-source-{year}.json`. Tax data for all years is concatenated into the single existing `census-tax-source.json` file.

### Step 1: Update `data/config/source-download.config.json`

Replace the entire file with:

```json
{
  "years": [2019, 2020, 2021, 2022, 2023],
  "sources": {
    "tax": {
      "url": "https://api.census.gov/data/timeseries/govs?get=NAME,GOVTYPE,GOVTYPE_LABEL,AGG_DESC,AGG_DESC_LABEL,AMOUNT,YEAR&for=state:*&time={YEAR}&SVY_COMP=04",
      "description": "Census Annual Survey of State and Local Government Finances. {YEAR} is replaced per year."
    },
    "population": {
      "url": "https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/state/totals/NST-EST2023-ALLDATA.csv",
      "description": "Census population estimates 2020-2023. Single wide-format CSV with POPESTIMATE{YEAR} columns."
    },
    "income": {
      "url": "https://api.census.gov/data/{YEAR}/acs/acs1?get=NAME,B19301_001E&for=state:*",
      "description": "Census ACS 1-year per-capita income by state. {YEAR} is replaced per year."
    }
  },
  "downloads": {
    "tax": "data/raw/downloads/census-tax-source.json",
    "population": "data/raw/downloads/census-population-source.csv",
    "incomeDir": "data/raw/downloads"
  },
  "normalization": {
    "tax": {
      "state": ["state", "State", "state_name", "NAME"],
      "year": ["year", "Year", "fiscal_year"],
      "taxType": ["tax_type", "Tax Type", "tax", "category"],
      "stateTaxRevenue": ["state_tax_revenue", "State Tax Revenue", "state_tax", "state_amount"],
      "localTaxRevenue": ["local_tax_revenue", "Local Tax Revenue", "local_tax", "local_amount"]
    },
    "population": {
      "state": ["state", "State", "state_name", "NAME"],
      "year": ["year", "Year"],
      "population": ["population", "Population", "pop", "POPESTIMATE", "POPESTIMATE2023", "POPESTIMATE2024"]
    }
  },
  "normalizedOutputs": {
    "tax": "data/raw/state-local-tax-by-type.csv",
    "population": "data/raw/state-population.csv",
    "income": "data/raw/state-per-capita-income.csv"
  }
}
```

Key changes: added `years` array; tax and income `url` fields now contain `{YEAR}` placeholder; income download renamed from `income` to `incomeDir`.

### Step 2: Replace `scripts/download-census-sources.mjs`

Replace the entire file with:

```javascript
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const configPath = path.join(projectRoot, 'data/config/source-download.config.json')

const loadConfig = async () => {
  const content = await readFile(configPath, 'utf8')
  return JSON.parse(content)
}

const fetchText = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`)
  const text = await response.text()
  if (!text.trim()) throw new Error(`Downloaded file is empty for ${url}`)
  return text
}

const writeTo = async (relativePath, content) => {
  const outputPath = path.resolve(projectRoot, relativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, content, 'utf8')
  return outputPath
}

const run = async () => {
  const config = await loadConfig()
  const years = config.years ?? [2023]

  // ── Tax: fetch each year from the Census timeseries API, concatenate rows ──
  console.log(`Downloading tax data for years: ${years.join(', ')}`)
  const allTaxRows = []
  let taxHeaders = null
  for (const year of years) {
    const url = config.sources.tax.url.replace(/{YEAR}/g, String(year))
    const text = await fetchText(url)
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed) || parsed.length < 2) {
      throw new Error(`Unexpected Census tax API response for year ${year}`)
    }
    if (!taxHeaders) taxHeaders = parsed[0]
    // Skip header row (index 0) for years after the first
    allTaxRows.push(...parsed.slice(1))
    console.log(`  ${year}: ${parsed.length - 1} rows`)
  }
  const taxJson = JSON.stringify([taxHeaders, ...allTaxRows], null, 0)
  const taxOutput = await writeTo(config.downloads.tax, taxJson)
  console.log(`Tax data written to ${path.relative(projectRoot, taxOutput)}`)

  // ── Population: single CSV download (covers 2020-2023) ──
  console.log('Downloading population data (2020-2023 vintage CSV)...')
  const populationText = await fetchText(config.sources.population.url)
  const populationOutput = await writeTo(config.downloads.population, populationText)
  console.log(`Population data written to ${path.relative(projectRoot, populationOutput)}`)

  // ── Income: fetch each year from ACS API, write to a separate file ──
  console.log(`Downloading income data for years: ${years.join(', ')}`)
  for (const year of years) {
    const url = config.sources.income.url.replace(/{YEAR}/g, String(year))
    const text = await fetchText(url)
    const relativePath = path.join(config.downloads.incomeDir, `census-acs-income-source-${year}.json`)
    const outputPath = await writeTo(relativePath, text)
    console.log(`  ${year}: written to ${path.relative(projectRoot, outputPath)}`)
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
```

### Step 3: Verify the script runs (requires internet access)

```bash
node scripts/download-census-sources.mjs
```

Expected output (approximate):
```
Downloading tax data for years: 2019, 2020, 2021, 2022, 2023
  2019: ~3500 rows
  2020: ~3500 rows
  2021: ~3500 rows
  2022: ~3500 rows
  2023: ~3500 rows
Tax data written to data/raw/downloads/census-tax-source.json
Downloading population data (2020-2023 vintage CSV)...
Population data written to data/raw/downloads/census-population-source.csv
Downloading income data for years: 2019, 2020, 2021, 2022, 2023
  2019: written to data/raw/downloads/census-acs-income-source-2019.json
  2020: written to data/raw/downloads/census-acs-income-source-2020.json
  2021: written to data/raw/downloads/census-acs-income-source-2021.json
  2022: written to data/raw/downloads/census-acs-income-source-2022.json
  2023: written to data/raw/downloads/census-acs-income-source-2023.json
```

Verify the tax JSON now contains all years:
```bash
node -e "
const rows = JSON.parse(require('fs').readFileSync('data/raw/downloads/census-tax-source.json', 'utf8'))
const years = new Set(rows.slice(1).map(r => r[rows[0].indexOf('YEAR')]))
console.log('Years in tax data:', [...years].sort().join(', '))
"
```

Expected: `Years in tax data: 2019, 2020, 2021, 2022, 2023`

Verify the 2019 income file exists:
```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('data/raw/downloads/census-acs-income-source-2019.json', 'utf8'))
console.log('2019 income rows:', d.length - 1)
"
```

Expected: `2019 income rows: 51` (50 states + DC, filtered later)

### Step 4: Commit

```bash
git add data/config/source-download.config.json scripts/download-census-sources.mjs
git commit -m "feat: update download script for multi-year tax and income data"
```

---

## Task 4: Update `normalize-census-sources.mjs` for multi-year normalization

**Files:**
- Modify: `scripts/normalize-census-sources.mjs`

Two changes:
1. **Population**: The wide-format Census CSV has columns `POPESTIMATE2020` through `POPESTIMATE2023`. For each state row, emit one row per year by reading `POPESTIMATE{year}`. Skip years where the column is absent (this handles 2019 gracefully).
2. **Income**: Instead of reading a single income file, loop over each year's file (`census-acs-income-source-{year}.json`) and assign `year` from the loop variable.

The tax normalization is already correct — it reads the `YEAR` field from each Census API row.

### Step 1: Replace `scripts/normalize-census-sources.mjs`

Replace the entire file with:

```javascript
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const configPath = path.join(projectRoot, 'data/config/source-download.config.json')

const VALID_STATES = new Set([
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
])

const CENSUS_TAX_CODE_TO_TYPE = new Map([
  ['LF0022', 'Individual income tax'],
  ['LF0023', 'Corporate income tax'],
  ['LF0011', 'General sales tax'],
  ['LF0012', 'Selective sales tax'],
  ['LF0009', 'Property tax'],
  ['LF0033', 'Other tax'],
])

const LICENSE_CODES = new Set(['LF0024', 'LF0025', 'LF0026', 'LF0027', 'LF0028', 'LF0029', 'LF0030', 'LF0031', 'LF0032'])

const parseNumeric = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const normalized = String(value).replace(/[$,]/g, '').replace(/\((.*)\)/, '-$1').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeState = (value) => String(value ?? '').trim()

const loadConfig = async () => {
  const content = await readFile(configPath, 'utf8')
  return JSON.parse(content)
}

const parseCsv = async (relativePath) => {
  const filePath = path.resolve(projectRoot, relativePath)
  const content = await readFile(filePath, 'utf8')
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true })
  if (parsed.errors?.length) {
    throw new Error(`CSV parsing failed for ${relativePath}: ${parsed.errors.map((e) => e.message).join('; ')}`)
  }
  return parsed.data
}

const parseCensusApiJson = async (relativePath) => {
  const filePath = path.resolve(projectRoot, relativePath)
  const content = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(content)
  if (!Array.isArray(parsed) || parsed.length < 2 || !Array.isArray(parsed[0])) {
    throw new Error(`Unexpected Census API JSON format in ${relativePath}`)
  }
  const headers = parsed[0]
  return parsed.slice(1).map((row) => {
    const output = {}
    headers.forEach((header, index) => { output[header] = row[index] })
    return output
  })
}

const parseSourceRows = async (relativePath) => {
  const filePath = path.resolve(projectRoot, relativePath)
  const content = await readFile(filePath, 'utf8')
  const trimmed = content.trim()
  if (!trimmed) throw new Error(`Source file is empty: ${relativePath}`)
  if (trimmed.startsWith('[')) return parseCensusApiJson(relativePath)
  return parseCsv(relativePath)
}

const pickColumn = (row, aliases) => {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias]
  }
  return undefined
}

const normalizeTaxFromCensusApiRows = (rows, config) => {
  const bucket = new Map()
  for (const row of rows) {
    const state = normalizeState(row.NAME ?? row.state ?? row.State)
    const year = Number(row.YEAR ?? row.year ?? config.year)
    const code = String(row.AGG_DESC ?? '').trim()
    const govType = String(row.GOVTYPE ?? '').trim()
    if (!state || !VALID_STATES.has(state) || !code || !['002', '003'].includes(govType)) continue
    let taxType = CENSUS_TAX_CODE_TO_TYPE.get(code)
    if (!taxType && LICENSE_CODES.has(code)) taxType = 'License tax'
    if (!taxType) continue
    const amount = parseNumeric(row.AMOUNT)
    const mapKey = `${state}||${year}||${taxType}`
    const current = bucket.get(mapKey) ?? { state, year, tax_type: taxType, state_tax_revenue: 0, local_tax_revenue: 0 }
    if (govType === '002') current.state_tax_revenue += amount
    if (govType === '003') current.local_tax_revenue += amount
    bucket.set(mapKey, current)
  }
  return [...bucket.values()].filter((row) => row.state_tax_revenue > 0 || row.local_tax_revenue > 0)
}

const quoteCsv = (value) => {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const writeCsv = async (relativePath, rows, columns) => {
  const outputPath = path.resolve(projectRoot, relativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })
  const lines = [columns.join(',')]
  for (const row of rows) lines.push(columns.map((col) => quoteCsv(row[col])).join(','))
  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8')
  return outputPath
}

const run = async () => {
  const config = await loadConfig()
  const years = config.years ?? [2023]

  // ── Tax normalization (Census API JSON with YEAR field per row) ──
  const taxRows = await parseSourceRows(config.downloads.tax)
  const taxRowsLookLikeCensusApi =
    taxRows.length > 0 &&
    Object.prototype.hasOwnProperty.call(taxRows[0], 'AGG_DESC') &&
    Object.prototype.hasOwnProperty.call(taxRows[0], 'GOVTYPE') &&
    Object.prototype.hasOwnProperty.call(taxRows[0], 'AMOUNT')

  const normalizedTaxRows = taxRowsLookLikeCensusApi
    ? normalizeTaxFromCensusApiRows(taxRows, config)
    : taxRows
        .map((row) => ({
          state: normalizeState(pickColumn(row, config.normalization.tax.state)),
          year: Number(pickColumn(row, config.normalization.tax.year) ?? config.year ?? 2023),
          tax_type: String(pickColumn(row, config.normalization.tax.taxType) ?? '').trim(),
          state_tax_revenue: parseNumeric(pickColumn(row, config.normalization.tax.stateTaxRevenue)),
          local_tax_revenue: parseNumeric(pickColumn(row, config.normalization.tax.localTaxRevenue)),
        }))
        .filter((row) => row.state && row.tax_type && VALID_STATES.has(row.state))

  // ── Population normalization — pivot POPESTIMATE{year} columns ──
  // The NST-EST2023-ALLDATA.csv is wide-format: one row per state,
  // with columns POPESTIMATE2020, POPESTIMATE2021, POPESTIMATE2022, POPESTIMATE2023.
  // We emit one normalized row per state per year.
  const populationRows = await parseSourceRows(config.downloads.population)
  const normalizedPopulationRows = []
  for (const row of populationRows) {
    const state = normalizeState(pickColumn(row, config.normalization.population.state))
    if (!state || !VALID_STATES.has(state)) continue
    for (const year of years) {
      const colName = `POPESTIMATE${year}`
      const rawValue = row[colName]
      if (rawValue === undefined || rawValue === null || rawValue === '') continue
      const population = Math.round(parseNumeric(rawValue))
      if (population > 0) normalizedPopulationRows.push({ state, year, population })
    }
  }

  // ── Income normalization — one file per year ──
  // Files are named census-acs-income-source-{year}.json and contain Census API JSON format.
  const normalizedIncomeRows = []
  for (const year of years) {
    const relativePath = path.join(
      config.downloads.incomeDir,
      `census-acs-income-source-${year}.json`,
    )
    let incomeRows
    try {
      incomeRows = await parseSourceRows(path.relative(projectRoot, relativePath))
    } catch (e) {
      console.warn(`Skipping income data for ${year}: ${e.message}`)
      continue
    }
    for (const row of incomeRows) {
      const state = normalizeState(row.NAME ?? row.state ?? '')
      if (!state || !VALID_STATES.has(state)) continue
      const income = Math.round(parseNumeric(row.B19301_001E ?? row.per_capita_income ?? 0))
      if (income > 0) normalizedIncomeRows.push({ state, year, per_capita_income: income })
    }
  }

  if (!normalizedTaxRows.length) throw new Error('Tax normalization produced zero rows.')
  if (!normalizedPopulationRows.length) throw new Error('Population normalization produced zero rows.')
  if (!normalizedIncomeRows.length) throw new Error('Income normalization produced zero rows.')

  const taxOutput = await writeCsv(config.normalizedOutputs.tax, normalizedTaxRows, [
    'state', 'year', 'tax_type', 'state_tax_revenue', 'local_tax_revenue',
  ])
  const populationOutput = await writeCsv(config.normalizedOutputs.population, normalizedPopulationRows, [
    'state', 'year', 'population',
  ])
  const incomeOutput = await writeCsv(config.normalizedOutputs.income, normalizedIncomeRows, [
    'state', 'year', 'per_capita_income',
  ])

  const taxYears = new Set(normalizedTaxRows.map((r) => r.year))
  const popYears = new Set(normalizedPopulationRows.map((r) => r.year))
  const incYears = new Set(normalizedIncomeRows.map((r) => r.year))

  console.log(`Normalized tax rows: ${normalizedTaxRows.length} across years ${[...taxYears].sort().join(', ')} -> ${path.relative(projectRoot, taxOutput)}`)
  console.log(`Normalized population rows: ${normalizedPopulationRows.length} across years ${[...popYears].sort().join(', ')} -> ${path.relative(projectRoot, populationOutput)}`)
  console.log(`Normalized income rows: ${normalizedIncomeRows.length} across years ${[...incYears].sort().join(', ')} -> ${path.relative(projectRoot, incomeOutput)}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
```

### Step 2: Run the full normalize + ingest pipeline

```bash
node scripts/normalize-census-sources.mjs
```

Expected output (approximate):
```
Normalized tax rows: ~17500 across years 2019, 2020, 2021, 2022, 2023
Normalized population rows: ~200 across years 2020, 2021, 2022, 2023
Normalized income rows: ~250 across years 2019, 2020, 2021, 2022, 2023
```

Note: 2019 population will be absent (NST-EST2023 doesn't have `POPESTIMATE2019`), so only 4 years will appear in population output.

Then re-run ingest:
```bash
node scripts/ingest-state-tax-data.mjs
```

Expected output:
```
Skipping year 2019: missing population data.
Wrote 4 year(s) to public/data/state-tax-summary-2019-2023.json
  2020: 50 states
  2021: 50 states
  2022: 50 states
  2023: 50 states
```

Verify:
```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('public/data/state-tax-summary-2019-2023.json', 'utf8'))
console.log('years:', d.years.map(y => y.year).join(', '))
console.log('yearRange:', d.metadata.yearRange)
console.log('states in 2020:', d.years[0].states.length)
"
```

Expected:
```
years: 2020, 2021, 2022, 2023
yearRange: [ 2020, 2023 ]
states in 2020: 50
```

### Step 3: Run `npm run build` to verify no TS errors

```bash
npm run build
```

Expected: clean build.

### Step 4: Commit

```bash
git add scripts/normalize-census-sources.mjs public/data/state-tax-summary-2019-2023.json
git commit -m "feat: update normalize script for multi-year population pivot and per-year income files"
```

---

## Task 5: Update `src/App.tsx` with year toggle

**Files:**
- Create: `src/App.test.tsx`
- Modify: `src/App.tsx`

### Step 1: Write failing tests

Create `src/App.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { MultiYearPayload } from './types'

const mockPayload: MultiYearPayload = {
  metadata: {
    year: 2023,
    yearRange: [2022, 2023],
    currency: 'USD',
    scope: 'state+local',
    topN: 2,
  },
  taxTypes: [{ key: 'property', label: 'Property' }],
  years: [
    {
      year: 2022,
      states: [
        {
          state: 'California',
          population: 39000000,
          totalRevenue: 300000,
          perCapitaTotal: 7,
          perCapitaIncome: 78000,
          breakdown: { property: 300000 },
        },
        {
          state: 'Texas',
          population: 30000000,
          totalRevenue: 200000,
          perCapitaTotal: 6,
          perCapitaIncome: 62000,
          breakdown: { property: 200000 },
        },
      ],
    },
    {
      year: 2023,
      states: [
        {
          state: 'California',
          population: 39500000,
          totalRevenue: 999000,
          perCapitaTotal: 25,
          perCapitaIncome: 80000,
          breakdown: { property: 999000 },
        },
        {
          state: 'Texas',
          population: 30500000,
          totalRevenue: 500000,
          perCapitaTotal: 16,
          perCapitaIncome: 65000,
          breakdown: { property: 500000 },
        },
      ],
    },
  ],
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockPayload),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Year toggle', () => {
  it('renders a toggle button for each year in the payload', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: '2022' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2023' })).toBeInTheDocument()
  })

  it('defaults to the most recent year (last entry in years array)', async () => {
    render(<App />)
    const btn = await screen.findByRole('button', { name: '2023' })
    expect(btn.className).toContain('active')
    expect(screen.getByRole('button', { name: '2022' }).className).not.toContain('active')
  })

  it('switches active year when a year button is clicked', async () => {
    render(<App />)
    await screen.findByRole('button', { name: '2022' })
    await userEvent.click(screen.getByRole('button', { name: '2022' }))
    expect(screen.getByRole('button', { name: '2022' }).className).toContain('active')
    expect(screen.getByRole('button', { name: '2023' }).className).not.toContain('active')
  })

  it('summary card shows the selected year, not always the most recent', async () => {
    render(<App />)
    // Default is 2023
    expect(await screen.findByText('2023')).toBeInTheDocument()
    // Switch to 2022
    await userEvent.click(screen.getByRole('button', { name: '2022' }))
    expect(screen.getByText('2022')).toBeInTheDocument()
  })
})
```

### Step 2: Run tests to verify they fail

```bash
npm test src/App.test.tsx
```

Expected: FAIL — `Cannot find module './App'` or tests fail because App does not yet render year buttons.

### Step 3: Update `src/App.tsx`

Make the following targeted changes. Read the full file first, then apply each change.

**Change 1 — update the import:**

Replace:
```typescript
import type { DataPayload, Metric } from './types'
```
With:
```typescript
import type { MultiYearPayload, Metric } from './types'
```

**Change 2 — update the data state type:**

Replace:
```typescript
const [data, setData] = useState<DataPayload | null>(null)
```
With:
```typescript
const [data, setData] = useState<MultiYearPayload | null>(null)
```

**Change 3 — add selectedYear state, directly after the data/error/metric/hoveredState state declarations:**

Add after `const [hoveredState, setHoveredState] = useState<string | null>(null)`:
```typescript
const [selectedYear, setSelectedYear] = useState<number | null>(null)
```

**Change 4 — initialize selectedYear when data loads:**

In the `loadData` function, after `setData(payload)`, add:
```typescript
setSelectedYear(payload.years[payload.years.length - 1].year)
```

**Change 5 — update the fetch candidate path:**

Replace:
```typescript
const candidates = [`${base}data/state-tax-summary-2023.json`, `${base}data/state-tax-summary-sample.json`]
```
With:
```typescript
const candidates = [`${base}data/state-tax-summary-2019-2023.json`, `${base}data/state-tax-summary-sample.json`]
```

**Change 6 — derive activeStates from selectedYear:**

Replace the `sortedStates` useMemo:
```typescript
const sortedStates = useMemo(() => {
  if (!data) {
    return []
  }

  return [...data.states].sort((a, b) => {
    return getMetricValue(b, metric) - getMetricValue(a, metric)
  })
}, [data, metric])
```
With:
```typescript
const activeStates = useMemo(() => {
  if (!data || selectedYear == null) return []
  return data.years.find((y) => y.year === selectedYear)?.states ?? []
}, [data, selectedYear])

const sortedStates = useMemo(() => {
  return [...activeStates].sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
}, [activeStates, metric])
```

**Change 7 — update summary card to show selectedYear:**

Replace:
```typescript
<p>{data.metadata.year}</p>
```
With:
```typescript
<p>{selectedYear ?? data.metadata.year}</p>
```

**Change 8 — add year toggle row above the chart-map row:**

Add the following immediately before `<div className="chart-map-row">`:
```tsx
<div className="metric-toggle year-toggle" role="group" aria-label="Year selector">
  {data.years.map((yr) => (
    <button
      key={yr.year}
      type="button"
      className={selectedYear === yr.year ? 'active' : ''}
      onClick={() => setSelectedYear(yr.year)}
    >
      {yr.year}
    </button>
  ))}
</div>
```

**Change 9 — pass states to PersonalCalculator from the 2023 year record (always pinned):**

Replace:
```tsx
<PersonalCalculator states={data.states} />
```
With:
```tsx
<PersonalCalculator states={data.years.find((y) => y.year === 2023)?.states ?? activeStates} />
```

### Step 4: Run tests to verify they pass

```bash
npm test src/App.test.tsx
```

Expected: all 4 tests PASS.

### Step 5: Run all tests

```bash
npm test
```

Expected: all tests PASS (40 existing + 4 new = 44 total).

### Step 6: Verify the build

```bash
npm run build
```

Expected: no TypeScript errors.

### Step 7: Manual smoke test

```bash
npm run dev
```

Open `http://localhost:5173/state-tax-app/` and verify:
- [ ] Year toggle row appears above the chart-map row showing available years (2020, 2021, 2022, 2023 if full pipeline ran; or 2022, 2023 if sample file is used)
- [ ] Most recent year is active by default
- [ ] Clicking a different year changes the bar chart and map
- [ ] Summary card "Year" reflects the selected year
- [ ] Personal Calculator is unaffected by year toggle
- [ ] All existing metrics (Total, Per capita, % of income) still work per year

### Step 8: Commit

```bash
git add src/App.test.tsx src/App.tsx
git commit -m "feat: add year toggle to App — switches bar chart, map, and table by year"
```
