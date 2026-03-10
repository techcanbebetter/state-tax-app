import type { StateRecord, Metric } from './types'

export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export const numberFormatter = new Intl.NumberFormat('en-US')

export const TAX_COLORS: Record<string, string> = {
  property: '#2563eb',
  sales_general: '#059669',
  sales_selective: '#34d399',
  income_individual: '#d97706',
  income_corporate: '#fbbf24',
  licenses: '#7c3aed',
  other: '#9ca3af',
}

// Revenue values are stored in thousands of dollars (Census Bureau native unit).
// Multiply by 1 000 before display, then abbreviate.
export const compactCurrency = (thousands: number): string => {
  const dollars = thousands * 1000
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(1)}B`
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(1)}M`
  return currencyFormatter.format(dollars)
}

export function getMetricValue(entry: StateRecord, metric: Metric): number {
  if (metric === 'total') return entry.totalRevenue
  if (metric === 'perCapita') return entry.perCapitaTotal
  return entry.perCapitaIncome > 0 ? (entry.perCapitaTotal * 1000) / entry.perCapitaIncome : 0
}

export function formatMetricValue(value: number, metric: Metric): string {
  if (metric === 'total') return compactCurrency(value)
  if (metric === 'perCapita') return `${currencyFormatter.format(value * 1000)} / resident`
  return `${(value * 100).toFixed(1)}% of income`
}
