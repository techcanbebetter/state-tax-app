import { describe, it, expect } from 'vitest'
import { compactCurrency, formatMetricValue, getMetricValue, getSpendingMetricValue, formatSpendingMetricValue, getSimpleMetricValue, formatSimpleMetricValue, REVENUE_BUCKET_COLORS, FEDERAL_GRANT_COLORS } from './format'
import type { StateRecord, SimpleMetric } from './types'

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
  federalGrants: 0,
  chargesFees: 0,
  trustUtility: 0,
  miscRevenue: 0,
  totalRevenueFull: 0,
  grantsWelfare: 0,
  grantsEducation: 0,
  grantsHealth: 0,
  grantsTransportation: 0,
  grantsOther: 0,
  educationPerPupil: 0,
  naepGrade4Reading: 0,
  naepGrade8Math: 0,
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

describe('compactCurrency — trillion support', () => {
  it('formats values >= 1 trillion with T suffix', () => {
    expect(compactCurrency(1_000_000_000_000)).toBe('$1.0T')
  })
  it('formats 2.5 trillion', () => {
    expect(compactCurrency(2_500_000_000_000)).toBe('$2.5T')
  })
  it('still formats billions correctly', () => {
    expect(compactCurrency(500_000_000_000)).toBe('$500.0B')
  })
})

describe('getSpendingMetricValue', () => {
  it('returns spendingTotal for total metric', () => {
    expect(getSpendingMetricValue(mockState, 'total')).toBe(280000000000)
  })
  it('computes per-capita for perCapita metric', () => {
    // 280000000000 / 39000000 ≈ 7179.49
    expect(getSpendingMetricValue(mockState, 'perCapita')).toBeCloseTo(7179.49, 1)
  })
  it('returns 0 for perCapita when population is 0', () => {
    expect(getSpendingMetricValue({ ...mockState, population: 0 }, 'perCapita')).toBe(0)
  })
})

describe('formatSpendingMetricValue', () => {
  it('formats total as compact currency', () => {
    expect(formatSpendingMetricValue(280000000000, 'total')).toBe('$280.0B')
  })
  it('formats perCapita with / resident suffix', () => {
    expect(formatSpendingMetricValue(7179, 'perCapita')).toBe('$7,179 / resident')
  })
})

describe('SimpleMetric type', () => {
  it('accepts total and perCapita', () => {
    const m1: SimpleMetric = 'total'
    const m2: SimpleMetric = 'perCapita'
    expect(m1).toBe('total')
    expect(m2).toBe('perCapita')
  })
})

describe('getSimpleMetricValue', () => {
  it('returns rawValue for total metric', () => {
    expect(getSimpleMetricValue(500_000_000, 'total', 1_000_000)).toBe(500_000_000)
  })

  it('computes per-capita for perCapita metric', () => {
    // 500_000_000 / 1_000_000 = 500
    expect(getSimpleMetricValue(500_000_000, 'perCapita', 1_000_000)).toBe(500)
  })

  it('returns 0 for perCapita when population is 0', () => {
    expect(getSimpleMetricValue(500_000_000, 'perCapita', 0)).toBe(0)
  })
})

describe('formatSimpleMetricValue', () => {
  it('formats total as compact currency', () => {
    expect(formatSimpleMetricValue(500_000_000_000, 'total')).toBe('$500.0B')
  })

  it('formats perCapita with / resident suffix', () => {
    expect(formatSimpleMetricValue(8500, 'perCapita')).toBe('$8,500 / resident')
  })
})

describe('REVENUE_BUCKET_COLORS', () => {
  it('has entries for all 5 bucket keys', () => {
    expect(REVENUE_BUCKET_COLORS).toHaveProperty('taxes')
    expect(REVENUE_BUCKET_COLORS).toHaveProperty('federalGrants')
    expect(REVENUE_BUCKET_COLORS).toHaveProperty('chargesFees')
    expect(REVENUE_BUCKET_COLORS).toHaveProperty('trustUtility')
    expect(REVENUE_BUCKET_COLORS).toHaveProperty('misc')
  })
})

describe('FEDERAL_GRANT_COLORS', () => {
  it('has entries for all 5 grant buckets', () => {
    expect(FEDERAL_GRANT_COLORS['grantsWelfare']).toBeDefined()
    expect(FEDERAL_GRANT_COLORS['grantsEducation']).toBeDefined()
    expect(FEDERAL_GRANT_COLORS['grantsHealth']).toBeDefined()
    expect(FEDERAL_GRANT_COLORS['grantsTransportation']).toBeDefined()
    expect(FEDERAL_GRANT_COLORS['grantsOther']).toBeDefined()
  })
})
