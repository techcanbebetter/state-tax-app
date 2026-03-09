import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const configPath = path.join(projectRoot, 'data/config/source-download.config.json')

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

const loadConfig = async () => {
  const content = await readFile(configPath, 'utf8')
  return JSON.parse(content)
}

const parseCsv = async (relativePath) => {
  const filePath = path.resolve(projectRoot, relativePath)
  const content = await readFile(filePath, 'utf8')

  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors?.length) {
    throw new Error(
      `CSV parsing failed for ${relativePath}: ${parsed.errors.map((item) => item.message).join('; ')}`,
    )
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
    headers.forEach((header, index) => {
      output[header] = row[index]
    })
    return output
  })
}

const parseSourceRows = async (relativePath) => {
  const filePath = path.resolve(projectRoot, relativePath)
  const content = await readFile(filePath, 'utf8')
  const trimmed = content.trim()

  if (!trimmed) {
    throw new Error(`Source file is empty: ${relativePath}`)
  }

  if (trimmed.startsWith('[')) {
    return parseCensusApiJson(relativePath)
  }

  return parseCsv(relativePath)
}

const pickColumn = (row, aliases) => {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      return row[alias]
    }
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

    if (!state || !VALID_STATES.has(state) || !code || !['002', '003'].includes(govType)) {
      continue
    }

    let taxType = CENSUS_TAX_CODE_TO_TYPE.get(code)
    if (!taxType && LICENSE_CODES.has(code)) {
      taxType = 'License tax'
    }

    if (!taxType) {
      continue
    }

    const amount = parseNumeric(row.AMOUNT)
    const mapKey = `${state}||${year}||${taxType}`
    const current =
      bucket.get(mapKey) ?? {
        state,
        year,
        tax_type: taxType,
        state_tax_revenue: 0,
        local_tax_revenue: 0,
      }

    if (govType === '002') {
      current.state_tax_revenue += amount
    }

    if (govType === '003') {
      current.local_tax_revenue += amount
    }

    bucket.set(mapKey, current)
  }

  return [...bucket.values()].filter((row) => row.state_tax_revenue > 0 || row.local_tax_revenue > 0)
}

const quoteCsv = (value) => {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

const writeCsv = async (relativePath, rows, columns) => {
  const outputPath = path.resolve(projectRoot, relativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const lines = [columns.join(',')]
  for (const row of rows) {
    lines.push(columns.map((column) => quoteCsv(row[column])).join(','))
  }

  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8')
  return outputPath
}

const run = async () => {
  const config = await loadConfig()

  const taxRows = await parseSourceRows(config.downloads.tax)
  const populationRows = await parseSourceRows(config.downloads.population)

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
          year: Number(pickColumn(row, config.normalization.tax.year) ?? config.year),
          tax_type: String(pickColumn(row, config.normalization.tax.taxType) ?? '').trim(),
          state_tax_revenue: parseNumeric(pickColumn(row, config.normalization.tax.stateTaxRevenue)),
          local_tax_revenue: parseNumeric(pickColumn(row, config.normalization.tax.localTaxRevenue)),
        }))
        .filter((row) => row.state && row.tax_type && VALID_STATES.has(row.state))

  const normalizedPopulationRows = populationRows
    .map((row) => ({
      state: normalizeState(pickColumn(row, config.normalization.population.state)),
      year: Number(pickColumn(row, config.normalization.population.year) ?? config.year),
      population: Math.round(parseNumeric(pickColumn(row, config.normalization.population.population))),
    }))
    .filter((row) => row.state && row.population > 0 && VALID_STATES.has(row.state))

  const incomeRows = await parseSourceRows(config.downloads.income)

  const normalizedIncomeRows = incomeRows
    .map((row) => ({
      state: normalizeState(row.NAME ?? row.state ?? ''),
      year: config.year,
      per_capita_income: Math.round(parseNumeric(row.B19301_001E ?? row.per_capita_income ?? 0)),
    }))
    .filter((row) => row.state && row.per_capita_income > 0 && VALID_STATES.has(row.state))

  if (!normalizedIncomeRows.length) {
    throw new Error('Income normalization produced zero rows. Check data/raw/downloads/bea-income-source.json.')
  }

  if (!normalizedTaxRows.length) {
    throw new Error('Tax normalization produced zero rows. Update aliases in data/config/source-download.config.json.')
  }

  if (!normalizedPopulationRows.length) {
    throw new Error('Population normalization produced zero rows. Update aliases in data/config/source-download.config.json.')
  }

  const taxOutput = await writeCsv(config.normalizedOutputs.tax, normalizedTaxRows, [
    'state',
    'year',
    'tax_type',
    'state_tax_revenue',
    'local_tax_revenue',
  ])

  const populationOutput = await writeCsv(config.normalizedOutputs.population, normalizedPopulationRows, [
    'state',
    'year',
    'population',
  ])

  const incomeOutput = await writeCsv(config.normalizedOutputs.income, normalizedIncomeRows, [
    'state',
    'year',
    'per_capita_income',
  ])

  console.log(`Normalized tax rows: ${normalizedTaxRows.length} -> ${path.relative(projectRoot, taxOutput)}`)
  console.log(
    `Normalized population rows: ${normalizedPopulationRows.length} -> ${path.relative(projectRoot, populationOutput)}`,
  )
  console.log(`Normalized income rows: ${normalizedIncomeRows.length} -> ${path.relative(projectRoot, incomeOutput)}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
