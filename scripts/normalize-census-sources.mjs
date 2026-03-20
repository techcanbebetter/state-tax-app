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

// FIPS code → state name mapping (50 states; DC excluded as it's not in VALID_STATES)
const FIPS_TO_STATE = {
  '01': 'Alabama',       '02': 'Alaska',        '04': 'Arizona',       '05': 'Arkansas',
  '06': 'California',    '08': 'Colorado',       '09': 'Connecticut',   '10': 'Delaware',
  '12': 'Florida',       '13': 'Georgia',        '15': 'Hawaii',        '16': 'Idaho',
  '17': 'Illinois',      '18': 'Indiana',        '19': 'Iowa',          '20': 'Kansas',
  '21': 'Kentucky',      '22': 'Louisiana',      '23': 'Maine',         '24': 'Maryland',
  '25': 'Massachusetts', '26': 'Michigan',       '27': 'Minnesota',     '28': 'Mississippi',
  '29': 'Missouri',      '30': 'Montana',        '31': 'Nebraska',      '32': 'Nevada',
  '33': 'New Hampshire', '34': 'New Jersey',     '35': 'New Mexico',    '36': 'New York',
  '37': 'North Carolina','38': 'North Dakota',   '39': 'Ohio',          '40': 'Oklahoma',
  '41': 'Oregon',        '42': 'Pennsylvania',   '44': 'Rhode Island',  '45': 'South Carolina',
  '46': 'South Dakota',  '47': 'Tennessee',      '48': 'Texas',         '49': 'Utah',
  '50': 'Vermont',       '51': 'Virginia',       '53': 'Washington',    '54': 'West Virginia',
  '55': 'Wisconsin',     '56': 'Wyoming',
}

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

const SPENDING_LF_CODES = new Set([
  'LF0090', // Total General Expenditure (spendingTotal)
  'LF0106', // Education
  'LF0122', // Public Welfare
  'LF0128', // Hospitals
  'LF0131', // Health
  'LF0140', // Highways
  'LF0152', // Police Protection
  'LF0158', // Correction
  'LF0164', // Natural Resources
  'LF0167', // Parks and Recreation
])

const normalizeSpendingFromCensusApiRows = (rows, config) => {
  const bucket = new Map()

  for (const row of rows) {
    const state = normalizeState(row.NAME ?? row.state ?? row.State)
    const year = Number(row.YEAR ?? row.year ?? config.year)
    const code = String(row.AGG_DESC ?? '').trim()
    const govType = String(row.GOVTYPE ?? '').trim()

    if (!state || !VALID_STATES.has(state) || !SPENDING_LF_CODES.has(code) || !['002', '003'].includes(govType)) {
      continue
    }

    const amount = parseNumeric(row.AMOUNT)
    const mapKey = `${state}||${year}||${code}`
    const current = bucket.get(mapKey) ?? { state, year, lf_code: code, amount: 0 }
    current.amount += amount
    bucket.set(mapKey, current)
  }

  return [...bucket.values()]
}

const REVENUE_EXTENDED_LF_CODES = new Set([
  'LF0001', // Total Revenue
  'LF0004', // Federal intergovernmental revenue
  'LF0040', // Current charges (fees)
  'LF0058', // Miscellaneous general revenue
  'LF0068', // Utility revenue
  'LF0074', // Insurance trust revenue
])

const normalizeRevenueExtendedFromCensusApiRows = (rows) => {
  const bucket = new Map()

  for (const row of rows) {
    const state = normalizeState(row.NAME ?? row.state ?? row.State)
    const year = Number(row.YEAR ?? row.year)
    const code = String(row.AGG_DESC ?? '').trim()
    const govType = String(row.GOVTYPE ?? '').trim()

    if (!state || !VALID_STATES.has(state) || !REVENUE_EXTENDED_LF_CODES.has(code) || !['002', '003'].includes(govType)) {
      continue
    }

    const amount = parseNumeric(row.AMOUNT)
    const mapKey = `${state}||${year}||${code}`
    const current = bucket.get(mapKey) ?? { state, year, lf_code: code, amount: 0 }
    current.amount += amount
    bucket.set(mapKey, current)
  }

  return [...bucket.values()]
}

const GRANT_B_CODES = new Set([
  'B79', 'B21', 'B42', 'B43', 'B46', 'B01',
  'B22', 'B30', 'B50', 'B54', 'B59', 'B80', 'B89',
])

const normalizeFederalGrantsBreakdown = async (config) => {
  const years = config.years ?? [config.year]
  const outputTemplate = config.downloads?.individualUnitFileByYear ?? ''

  if (!outputTemplate) {
    console.warn('No individualUnitFileByYear path configured — skipping federal grants breakdown.')
    return []
  }

  // key: `${stateName}||${year}||${bCode}` → accumulated amount in thousands
  const bucket = new Map()

  for (const year of years) {
    const txtPath = path.resolve(projectRoot, outputTemplate.replace('{year}', year))
    let content
    try {
      content = await readFile(txtPath, 'utf8')
    } catch {
      console.warn(
        `Individual Unit File for ${year} not found at ${path.relative(projectRoot, txtPath)} — skipping year.`,
      )
      continue
    }

    for (const rawLine of content.split('\n')) {
      // Trim CRLF: Census flat files use Windows line endings; strip \r before slicing positions
      const line = rawLine.trimEnd()
      if (line.length < 27) continue

      const fips = line.substring(0, 2)
      const unitId = line.substring(2, 12)
      const bCode = line.substring(12, 15).trim()
      const amountStr = line.substring(15, 27).trim()

      // State-government rows only: unit ID starts with '0000'
      if (!unitId.startsWith('0000')) continue
      // Only capture the 13 B-codes we care about
      if (!GRANT_B_CODES.has(bCode)) continue

      const stateName = FIPS_TO_STATE[fips]
      if (!stateName || !VALID_STATES.has(stateName)) continue

      const amount = Number(amountStr)
      if (!Number.isFinite(amount) || amount < 0) continue

      const key = `${stateName}||${year}||${bCode}`
      bucket.set(key, (bucket.get(key) ?? 0) + amount)
    }
  }

  return [...bucket.entries()].map(([key, amount_thousands]) => {
    const [state, yearStr, b_code] = key.split('||')
    return { state, year: Number(yearStr), b_code, amount_thousands }
  })
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
  const years = config.years ?? [config.year]

  // Tax: read one file per year and combine all rows
  const allTaxApiRows = []
  for (const year of years) {
    const taxFilePath = config.downloads.taxByYear.replace('{year}', year)
    const yearRows = await parseSourceRows(taxFilePath)
    allTaxApiRows.push(...yearRows)
  }
  const taxRows = allTaxApiRows

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

  // Spending: reuse the same allTaxApiRows (already contains expenditure LF codes)
  const normalizedSpendingRows = taxRowsLookLikeCensusApi
    ? normalizeSpendingFromCensusApiRows(taxRows, config)
    : []

  if (taxRowsLookLikeCensusApi && normalizedSpendingRows.length === 0) {
    console.warn('Spending normalization produced zero rows. Check LF code availability in the raw Census files.')
  }

  const normalizedRevenueExtendedRows = taxRowsLookLikeCensusApi
    ? normalizeRevenueExtendedFromCensusApiRows(allTaxApiRows)
    : []

  if (taxRowsLookLikeCensusApi && normalizedRevenueExtendedRows.length === 0) {
    console.warn('Revenue-extended normalization produced zero rows. Check LF code availability in raw Census files.')
  }

  // Population: pivot wide-format CSV — one row per (state, year) using POPESTIMATE{year} columns
  const normalizedPopulationRows = []
  for (const row of populationRows) {
    const state = normalizeState(pickColumn(row, config.normalization.population.state))
    if (!state || !VALID_STATES.has(state)) {
      continue
    }

    for (const year of years) {
      const pop = parseNumeric(row[`POPESTIMATE${year}`])
      if (pop > 0) {
        normalizedPopulationRows.push({ state, year, population: Math.round(pop) })
      }
    }
  }

  // Income: read one file per year; some years may be absent (e.g. 2020 ACS 1-year was cancelled)
  const normalizedIncomeRows = []
  for (const year of years) {
    const incomeFilePath = config.downloads.incomeByYear.replace('{year}', year)
    let yearIncomeRows
    try {
      yearIncomeRows = await parseSourceRows(incomeFilePath)
    } catch {
      console.warn(`Skipping income normalization for ${year}: file not found.`)
      continue
    }
    for (const row of yearIncomeRows) {
      const state = normalizeState(row.NAME ?? row.state ?? '')
      if (!state || !VALID_STATES.has(state)) {
        continue
      }

      const per_capita_income = Math.round(parseNumeric(row.B19301_001E ?? row.per_capita_income ?? 0))
      if (per_capita_income > 0) {
        normalizedIncomeRows.push({ state, year, per_capita_income })
      }
    }
  }

  if (!normalizedIncomeRows.length) {
    throw new Error('Income normalization produced zero rows. Check data/raw/downloads/census-acs-income-source-*.json.')
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

  const spendingOutput = await writeCsv(config.normalizedOutputs.spending, normalizedSpendingRows, [
    'state',
    'year',
    'lf_code',
    'amount',
  ])
  console.log(`Normalized tax rows: ${normalizedTaxRows.length} -> ${path.relative(projectRoot, taxOutput)}`)
  console.log(
    `Normalized population rows: ${normalizedPopulationRows.length} -> ${path.relative(projectRoot, populationOutput)}`,
  )
  console.log(`Normalized income rows: ${normalizedIncomeRows.length} -> ${path.relative(projectRoot, incomeOutput)}`)
  console.log(`Normalized spending rows: ${normalizedSpendingRows.length} -> ${path.relative(projectRoot, spendingOutput)}`)

  const revenueExtendedOutput = await writeCsv(
    config.normalizedOutputs.revenueExtended,
    normalizedRevenueExtendedRows,
    ['state', 'year', 'lf_code', 'amount'],
  )
  console.log(
    `Normalized revenue-extended rows: ${normalizedRevenueExtendedRows.length} -> ${path.relative(projectRoot, revenueExtendedOutput)}`,
  )

  const grantsBreakdownRows = await normalizeFederalGrantsBreakdown(config)
  if (grantsBreakdownRows.length === 0) {
    console.warn(
      'Federal grants breakdown produced zero rows — Individual Unit Files may not be downloaded yet.',
    )
  }

  const grantsBreakdownOutput = await writeCsv(
    config.normalizedOutputs.federalGrantsBreakdown,
    grantsBreakdownRows,
    ['state', 'year', 'b_code', 'amount_thousands'],
  )
  console.log(
    `Normalized federal grants breakdown rows: ${grantsBreakdownRows.length} -> ${path.relative(projectRoot, grantsBreakdownOutput)}`,
  )
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
