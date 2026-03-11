import { describe, it, expect } from 'vitest'
import { applyBrackets, computeStateTax } from './taxCalc'

describe('applyBrackets', () => {
  it('returns 0 for empty brackets', () => {
    expect(applyBrackets(100000, [])).toBe(0)
  })

  it('returns 0 for zero income', () => {
    expect(applyBrackets(0, [{ upTo: null, rate: 0.05 }])).toBe(0)
  })

  it('returns 0 for negative income', () => {
    expect(applyBrackets(-1000, [{ upTo: null, rate: 0.05 }])).toBe(0)
  })

  it('applies a single flat rate', () => {
    expect(applyBrackets(100000, [{ upTo: null, rate: 0.05 }])).toBeCloseTo(5000)
  })

  it('applies progressive brackets correctly', () => {
    // $0-5000 at 5%, $5000-10000 at 10% — income = $8000
    const brackets = [
      { upTo: 5000, rate: 0.05 },
      { upTo: null, rate: 0.10 },
    ]
    // $5000 * 0.05 = $250 + $3000 * 0.10 = $300 → $550
    expect(applyBrackets(8000, brackets)).toBeCloseTo(550)
  })

  it('handles 0% brackets correctly', () => {
    // $0-10000 at 0%, then 5%
    const brackets = [
      { upTo: 10000, rate: 0 },
      { upTo: null, rate: 0.05 },
    ]
    expect(applyBrackets(20000, brackets)).toBeCloseTo(500)
  })
})

describe('computeStateTax', () => {
  it('returns all zeros for unknown state', () => {
    const result = computeStateTax('Unknown', 100000, 0, null, 'single')
    expect(result).toEqual({ incomeTax: 0, salesTax: 0, propertyTax: 0, total: 0 })
  })

  it('computes zero income tax for Texas (no income tax)', () => {
    const result = computeStateTax('Texas', 100000, 0, null, 'single')
    expect(result.incomeTax).toBe(0)
  })

  it('computes sales tax from ordinary income at 30% spending rate', () => {
    // Texas: salesTaxRate = 8.19%, income = $100,000
    // salesTax = 0.0819 * 100000 * 0.30 = $2,457
    const result = computeStateTax('Texas', 100000, 0, null, 'single')
    expect(result.salesTax).toBeCloseTo(2457)
  })

  it('does not include capital gains in sales tax calculation', () => {
    const withCG = computeStateTax('Texas', 0, 100000, null, 'single')
    expect(withCG.salesTax).toBe(0)
  })

  it('computes property tax from home value', () => {
    // Texas: propertyTaxRate = 1.6%, homeValue = $300,000
    // propertyTax = 0.016 * 300000 = $4,800
    const result = computeStateTax('Texas', 0, 0, 300000, 'single')
    expect(result.propertyTax).toBeCloseTo(4800)
  })

  it('returns zero property tax when homeValue is null', () => {
    const result = computeStateTax('Texas', 100000, 0, null, 'single')
    expect(result.propertyTax).toBe(0)
  })

  it('computes California income tax with stacked capital gains', () => {
    // CA single, $100k ordinary income, $50k capital gains
    // Tax on $150k total (ordinary stacking): compute on combined income
    // Tax on $100k alone (from earlier: ~$6,053) vs tax on $150k
    const withCG = computeStateTax('California', 100000, 50000, null, 'single')
    const withoutCG = computeStateTax('California', 100000, 0, null, 'single')
    // Capital gains increase income tax
    expect(withCG.incomeTax).toBeGreaterThan(withoutCG.incomeTax)
  })

  it('MFJ pays less income tax than single for same income in California', () => {
    const single = computeStateTax('California', 200000, 0, null, 'single')
    const mfj = computeStateTax('California', 200000, 0, null, 'mfj')
    expect(mfj.incomeTax).toBeLessThan(single.incomeTax)
  })

  it('computes Washington special capital gains tax on gains over $250k', () => {
    // WA: 7% on capital gains > $250,000
    const result = computeStateTax('Washington', 0, 500000, null, 'single')
    // ($500,000 - $250,000) * 0.07 = $17,500
    expect(result.incomeTax).toBeCloseTo(17500)
  })

  it('no capital gains tax in Washington on gains under $250k', () => {
    const result = computeStateTax('Washington', 0, 200000, null, 'single')
    expect(result.incomeTax).toBe(0)
  })

  it('computes Hawaii preferential capital gains rate', () => {
    // Hawaii: long-term cap gains at 7.25% flat
    const result = computeStateTax('Hawaii', 0, 100000, null, 'single')
    expect(result.incomeTax).toBeCloseTo(7250)
  })

  it('total equals sum of components', () => {
    const result = computeStateTax('California', 100000, 50000, 300000, 'single')
    expect(result.total).toBeCloseTo(result.incomeTax + result.salesTax + result.propertyTax)
  })
})
