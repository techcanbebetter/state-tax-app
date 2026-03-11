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

const ensureUrl = (value, label) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    throw new Error(
      `Missing URL for ${label} in data/config/source-download.config.json. Add source URLs, then re-run npm run data:refresh.`,
    )
  }

  return normalized
}

const downloadTo = async (url, outputRelativePath) => {
  const outputPath = path.resolve(projectRoot, outputRelativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`)
  }

  const text = await response.text()
  if (!text.trim()) {
    throw new Error(`Downloaded file is empty for ${url}`)
  }

  await writeFile(outputPath, text, 'utf8')
  return outputPath
}

const run = async () => {
  const config = await loadConfig()
  const years = config.years ?? [config.year]

  // Population: single download (NST-EST2023-ALLDATA.csv already contains all years)
  const populationUrl = ensureUrl(config.sources?.population?.url, 'population source')
  const populationOutput = await downloadTo(populationUrl, config.downloads.population)
  console.log(`Downloaded population source: ${path.relative(projectRoot, populationOutput)}`)

  // Tax: one download per year
  const taxUrlTemplate = ensureUrl(config.sources?.tax?.urlTemplate, 'tax source urlTemplate')
  for (const year of years) {
    const taxUrl = taxUrlTemplate.replace('{year}', year)
    const taxOutputPath = config.downloads.taxByYear.replace('{year}', year)
    const taxOutput = await downloadTo(taxUrl, taxOutputPath)
    console.log(`Downloaded tax source (${year}): ${path.relative(projectRoot, taxOutput)}`)
  }

  // Income: one download per year
  const incomeUrlTemplate = ensureUrl(config.sources?.income?.urlTemplate, 'income source urlTemplate')
  for (const year of years) {
    const incomeUrl = incomeUrlTemplate.replace('{year}', year)
    const incomeOutputPath = config.downloads.incomeByYear.replace('{year}', year)
    const incomeOutput = await downloadTo(incomeUrl, incomeOutputPath)
    console.log(`Downloaded income source (${year}): ${path.relative(projectRoot, incomeOutput)}`)
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
