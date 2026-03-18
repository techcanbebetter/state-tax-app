import { describe, it, expect } from 'vitest'
import { compactCurrency, formatMetricValue, getMetricValue } from './format'
import type { StateRecord } from './types'

const mockState: StateRecord = {
  state: 'California',
  population: 39000000,
  totalRevenue: 350000000000,
  perCapitaTotal: 12000,
  perCapitaIncome: 45000,
  breakdown: { property: 100000000000, income_individual: 200000000000 },
  spendingTotal: 280000000000,
  spendingBreakdown: {
    education: 90000000000,
    public_welfare: 60000000000,
    health_hospitals: 45000000000,
    highways: 22000000000,
    police_corrections: 18000000000,
    natural_resources: 12000000000,
    other: 33000000000,
  },
}

describe('compactCurrency', () => {
  it('formats billions', () => {
    expect(compactCurrency(1000000000)).toBe('$1.0B')
  })
  it('formats millions', () => {
    expect(compactCurrency(5000000)).toBe('$5.0M')
  })
  it('formats small values as dollars', () => {
    expect(compactCurrency(1000)).toBe('$1,000')
  })
})

describe('getMetricValue', () => {
  it('returns totalRevenue for total metric', () => {
    expect(getMetricValue(mockState, 'total')).toBe(350000000000)
  })
  it('returns perCapitaTotal for perCapita metric', () => {
    expect(getMetricValue(mockState, 'perCapita')).toBe(12000)
  })
  it('computes burden ratio for perCapitaBurden metric', () => {
    // 12000 / 45000 = 0.2667
    expect(getMetricValue(mockState, 'perCapitaBurden')).toBeCloseTo(0.2667, 3)
  })
  it('returns 0 for perCapitaBurden when income is 0', () => {
    expect(getMetricValue({ ...mockState, perCapitaIncome: 0 }, 'perCapitaBurden')).toBe(0)
  })
})

describe('formatMetricValue', () => {
  it('formats total metric as compact currency', () => {
    expect(formatMetricValue(1000000000, 'total')).toBe('$1.0B')
  })
  it('formats perCapita metric with / resident suffix', () => {
    expect(formatMetricValue(12000, 'perCapita')).toBe('$12,000 / resident')
  })
  it('formats perCapitaBurden as percentage', () => {
    expect(formatMetricValue(0.2667, 'perCapitaBurden')).toBe('26.7% of income')
  })
})
