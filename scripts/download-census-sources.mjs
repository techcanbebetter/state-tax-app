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

  const taxUrl = ensureUrl(config.sources?.tax?.url, 'tax source')
  const populationUrl = ensureUrl(config.sources?.population?.url, 'population source')

  const taxOutput = await downloadTo(taxUrl, config.downloads.tax)
  const populationOutput = await downloadTo(populationUrl, config.downloads.population)

  const incomeUrl = ensureUrl(config.sources?.income?.url, 'income source')
  const incomeOutput = await downloadTo(incomeUrl, config.downloads.income)

  console.log(`Downloaded tax source: ${path.relative(projectRoot, taxOutput)}`)
  console.log(`Downloaded population source: ${path.relative(projectRoot, populationOutput)}`)
  console.log(`Downloaded income source: ${path.relative(projectRoot, incomeOutput)}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
