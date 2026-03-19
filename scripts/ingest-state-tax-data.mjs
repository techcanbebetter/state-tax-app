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
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
])

const parseNumeric = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (!value) {
    return 0
  }

  const normalized = String(value)
    .replace(/[$,]/g, '')
    .replace(/\((.*)\)/, '-$1')
    .trim()

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeState = (value) => String(value ?? '').trim()

const toTaxTypeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const readCsv = async (filePath) => {
  let content

  try {
    content = await readFile(filePath, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      const relativePath = path.relative(projectRoot, filePath)
      throw new Error(
        `Missing required source file: ${relativePath}. Add it under data/raw and run npm run data:ingest again.`,
      )
    }

    throw error
  }

  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  })

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
  const years = config.years ?? [2023]

  const taxCsvPath = path.resolve(projectRoot, config.input.taxByTypeCsv)
  const populationCsvPath = path.resolve(projectRoot, config.input.populationCsv)
  const incomeCsvPath = path.resolve(projectRoot, config.input.incomeCsv)

  const taxRows = await readCsv(taxCsvPath)
  const populationRows = await readCsv(populationCsvPath)
  const incomeRows = await readCsv(incomeCsvPath)

  // Spending: read gracefully — missing file is non-fatal (older dataset without spending data)
  const spendingCsvPath = path.resolve(projectRoot, config.input.spendingByFunctionCsv)
  let spendingRows = []
  try {
    spendingRows = await readCsv(spendingCsvPath)
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('Spending CSV not found — spendingTotal and spendingBreakdown will be 0 for all states.')
    } else {
      throw err
    }
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

  const taxColumns = config.columns.tax
  const populationColumns = config.columns.population
  const incomeColumns = config.columns.income

  // Build population map keyed by `${state}||${year}`
  const populationByStateYear = new Map()
  for (const row of populationRows) {
    const rowYear = Number(row[populationColumns.year])
    const state = normalizeState(row[populationColumns.state])
    if (!state || !VALID_STATES.has(state) || !Number.isFinite(rowYear)) {
      continue
    }

    const population = parseNumeric(row[populationColumns.population])
    if (population > 0) {
      populationByStateYear.set(`${state}||${rowYear}`, population)
    }
  }

  if (!populationByStateYear.size) {
    throw new Error('No population rows found across any year.')
  }

  // Build income map keyed by `${state}||${year}`
  const incomeByStateYear = new Map()
  for (const row of incomeRows) {
    const rowYear = Number(row[incomeColumns.year])
    const state = normalizeState(row[incomeColumns.state])
    if (!state || !VALID_STATES.has(state) || !Number.isFinite(rowYear)) {
      continue
    }

    const income = parseNumeric(row[incomeColumns.perCapitaIncome])
    if (income > 0) {
      incomeByStateYear.set(`${state}||${rowYear}`, income)
    }
  }

  if (!incomeByStateYear.size) {
    throw new Error('No per-capita income rows found across any year.')
  }

  // Determine top N states by population in the latest available year
  const latestPopYear = Math.max(...[...populationByStateYear.keys()].map((k) => Number(k.split('||')[1])))
  const latestYearPopulation = new Map()
  for (const [key, pop] of populationByStateYear) {
    const [state, yearStr] = key.split('||')
    if (Number(yearStr) === latestPopYear) {
      latestYearPopulation.set(state, pop)
    }
  }

  if (!latestYearPopulation.size) {
    throw new Error(`No population rows found for latest year ${latestPopYear}.`)
  }

  const topStates = [...latestYearPopulation.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.topNStates)
    .map(([state]) => state)

  const topStateSet = new Set(topStates)

  // Determine canonical tax type order from all rows (stable across years)
  const taxTypeOrder = []
  const taxTypeSeen = new Set()
  for (const row of taxRows) {
    const rawTaxType = String(row[taxColumns.taxType] ?? '').trim()
    if (!rawTaxType) continue

    const taxTypeKey = config.taxTypeMap?.[rawTaxType] ?? toTaxTypeKey(rawTaxType)
    if (!taxTypeSeen.has(taxTypeKey)) {
      taxTypeSeen.add(taxTypeKey)
      taxTypeOrder.push(taxTypeKey)
    }
  }

  // Build states array per year — inner join: skip any year missing population or income data
  const yearsOutput = []
  for (const year of years) {
    // Check that all 50 top states have population and income for this year
    const hasPopulation = topStates.every((s) => populationByStateYear.has(`${s}||${year}`))
    const hasIncome = topStates.some((s) => incomeByStateYear.has(`${s}||${year}`))
    if (!hasPopulation || !hasIncome) {
      console.warn(`Skipping year ${year}: missing ${!hasPopulation ? 'population' : 'income'} data.`)
      continue
    }

    const stateAggregation = new Map()

    for (const row of taxRows) {
      const rowYear = Number(row[taxColumns.year])
      if (Number.isFinite(rowYear) && rowYear !== year) {
        continue
      }

      const state = normalizeState(row[taxColumns.state])
      if (!topStateSet.has(state)) {
        continue
      }

      const rawTaxType = String(row[taxColumns.taxType] ?? '').trim()
      if (!rawTaxType) {
        continue
      }

      const taxTypeKey = config.taxTypeMap?.[rawTaxType] ?? toTaxTypeKey(rawTaxType)

      // Census finance data is in thousands of dollars — convert to dollars
      const stateTax = parseNumeric(row[taxColumns.stateTaxRevenue]) * 1000
      const localTax = parseNumeric(row[taxColumns.localTaxRevenue]) * 1000
      const totalTax = stateTax + localTax

      const existing =
        stateAggregation.get(state) ?? {
          state,
          population: populationByStateYear.get(`${state}||${year}`) ?? 0,
          totalRevenue: 0,
          breakdown: {},
        }

      existing.breakdown[taxTypeKey] = (existing.breakdown[taxTypeKey] ?? 0) + totalTax
      existing.totalRevenue += totalTax

      stateAggregation.set(state, existing)
    }

    const states = [...stateAggregation.values()]
      .map((state) => {
        const population = state.population || 0
        const perCapitaTotal = population > 0 ? state.totalRevenue / population : 0
        const perCapitaIncome = incomeByStateYear.get(`${state.state}||${year}`) ?? 0

        const spendingCategoryMap = config.spendingCategoryMap ?? {}
        const spendingTotal_fromLF0090 = spendingByStateYearCode.get(`${state.state}||${year}||LF0090`) ?? 0
        const spendingBreakdown = {}
        for (const [lfCode, category] of Object.entries(spendingCategoryMap)) {
          const amount = spendingByStateYearCode.get(`${state.state}||${year}||${lfCode}`) ?? 0
          spendingBreakdown[category] = (spendingBreakdown[category] ?? 0) + amount
        }
        const categoriesSum = Object.values(spendingBreakdown).reduce((s, v) => s + v, 0)
        // Fallback: if LF0090 missing (pre-2022 data), derive total from breakdown categories
        const spendingTotal = spendingTotal_fromLF0090 > 0 ? spendingTotal_fromLF0090 : categoriesSum
        // 'other' is only meaningful when LF0090 is present; if using fallback, other = 0
        spendingBreakdown.other = spendingTotal_fromLF0090 > 0 ? Math.max(0, spendingTotal - categoriesSum) : 0

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
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    yearsOutput.push({ year, states })
  }

  const outputYears = yearsOutput.map((y) => y.year)
  const yearRange = [Math.min(...outputYears), Math.max(...outputYears)]

  const payload = {
    metadata: {
      year: Math.max(...outputYears),
      yearRange,
      currency: 'USD',
      scope: 'state+local',
      topN: config.topNStates,
      notes: [
        'Nominal dollars.',
        'Top states selected by population for the latest year.',
      ],
      generatedAt: new Date().toISOString(),
    },
    taxTypes: taxTypeOrder.map((key) => ({
      key,
      label: config.taxTypeLabels?.[key] ?? key,
    })),
    spendingTypes: config.spendingCategoryLabels
      ? Object.entries(config.spendingCategoryLabels).map(([key, label]) => ({ key, label }))
      : [],
    years: yearsOutput,
  }

  const outputPath = path.resolve(projectRoot, config.output.json)
  await writeFile(outputPath, JSON.stringify(payload, null, 2))

  const totalStates = yearsOutput.reduce((sum, y) => sum + y.states.length, 0)
  console.log(`Wrote ${yearsOutput.length} years (${totalStates} state-year records) to ${path.relative(projectRoot, outputPath)}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
