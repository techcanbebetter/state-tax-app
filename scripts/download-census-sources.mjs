import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

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

  // Income: one download per year — some years may be unavailable (e.g. 2020 ACS 1-year was cancelled)
  const incomeUrlTemplate = ensureUrl(config.sources?.income?.urlTemplate, 'income source urlTemplate')
  for (const year of years) {
    const incomeUrl = incomeUrlTemplate.replace('{year}', year)
    const incomeOutputPath = config.downloads.incomeByYear.replace('{year}', year)
    try {
      const incomeOutput = await downloadTo(incomeUrl, incomeOutputPath)
      console.log(`Downloaded income source (${year}): ${path.relative(projectRoot, incomeOutput)}`)
    } catch (err) {
      console.warn(`Skipping income data for ${year}: ${err.message}`)
    }
  }

  // Individual Unit Files: one ZIP per year — download, unzip, extract the .txt file
  const unitFileUrls = config.sources?.individualUnitFiles?.urls ?? {}
  const unitFileOutputTemplate = config.downloads?.individualUnitFileByYear ?? ''

  if (Object.keys(unitFileUrls).length > 0 && unitFileOutputTemplate) {
    for (const year of years) {
      const unitOutputPath = path.resolve(projectRoot, unitFileOutputTemplate.replace('{year}', year))

      // Skip if already downloaded (these ZIPs are ~4 MB each)
      try {
        await readFile(unitOutputPath)
        console.log(`Individual Unit File (${year}): already downloaded, skipping.`)
        continue
      } catch {
        // File does not exist — proceed with download
      }

      const url = unitFileUrls[String(year)]
      if (!url) {
        console.warn(`No Individual Unit File URL configured for year ${year}, skipping.`)
        continue
      }

      console.log(`Downloading Individual Unit File (${year})...`)
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Download failed (${response.status}) for ${url}`)
      }

      const buffer = await response.arrayBuffer()
      const zip = new AdmZip(Buffer.from(buffer))
      const txtEntry = zip.getEntries().find((e) => e.entryName.endsWith('.txt'))
      if (!txtEntry) {
        throw new Error(`No .txt file found in ZIP for year ${year}: ${url}`)
      }

      const content = txtEntry.getData().toString('utf8')
      await mkdir(path.dirname(unitOutputPath), { recursive: true })
      await writeFile(unitOutputPath, content, 'utf8')
      console.log(`Downloaded Individual Unit File (${year}): ${path.relative(projectRoot, unitOutputPath)}`)
    }
  }

  // F-33: one file per year, skip if already downloaded
  const f33UrlTemplate = config.sources?.f33?.urlTemplate ?? ''
  const f33OutputTemplate = config.downloads?.f33ByYear ?? ''

  if (f33UrlTemplate && f33OutputTemplate) {
    for (const year of years) {
      const f33OutputPath = path.resolve(projectRoot, f33OutputTemplate.replace('{year}', year))

      try {
        await readFile(f33OutputPath)
        console.log(`F-33 (${year}): already downloaded, skipping.`)
        continue
      } catch {
        // File does not exist — proceed
      }

      const yy = String(year).slice(-2)
      const f33Url = f33UrlTemplate.replace('{year}', year).replace('{yy}', yy)
      console.log(`Downloading F-33 (${year})...`)
      const f33Output = await downloadTo(f33Url, f33OutputTemplate.replace('{year}', year))
      console.log(`Downloaded F-33 (${year}): ${path.relative(projectRoot, f33Output)}`)
    }
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
