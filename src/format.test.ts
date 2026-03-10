import { describe, it, expect } from 'vitest'
import { compactCurrency, formatMetricValue, getMetricValue } from './format'
import type { StateRecord } from './types'

const mockState: StateRecord = {
  state: 'California',
  population: 39000000,
  totalRevenue: 500000,   // $500M in thousands
  perCapitaTotal: 12,     // ~$12k per capita in thousands
  perCapitaIncome: 45000, // $45,000 annual income
  breakdown: { property: 100000, income_individual: 200000 },
}

describe('compactCurrency', () => {
  it('formats billions', () => {
    expect(compactCurrency(1000000)).toBe('$1.0B')
  })
  it('formats millions', () => {
    expect(compactCurrency(5000)).toBe('$5.0M')
  })
  it('formats small values as dollars', () => {
    expect(compactCurrency(1)).toBe('$1,000')
  })
})

describe('getMetricValue', () => {
  it('returns totalRevenue for total metric', () => {
    expect(getMetricValue(mockState, 'total')).toBe(500000)
  })
  it('returns perCapitaTotal for perCapita metric', () => {
    expect(getMetricValue(mockState, 'perCapita')).toBe(12)
  })
  it('computes burden ratio for perCapitaBurden metric', () => {
    // (12 * 1000) / 45000 = 0.2667
    expect(getMetricValue(mockState, 'perCapitaBurden')).toBeCloseTo(0.2667, 3)
  })
  it('returns 0 for perCapitaBurden when income is 0', () => {
    expect(getMetricValue({ ...mockState, perCapitaIncome: 0 }, 'perCapitaBurden')).toBe(0)
  })
})

describe('formatMetricValue', () => {
  it('formats total metric as compact currency', () => {
    expect(formatMetricValue(1000000, 'total')).toContain('B')
  })
  it('formats perCapita metric with / resident suffix', () => {
    expect(formatMetricValue(12, 'perCapita')).toContain('/ resident')
  })
  it('formats perCapitaBurden as percentage', () => {
    expect(formatMetricValue(0.2667, 'perCapitaBurden')).toContain('% of income')
  })
})
