# State + Local Tax Data Source Catalog (First Pass)

This project is currently configured for **one year** in **nominal dollars**.

## Primary sources

1. **U.S. Census Bureau — Annual Survey of State and Local Government Finances**
   - Current pipeline uses Census API endpoint for `SVY_COMP=04` (Annual Survey of State and Local Finance):
   - `https://api.census.gov/data/timeseries/govs?get=NAME,GOVTYPE,GOVTYPE_LABEL,AGG_DESC,AGG_DESC_LABEL,AMOUNT,YEAR&for=state:*&time=2023&SVY_COMP=04`
   - Normalization maps Census `AGG_DESC` tax codes to app tax categories and separates `GOVTYPE` 002 (state) vs 003 (local).

2. **U.S. Census Bureau — Annual State Population Estimates**
   - Use state population for the same reference year used by the tax file.

3. **U.S. Census Bureau — ACS 1-Year 2023, Per Capita Income by State**
   - Census ACS API endpoint (DEMO_KEY supported):
   - `https://api.census.gov/data/2023/acs/acs1?get=NAME,B19301_001E&for=state:*`
   - `B19301_001E` = Per capita income in the past 12 months (2023 inflation-adjusted dollars).
   - Normalized to `state,year,per_capita_income` CSV before ingestion.

## Expected local CSV schema

### Tax file (`data/raw/state-local-tax-by-type.csv`)

- `state`
- `year`
- `tax_type`
- `state_tax_revenue`
- `local_tax_revenue`

### Population file (`data/raw/state-population.csv`)

- `state`
- `year`
- `population`

### Income file (`data/raw/state-per-capita-income.csv`)

- `state`
- `year`
- `per_capita_income` (actual dollars, not thousands)

If your source column names differ, update `data/config/ingestion.config.json`.

## Automated refresh workflow

1. Set source URLs in `data/config/source-download.config.json`
2. Confirm alias mappings for both datasets in the same config file
3. Run:

```bash
npm run data:refresh
```

This downloads source files, normalizes them, and generates final app JSON.
