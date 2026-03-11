import { describe, it, expect } from 'vitest'
import { STATE_RATES } from './taxRates'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
]

describe('STATE_RATES', () => {
  it('contains all 50 states', () => {
    for (const state of US_STATES) {
      expect(STATE_RATES).toHaveProperty(state)
    }
  })

  it('has valid salesTaxRate for every state', () => {
    for (const [name, rates] of Object.entries(STATE_RATES)) {
      expect(typeof rates.salesTaxRate, name).toBe('number')
      expect(rates.salesTaxRate, name).toBeGreaterThanOrEqual(0)
      expect(rates.salesTaxRate, name).toBeLessThan(0.15)
    }
  })

  it('has valid propertyTaxRate for every state', () => {
    for (const [name, rates] of Object.entries(STATE_RATES)) {
      expect(typeof rates.propertyTaxRate, name).toBe('number')
      expect(rates.propertyTaxRate, name).toBeGreaterThanOrEqual(0)
      expect(rates.propertyTaxRate, name).toBeLessThan(0.05)
    }
  })

  it('has valid capitalGains type for every state', () => {
    const valid = new Set(['ordinary', 'preferential', 'none', 'special'])
    for (const [name, rates] of Object.entries(STATE_RATES)) {
      expect(valid.has(rates.capitalGains), name).toBe(true)
    }
  })
})
