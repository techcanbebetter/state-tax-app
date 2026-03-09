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
  const taxCsvPath = path.resolve(projectRoot, config.input.taxByTypeCsv)
  const populationCsvPath = path.resolve(projectRoot, config.input.populationCsv)

  const incomeCsvPath = path.resolve(projectRoot, config.input.incomeCsv)

  const taxRows = await readCsv(taxCsvPath)
  const populationRows = await readCsv(populationCsvPath)
  const incomeRows = await readCsv(incomeCsvPath)

  const taxColumns = config.columns.tax
  const populationColumns = config.columns.population
  const incomeColumns = config.columns.income

  const populationByState = new Map()

  for (const row of populationRows) {
    const rowYear = Number(row[populationColumns.year])
    if (Number.isFinite(rowYear) && rowYear !== config.year) {
      continue
    }

    const state = normalizeState(row[populationColumns.state])
    if (!state || !VALID_STATES.has(state)) {
      continue
    }

    const population = parseNumeric(row[populationColumns.population])
    if (population > 0) {
      populationByState.set(state, population)
    }
  }

  if (!populationByState.size) {
    throw new Error(`No population rows found for year ${config.year}.`)
  }

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

  const topStates = [...populationByState.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.topNStates)
    .map(([state]) => state)

  const topStateSet = new Set(topStates)

  const stateAggregation = new Map()
  const taxTypeOrder = []
  const taxTypeSeen = new Set()

  for (const row of taxRows) {
    const rowYear = Number(row[taxColumns.year])
    if (Number.isFinite(rowYear) && rowYear !== config.year) {
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
    if (!taxTypeSeen.has(taxTypeKey)) {
      taxTypeSeen.add(taxTypeKey)
      taxTypeOrder.push(taxTypeKey)
    }

    const stateTax = parseNumeric(row[taxColumns.stateTaxRevenue])
    const localTax = parseNumeric(row[taxColumns.localTaxRevenue])
    const totalTax = stateTax + localTax

    const existing =
      stateAggregation.get(state) ?? {
        state,
        population: populationByState.get(state) ?? 0,
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
      const perCapitaIncome = perCapitaIncomeByState.get(state.state) ?? 0

      return {
        ...state,
        totalRevenue: Math.round(state.totalRevenue),
        perCapitaTotal: Number(perCapitaTotal.toFixed(2)),
        perCapitaIncome,
      }
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)

  const payload = {
    metadata: {
      year: config.year,
      currency: 'USD',
      scope: 'state+local',
      topN: config.topNStates,
      notes: [
        'Nominal dollars.',
        'Top states selected by population for the same year.',
      ],
      generatedAt: new Date().toISOString(),
    },
    taxTypes: taxTypeOrder.map((key) => ({
      key,
      label: config.taxTypeLabels?.[key] ?? key,
    })),
    states,
  }

  const outputPath = path.resolve(projectRoot, config.output.json)
  await writeFile(outputPath, JSON.stringify(payload, null, 2))

  console.log(`Wrote ${states.length} states to ${path.relative(projectRoot, outputPath)}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
