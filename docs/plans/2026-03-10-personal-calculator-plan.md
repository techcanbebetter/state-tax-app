# Personal Tax Calculator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "What Would You Pay?" panel that lets users enter their income, capital gains, home value, and filing status to see a personalized estimated annual tax burden across all 50 states.

**Architecture:** Static 2023 rate data in `src/taxRates.ts`; pure computation functions in `src/taxCalc.ts`; a new `PersonalCalculator` React component renders inputs and a ranked bar chart. `App.tsx` adds the component between the chart-map row and the breakdown table. No data pipeline changes.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library (already installed)

---

### Task 1: Rate data — `src/taxRates.ts`

**Files:**
- Create: `src/taxRates.ts`
- Create: `src/taxRates.test.ts`

**Step 1: Write failing validation test**

Create `src/taxRates.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
npm test src/taxRates.test.ts
```
Expected: FAIL — `Cannot find module './taxRates'`

**Step 3: Create `src/taxRates.ts`**

```typescript
export type Bracket = { upTo: number | null; rate: number }

export type StateRates = {
  /** Progressive income tax brackets for single filers */
  single: Bracket[]
  /** Progressive income tax brackets for married filing jointly */
  marriedFilingJointly: Bracket[]
  /**
   * Capital gains treatment:
   * - 'ordinary'     taxed same as wages (stacked on top of ordinary income)
   * - 'none'         no income tax at all
   * - 'preferential' flat rate lower than ordinary; use capitalGainsRate
   * - 'special'      Washington's standalone 7% on gains > $250k; no ordinary income tax
   */
  capitalGains: 'ordinary' | 'preferential' | 'none' | 'special'
  /** Flat rate used when capitalGains === 'preferential' */
  capitalGainsRate?: number
  /** Combined state + average local sales tax rate (Tax Foundation 2023) */
  salesTaxRate: number
  /** Average effective property tax rate (Tax Foundation 2023) */
  propertyTaxRate: number
}

/**
 * 2023 state income tax rates, sales tax rates, and property tax rates.
 * Sources: Tax Foundation 2023 State Tax Climate Index; state revenue departments.
 * Rates are approximate and intended for comparison purposes.
 * Standard deductions are NOT applied (taxes computed on gross income).
 */
export const STATE_RATES: Record<string, StateRates> = {
  Alabama: {
    single: [
      { upTo: 500, rate: 0.02 },
      { upTo: 3000, rate: 0.04 },
      { upTo: null, rate: 0.05 },
    ],
    marriedFilingJointly: [
      { upTo: 1000, rate: 0.02 },
      { upTo: 6000, rate: 0.04 },
      { upTo: null, rate: 0.05 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0925,
    propertyTaxRate: 0.0041,
  },
  Alaska: {
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'none',
    salesTaxRate: 0.0176,
    propertyTaxRate: 0.0104,
  },
  Arizona: {
    // Flat 2.5% rate effective January 1, 2023
    single: [{ upTo: null, rate: 0.025 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.025 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0837,
    propertyTaxRate: 0.0045,
  },
  Arkansas: {
    single: [
      { upTo: 5000, rate: 0.02 },
      { upTo: 10000, rate: 0.04 },
      { upTo: null, rate: 0.049 },
    ],
    marriedFilingJointly: [
      { upTo: 5000, rate: 0.02 },
      { upTo: 10000, rate: 0.04 },
      { upTo: null, rate: 0.049 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0946,
    propertyTaxRate: 0.0062,
  },
  California: {
    single: [
      { upTo: 10099, rate: 0.01 },
      { upTo: 23942, rate: 0.02 },
      { upTo: 37788, rate: 0.04 },
      { upTo: 52455, rate: 0.06 },
      { upTo: 66295, rate: 0.08 },
      { upTo: 338639, rate: 0.093 },
      { upTo: 406364, rate: 0.103 },
      { upTo: 677275, rate: 0.113 },
      { upTo: 1000000, rate: 0.123 },
      { upTo: null, rate: 0.133 },
    ],
    marriedFilingJointly: [
      { upTo: 20198, rate: 0.01 },
      { upTo: 47884, rate: 0.02 },
      { upTo: 75576, rate: 0.04 },
      { upTo: 104910, rate: 0.06 },
      { upTo: 132590, rate: 0.08 },
      { upTo: 677278, rate: 0.093 },
      { upTo: 812728, rate: 0.103 },
      { upTo: 1354550, rate: 0.113 },
      { upTo: null, rate: 0.123 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0882,
    propertyTaxRate: 0.0071,
  },
  Colorado: {
    single: [{ upTo: null, rate: 0.044 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.044 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0777,
    propertyTaxRate: 0.0051,
  },
  Connecticut: {
    single: [
      { upTo: 10000, rate: 0.03 },
      { upTo: 50000, rate: 0.05 },
      { upTo: 100000, rate: 0.055 },
      { upTo: 200000, rate: 0.06 },
      { upTo: 250000, rate: 0.065 },
      { upTo: 500000, rate: 0.069 },
      { upTo: null, rate: 0.0699 },
    ],
    marriedFilingJointly: [
      { upTo: 20000, rate: 0.03 },
      { upTo: 100000, rate: 0.05 },
      { upTo: 200000, rate: 0.055 },
      { upTo: 400000, rate: 0.06 },
      { upTo: 500000, rate: 0.065 },
      { upTo: 1000000, rate: 0.069 },
      { upTo: null, rate: 0.0699 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0635,
    propertyTaxRate: 0.0179,
  },
  Delaware: {
    single: [
      { upTo: 2000, rate: 0 },
      { upTo: 5000, rate: 0.022 },
      { upTo: 10000, rate: 0.039 },
      { upTo: 20000, rate: 0.048 },
      { upTo: 25000, rate: 0.052 },
      { upTo: 60000, rate: 0.0555 },
      { upTo: null, rate: 0.066 },
    ],
    marriedFilingJointly: [
      { upTo: 2000, rate: 0 },
      { upTo: 5000, rate: 0.022 },
      { upTo: 10000, rate: 0.039 },
      { upTo: 20000, rate: 0.048 },
      { upTo: 25000, rate: 0.052 },
      { upTo: 60000, rate: 0.0555 },
      { upTo: null, rate: 0.066 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0,
    propertyTaxRate: 0.0057,
  },
  Florida: {
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'none',
    salesTaxRate: 0.0701,
    propertyTaxRate: 0.0089,
  },
  Georgia: {
    single: [
      { upTo: 750, rate: 0.01 },
      { upTo: 2250, rate: 0.02 },
      { upTo: 3750, rate: 0.03 },
      { upTo: 5250, rate: 0.04 },
      { upTo: 7000, rate: 0.05 },
      { upTo: null, rate: 0.0575 },
    ],
    marriedFilingJointly: [
      { upTo: 1000, rate: 0.01 },
      { upTo: 3000, rate: 0.02 },
      { upTo: 5000, rate: 0.03 },
      { upTo: 7000, rate: 0.04 },
      { upTo: 10000, rate: 0.05 },
      { upTo: null, rate: 0.0575 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0738,
    propertyTaxRate: 0.0091,
  },
  Hawaii: {
    single: [
      { upTo: 2400, rate: 0.014 },
      { upTo: 4800, rate: 0.032 },
      { upTo: 9600, rate: 0.055 },
      { upTo: 14400, rate: 0.064 },
      { upTo: 19200, rate: 0.068 },
      { upTo: 24000, rate: 0.072 },
      { upTo: 36000, rate: 0.076 },
      { upTo: 48000, rate: 0.079 },
      { upTo: 150000, rate: 0.0825 },
      { upTo: 175000, rate: 0.09 },
      { upTo: 200000, rate: 0.10 },
      { upTo: null, rate: 0.11 },
    ],
    marriedFilingJointly: [
      { upTo: 4800, rate: 0.014 },
      { upTo: 9600, rate: 0.032 },
      { upTo: 19200, rate: 0.055 },
      { upTo: 28800, rate: 0.064 },
      { upTo: 38400, rate: 0.068 },
      { upTo: 48000, rate: 0.072 },
      { upTo: 72000, rate: 0.076 },
      { upTo: 96000, rate: 0.079 },
      { upTo: 300000, rate: 0.0825 },
      { upTo: 350000, rate: 0.09 },
      { upTo: 400000, rate: 0.10 },
      { upTo: null, rate: 0.11 },
    ],
    // Hawaii taxes long-term capital gains at a preferential flat rate of 7.25%
    capitalGains: 'preferential',
    capitalGainsRate: 0.0725,
    salesTaxRate: 0.0444,
    propertyTaxRate: 0.0028,
  },
  Idaho: {
    // Flat 5.8% since 2022
    single: [{ upTo: null, rate: 0.058 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.058 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0602,
    propertyTaxRate: 0.0046,
  },
  Illinois: {
    single: [{ upTo: null, rate: 0.0495 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.0495 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0885,
    propertyTaxRate: 0.0183,
  },
  Indiana: {
    single: [{ upTo: null, rate: 0.0315 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.0315 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.07,
    propertyTaxRate: 0.0083,
  },
  Iowa: {
    single: [
      { upTo: 6000, rate: 0.044 },
      { upTo: 30000, rate: 0.0482 },
      { upTo: 75000, rate: 0.057 },
      { upTo: null, rate: 0.06 },
    ],
    marriedFilingJointly: [
      { upTo: 6000, rate: 0.044 },
      { upTo: 30000, rate: 0.0482 },
      { upTo: 75000, rate: 0.057 },
      { upTo: null, rate: 0.06 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0694,
    propertyTaxRate: 0.015,
  },
  Kansas: {
    single: [
      { upTo: 15000, rate: 0.031 },
      { upTo: 30000, rate: 0.0525 },
      { upTo: null, rate: 0.057 },
    ],
    marriedFilingJointly: [
      { upTo: 30000, rate: 0.031 },
      { upTo: 60000, rate: 0.0525 },
      { upTo: null, rate: 0.057 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0868,
    propertyTaxRate: 0.0133,
  },
  Kentucky: {
    single: [{ upTo: null, rate: 0.045 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.045 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.06,
    propertyTaxRate: 0.0086,
  },
  Louisiana: {
    single: [
      { upTo: 12500, rate: 0.0185 },
      { upTo: 50000, rate: 0.035 },
      { upTo: null, rate: 0.0425 },
    ],
    marriedFilingJointly: [
      { upTo: 25000, rate: 0.0185 },
      { upTo: 100000, rate: 0.035 },
      { upTo: null, rate: 0.0425 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0955,
    propertyTaxRate: 0.0056,
  },
  Maine: {
    single: [
      { upTo: 23000, rate: 0.058 },
      { upTo: 54450, rate: 0.0675 },
      { upTo: null, rate: 0.0715 },
    ],
    marriedFilingJointly: [
      { upTo: 46000, rate: 0.058 },
      { upTo: 108900, rate: 0.0675 },
      { upTo: null, rate: 0.0715 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.055,
    propertyTaxRate: 0.0136,
  },
  Maryland: {
    single: [
      { upTo: 1000, rate: 0.02 },
      { upTo: 2000, rate: 0.03 },
      { upTo: 3000, rate: 0.04 },
      { upTo: 100000, rate: 0.0475 },
      { upTo: 125000, rate: 0.05 },
      { upTo: 150000, rate: 0.0525 },
      { upTo: 250000, rate: 0.055 },
      { upTo: null, rate: 0.0575 },
    ],
    marriedFilingJointly: [
      { upTo: 1000, rate: 0.02 },
      { upTo: 2000, rate: 0.03 },
      { upTo: 3000, rate: 0.04 },
      { upTo: 150000, rate: 0.0475 },
      { upTo: 175000, rate: 0.05 },
      { upTo: 225000, rate: 0.0525 },
      { upTo: 300000, rate: 0.055 },
      { upTo: null, rate: 0.0575 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.06,
    propertyTaxRate: 0.0109,
  },
  Massachusetts: {
    // Flat 5%, plus 4% surtax on income over $1M (Prop 1, effective Jan 2023)
    single: [
      { upTo: 1000000, rate: 0.05 },
      { upTo: null, rate: 0.09 },
    ],
    marriedFilingJointly: [
      { upTo: 1000000, rate: 0.05 },
      { upTo: null, rate: 0.09 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0625,
    propertyTaxRate: 0.0114,
  },
  Michigan: {
    single: [{ upTo: null, rate: 0.0405 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.0405 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.06,
    propertyTaxRate: 0.0154,
  },
  Minnesota: {
    single: [
      { upTo: 30070, rate: 0.0535 },
      { upTo: 98760, rate: 0.068 },
      { upTo: 183340, rate: 0.0785 },
      { upTo: null, rate: 0.0985 },
    ],
    marriedFilingJointly: [
      { upTo: 43950, rate: 0.0535 },
      { upTo: 174610, rate: 0.068 },
      { upTo: 304970, rate: 0.0785 },
      { upTo: null, rate: 0.0985 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0804,
    propertyTaxRate: 0.0111,
  },
  Mississippi: {
    // 0% on first $10,000, 5% on remainder (2023)
    single: [
      { upTo: 10000, rate: 0 },
      { upTo: null, rate: 0.05 },
    ],
    marriedFilingJointly: [
      { upTo: 10000, rate: 0 },
      { upTo: null, rate: 0.05 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0707,
    propertyTaxRate: 0.0065,
  },
  Missouri: {
    single: [
      { upTo: 1121, rate: 0.015 },
      { upTo: 2242, rate: 0.02 },
      { upTo: 3363, rate: 0.025 },
      { upTo: 4484, rate: 0.03 },
      { upTo: 5605, rate: 0.035 },
      { upTo: 6726, rate: 0.04 },
      { upTo: 7847, rate: 0.045 },
      { upTo: null, rate: 0.0495 },
    ],
    marriedFilingJointly: [
      { upTo: 1121, rate: 0.015 },
      { upTo: 2242, rate: 0.02 },
      { upTo: 3363, rate: 0.025 },
      { upTo: 4484, rate: 0.03 },
      { upTo: 5605, rate: 0.035 },
      { upTo: 6726, rate: 0.04 },
      { upTo: 7847, rate: 0.045 },
      { upTo: null, rate: 0.0495 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0829,
    propertyTaxRate: 0.0097,
  },
  Montana: {
    single: [
      { upTo: 3100, rate: 0.01 },
      { upTo: 5500, rate: 0.02 },
      { upTo: 8400, rate: 0.03 },
      { upTo: 11300, rate: 0.04 },
      { upTo: 14500, rate: 0.05 },
      { upTo: 18700, rate: 0.06 },
      { upTo: null, rate: 0.0675 },
    ],
    marriedFilingJointly: [
      { upTo: 6200, rate: 0.01 },
      { upTo: 11000, rate: 0.02 },
      { upTo: 16800, rate: 0.03 },
      { upTo: 22600, rate: 0.04 },
      { upTo: 29000, rate: 0.05 },
      { upTo: 37400, rate: 0.06 },
      { upTo: null, rate: 0.0675 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0,
    propertyTaxRate: 0.0074,
  },
  Nebraska: {
    single: [
      { upTo: 3440, rate: 0.0246 },
      { upTo: 20590, rate: 0.0351 },
      { upTo: 33180, rate: 0.0501 },
      { upTo: null, rate: 0.0684 },
    ],
    marriedFilingJointly: [
      { upTo: 6860, rate: 0.0246 },
      { upTo: 41190, rate: 0.0351 },
      { upTo: 66360, rate: 0.0501 },
      { upTo: null, rate: 0.0684 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0694,
    propertyTaxRate: 0.0161,
  },
  Nevada: {
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'none',
    salesTaxRate: 0.0823,
    propertyTaxRate: 0.0048,
  },
  'New Hampshire': {
    // No income tax on wages or capital gains (Interest & Dividends tax is being phased out)
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'none',
    salesTaxRate: 0,
    propertyTaxRate: 0.0193,
  },
  'New Jersey': {
    single: [
      { upTo: 20000, rate: 0.014 },
      { upTo: 35000, rate: 0.0175 },
      { upTo: 40000, rate: 0.035 },
      { upTo: 75000, rate: 0.05525 },
      { upTo: 500000, rate: 0.0637 },
      { upTo: 1000000, rate: 0.0897 },
      { upTo: null, rate: 0.1075 },
    ],
    marriedFilingJointly: [
      { upTo: 20000, rate: 0.014 },
      { upTo: 50000, rate: 0.0175 },
      { upTo: 70000, rate: 0.0245 },
      { upTo: 80000, rate: 0.035 },
      { upTo: 150000, rate: 0.05525 },
      { upTo: 500000, rate: 0.0637 },
      { upTo: 1000000, rate: 0.0897 },
      { upTo: null, rate: 0.1075 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.066,
    propertyTaxRate: 0.0223,
  },
  'New Mexico': {
    single: [
      { upTo: 5500, rate: 0.017 },
      { upTo: 11000, rate: 0.032 },
      { upTo: 16000, rate: 0.047 },
      { upTo: 210000, rate: 0.049 },
      { upTo: null, rate: 0.059 },
    ],
    marriedFilingJointly: [
      { upTo: 8000, rate: 0.017 },
      { upTo: 16000, rate: 0.032 },
      { upTo: 24000, rate: 0.047 },
      { upTo: 315000, rate: 0.049 },
      { upTo: null, rate: 0.059 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0783,
    propertyTaxRate: 0.0066,
  },
  'New York': {
    single: [
      { upTo: 17150, rate: 0.04 },
      { upTo: 23600, rate: 0.045 },
      { upTo: 27900, rate: 0.0525 },
      { upTo: 161550, rate: 0.0585 },
      { upTo: 323200, rate: 0.0625 },
      { upTo: 2155350, rate: 0.0685 },
      { upTo: 5000000, rate: 0.0965 },
      { upTo: 25000000, rate: 0.103 },
      { upTo: null, rate: 0.109 },
    ],
    marriedFilingJointly: [
      { upTo: 27900, rate: 0.04 },
      { upTo: 43000, rate: 0.045 },
      { upTo: 161550, rate: 0.0525 },
      { upTo: 323200, rate: 0.0585 },
      { upTo: 2155350, rate: 0.0625 },
      { upTo: 5000000, rate: 0.0685 },
      { upTo: 25000000, rate: 0.0965 },
      { upTo: null, rate: 0.109 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0852,
    propertyTaxRate: 0.0154,
  },
  'North Carolina': {
    single: [{ upTo: null, rate: 0.0475 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.0475 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0699,
    propertyTaxRate: 0.0078,
  },
  'North Dakota': {
    single: [
      { upTo: 40525, rate: 0.011 },
      { upTo: 98100, rate: 0.0204 },
      { upTo: 204675, rate: 0.0227 },
      { upTo: 445000, rate: 0.0264 },
      { upTo: null, rate: 0.029 },
    ],
    marriedFilingJointly: [
      { upTo: 67950, rate: 0.011 },
      { upTo: 163550, rate: 0.0204 },
      { upTo: 249150, rate: 0.0227 },
      { upTo: 445000, rate: 0.0264 },
      { upTo: null, rate: 0.029 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0696,
    propertyTaxRate: 0.0098,
  },
  Ohio: {
    single: [
      { upTo: 25000, rate: 0 },
      { upTo: 44250, rate: 0.02765 },
      { upTo: 88450, rate: 0.03226 },
      { upTo: 110650, rate: 0.03688 },
      { upTo: null, rate: 0.0399 },
    ],
    marriedFilingJointly: [
      { upTo: 25000, rate: 0 },
      { upTo: 44250, rate: 0.02765 },
      { upTo: 88450, rate: 0.03226 },
      { upTo: 110650, rate: 0.03688 },
      { upTo: null, rate: 0.0399 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0724,
    propertyTaxRate: 0.0159,
  },
  Oklahoma: {
    single: [
      { upTo: 1000, rate: 0.005 },
      { upTo: 2500, rate: 0.01 },
      { upTo: 3750, rate: 0.02 },
      { upTo: 4900, rate: 0.03 },
      { upTo: 7200, rate: 0.04 },
      { upTo: null, rate: 0.0475 },
    ],
    marriedFilingJointly: [
      { upTo: 2000, rate: 0.005 },
      { upTo: 5000, rate: 0.01 },
      { upTo: 7500, rate: 0.02 },
      { upTo: 9800, rate: 0.03 },
      { upTo: 12200, rate: 0.04 },
      { upTo: null, rate: 0.0475 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0898,
    propertyTaxRate: 0.0087,
  },
  Oregon: {
    single: [
      { upTo: 10000, rate: 0.0475 },
      { upTo: 25000, rate: 0.0675 },
      { upTo: 125000, rate: 0.0875 },
      { upTo: null, rate: 0.099 },
    ],
    marriedFilingJointly: [
      { upTo: 17400, rate: 0.0475 },
      { upTo: 43700, rate: 0.0675 },
      { upTo: 250000, rate: 0.0875 },
      { upTo: null, rate: 0.099 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0,
    propertyTaxRate: 0.0093,
  },
  Pennsylvania: {
    single: [{ upTo: null, rate: 0.0307 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.0307 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0634,
    propertyTaxRate: 0.0149,
  },
  'Rhode Island': {
    single: [
      { upTo: 68200, rate: 0.0375 },
      { upTo: 155050, rate: 0.0475 },
      { upTo: null, rate: 0.0599 },
    ],
    marriedFilingJointly: [
      { upTo: 136400, rate: 0.0375 },
      { upTo: 310100, rate: 0.0475 },
      { upTo: null, rate: 0.0599 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.07,
    propertyTaxRate: 0.0153,
  },
  'South Carolina': {
    single: [
      { upTo: 3200, rate: 0 },
      { upTo: 6410, rate: 0.03 },
      { upTo: 9620, rate: 0.04 },
      { upTo: 12820, rate: 0.05 },
      { upTo: 16040, rate: 0.06 },
      { upTo: null, rate: 0.065 },
    ],
    marriedFilingJointly: [
      { upTo: 3200, rate: 0 },
      { upTo: 6410, rate: 0.03 },
      { upTo: 9620, rate: 0.04 },
      { upTo: 12820, rate: 0.05 },
      { upTo: 16040, rate: 0.06 },
      { upTo: null, rate: 0.065 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0743,
    propertyTaxRate: 0.0057,
  },
  'South Dakota': {
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'none',
    salesTaxRate: 0.064,
    propertyTaxRate: 0.0057,
  },
  Tennessee: {
    // Hall tax on investment income fully repealed as of Jan 1, 2021
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'none',
    salesTaxRate: 0.0955,
    propertyTaxRate: 0.0048,
  },
  Texas: {
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'none',
    salesTaxRate: 0.0819,
    propertyTaxRate: 0.016,
  },
  Utah: {
    single: [{ upTo: null, rate: 0.0465 }],
    marriedFilingJointly: [{ upTo: null, rate: 0.0465 }],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0719,
    propertyTaxRate: 0.0056,
  },
  Vermont: {
    single: [
      { upTo: 42150, rate: 0.0335 },
      { upTo: 102200, rate: 0.066 },
      { upTo: 213150, rate: 0.076 },
      { upTo: null, rate: 0.0875 },
    ],
    marriedFilingJointly: [
      { upTo: 70450, rate: 0.0335 },
      { upTo: 170300, rate: 0.066 },
      { upTo: 259500, rate: 0.076 },
      { upTo: null, rate: 0.0875 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0624,
    propertyTaxRate: 0.019,
  },
  Virginia: {
    single: [
      { upTo: 3000, rate: 0.02 },
      { upTo: 5000, rate: 0.03 },
      { upTo: 17000, rate: 0.05 },
      { upTo: null, rate: 0.0575 },
    ],
    marriedFilingJointly: [
      { upTo: 3000, rate: 0.02 },
      { upTo: 5000, rate: 0.03 },
      { upTo: 17000, rate: 0.05 },
      { upTo: null, rate: 0.0575 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0575,
    propertyTaxRate: 0.008,
  },
  Washington: {
    // No income tax; 7% capital gains tax on gains exceeding $250,000 (effective 2022)
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'special',
    salesTaxRate: 0.1037,
    propertyTaxRate: 0.0087,
  },
  'West Virginia': {
    single: [
      { upTo: 10000, rate: 0.03 },
      { upTo: 25000, rate: 0.04 },
      { upTo: 40000, rate: 0.045 },
      { upTo: 60000, rate: 0.06 },
      { upTo: null, rate: 0.065 },
    ],
    marriedFilingJointly: [
      { upTo: 10000, rate: 0.03 },
      { upTo: 25000, rate: 0.04 },
      { upTo: 40000, rate: 0.045 },
      { upTo: 60000, rate: 0.06 },
      { upTo: null, rate: 0.065 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0651,
    propertyTaxRate: 0.0053,
  },
  Wisconsin: {
    single: [
      { upTo: 13810, rate: 0.0354 },
      { upTo: 27630, rate: 0.0465 },
      { upTo: 304170, rate: 0.053 },
      { upTo: null, rate: 0.0765 },
    ],
    marriedFilingJointly: [
      { upTo: 18420, rate: 0.0354 },
      { upTo: 36840, rate: 0.0465 },
      { upTo: 405550, rate: 0.053 },
      { upTo: null, rate: 0.0765 },
    ],
    capitalGains: 'ordinary',
    salesTaxRate: 0.0543,
    propertyTaxRate: 0.0161,
  },
  Wyoming: {
    single: [],
    marriedFilingJointly: [],
    capitalGains: 'none',
    salesTaxRate: 0.0536,
    propertyTaxRate: 0.0057,
  },
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test src/taxRates.test.ts
```
Expected: 4 tests PASS.

**Step 5: Commit**

```bash
git add src/taxRates.ts src/taxRates.test.ts
git commit -m "feat: add 2023 state income/sales/property tax rate data"
```

---

### Task 2: Computation — `src/taxCalc.ts`

**Files:**
- Create: `src/taxCalc.ts`
- Create: `src/taxCalc.test.ts`

**Step 1: Write failing tests**

Create `src/taxCalc.test.ts`:
```typescript
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
```

**Step 2: Run tests to verify they fail**

```bash
npm test src/taxCalc.test.ts
```
Expected: FAIL — `Cannot find module './taxCalc'`

**Step 3: Create `src/taxCalc.ts`**

```typescript
import type { Bracket } from './taxRates'
import { STATE_RATES } from './taxRates'

export type TaxResult = {
  incomeTax: number
  salesTax: number
  propertyTax: number
  total: number
}

/**
 * Apply progressive tax brackets to a given income.
 * Brackets must be ordered from lowest to highest upTo value.
 * The last bracket must have upTo: null (no upper bound).
 */
export function applyBrackets(income: number, brackets: Bracket[]): number {
  if (brackets.length === 0 || income <= 0) return 0

  let tax = 0
  let prev = 0

  for (const bracket of brackets) {
    const top = bracket.upTo ?? Infinity
    const taxable = Math.min(income, top) - prev
    if (taxable <= 0) break
    tax += taxable * bracket.rate
    prev = top
  }

  return tax
}

/**
 * Compute estimated annual state tax burden for a given income profile.
 *
 * Capital gains are stacked on top of ordinary income for 'ordinary' treatment
 * (i.e., they are taxed at the marginal rate determined by combined income).
 *
 * Sales tax is estimated as: salesTaxRate × ordinaryIncome × 0.30
 * (assumes 30% of ordinary income spent on taxable goods — Tax Foundation proxy).
 *
 * Capital gains are excluded from the sales tax estimate.
 *
 * Property tax is: propertyTaxRate × homeValue (or 0 if homeValue is null).
 *
 * No deductions are applied — taxes are computed on gross income.
 */
export function computeStateTax(
  stateName: string,
  ordinaryIncome: number,
  capitalGains: number,
  homeValue: number | null,
  filingStatus: 'single' | 'mfj'
): TaxResult {
  const rates = STATE_RATES[stateName]
  if (!rates) return { incomeTax: 0, salesTax: 0, propertyTax: 0, total: 0 }

  const brackets = filingStatus === 'single' ? rates.single : rates.marriedFilingJointly

  let incomeTax = 0

  if (rates.capitalGains === 'none') {
    // No income tax at all
    incomeTax = 0
  } else if (rates.capitalGains === 'special') {
    // Washington: 7% on long-term capital gains exceeding $250,000; no ordinary income tax
    incomeTax = Math.max(0, capitalGains - 250000) * 0.07
  } else if (rates.capitalGains === 'preferential') {
    // Capital gains taxed at a separate flat rate; ordinary income uses brackets
    incomeTax = applyBrackets(ordinaryIncome, brackets) + capitalGains * (rates.capitalGainsRate ?? 0)
  } else {
    // 'ordinary': capital gains stacked on top of ordinary income
    incomeTax = applyBrackets(ordinaryIncome + capitalGains, brackets)
  }

  const salesTax = rates.salesTaxRate * ordinaryIncome * 0.30
  const propertyTax = homeValue != null ? rates.propertyTaxRate * homeValue : 0
  const total = incomeTax + salesTax + propertyTax

  return { incomeTax, salesTax, propertyTax, total }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test src/taxCalc.test.ts
```
Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/taxCalc.ts src/taxCalc.test.ts
git commit -m "feat: add state tax computation functions with bracket math"
```

---

### Task 3: PersonalCalculator component

**Files:**
- Create: `src/PersonalCalculator.tsx`
- Create: `src/PersonalCalculator.test.tsx`
- Modify: `src/App.css` (append styles)

**Step 1: Write failing tests**

Create `src/PersonalCalculator.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PersonalCalculator from './PersonalCalculator'
import type { StateRecord } from './types'

const states: StateRecord[] = [
  { state: 'California', population: 39000000, totalRevenue: 300000, perCapitaTotal: 7, perCapitaIncome: 80000, breakdown: {} },
  { state: 'Texas', population: 30000000, totalRevenue: 200000, perCapitaTotal: 6, perCapitaIncome: 60000, breakdown: {} },
  { state: 'Florida', population: 22000000, totalRevenue: 150000, perCapitaTotal: 5, perCapitaIncome: 55000, breakdown: {} },
]

describe('PersonalCalculator', () => {
  it('shows prompt when all inputs are empty', () => {
    render(<PersonalCalculator states={states} />)
    expect(screen.getByText(/enter your income/i)).toBeInTheDocument()
  })

  it('shows filing status toggle', () => {
    render(<PersonalCalculator states={states} />)
    expect(screen.getByRole('button', { name: /single/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /married/i })).toBeInTheDocument()
  })

  it('shows income input fields', () => {
    render(<PersonalCalculator states={states} />)
    expect(screen.getByLabelText(/ordinary income/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/capital gains/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/home value/i)).toBeInTheDocument()
  })

  it('renders bar chart rows after income is entered', async () => {
    render(<PersonalCalculator states={states} />)
    await userEvent.type(screen.getByLabelText(/ordinary income/i), '100000')
    // After debounce resolves — use fake timers or just check immediately
    // Bar rows appear for each state in STATE_RATES
    const bars = screen.getAllByRole('article')
    expect(bars.length).toBeGreaterThan(0)
  })

  it('clears home value when skip link is clicked', async () => {
    render(<PersonalCalculator states={states} />)
    const homeInput = screen.getByLabelText(/home value/i) as HTMLInputElement
    await userEvent.type(homeInput, '300000')
    expect(homeInput.value).toBe('300000')
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(homeInput.value).toBe('')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test src/PersonalCalculator.test.tsx
```
Expected: FAIL — `Cannot find module './PersonalCalculator'`

**Step 3: Implement `src/PersonalCalculator.tsx`**

```typescript
import { useEffect, useMemo, useState } from 'react'
import type { StateRecord } from './types'
import { computeStateTax } from './taxCalc'
import { STATE_RATES } from './taxRates'
import { currencyFormatter, TAX_COLORS } from './format'

type PersonalCalculatorProps = {
  states: StateRecord[]
}

type FilingStatus = 'single' | 'mfj'

function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

const CALC_COLORS = {
  incomeTax: TAX_COLORS['income_individual'],  // orange
  salesTax: TAX_COLORS['sales_general'],       // green
  propertyTax: TAX_COLORS['property'],         // blue
}

export default function PersonalCalculator({ states }: PersonalCalculatorProps) {
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single')
  const [ordinaryIncome, setOrdinaryIncome] = useState('')
  const [capitalGains, setCapitalGains] = useState('')
  const [homeValue, setHomeValue] = useState('')
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  // Debounced inputs — recompute 300ms after user stops typing
  const [debounced, setDebounced] = useState({
    ordinaryIncome: 0,
    capitalGains: 0,
    homeValue: null as number | null,
    filingStatus: 'single' as FilingStatus,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced({
        ordinaryIncome: parseAmount(ordinaryIncome),
        capitalGains: parseAmount(capitalGains),
        homeValue: homeValue ? parseAmount(homeValue) || null : null,
        filingStatus,
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [ordinaryIncome, capitalGains, homeValue, filingStatus])

  const hasInput =
    debounced.ordinaryIncome > 0 ||
    debounced.capitalGains > 0 ||
    debounced.homeValue != null

  // Only compute for states present in STATE_RATES; sort low-to-high (cheapest first)
  const results = useMemo(() => {
    if (!hasInput) return null
    return states
      .filter((s) => STATE_RATES[s.state] !== undefined)
      .map((s) => ({
        state: s.state,
        ...computeStateTax(
          s.state,
          debounced.ordinaryIncome,
          debounced.capitalGains,
          debounced.homeValue,
          debounced.filingStatus
        ),
      }))
      .sort((a, b) => a.total - b.total)
  }, [hasInput, states, debounced])

  const maxTotal = results ? Math.max(...results.map((r) => r.total), 1) : 1

  return (
    <section className="panel calc-panel">
      <h2>What Would You Pay?</h2>
      <p className="calc-subtitle">
        Estimated annual state tax burden — income tax, sales tax, and property tax.
        Rates are 2023 approximations. Federal taxes and deductions not included.
      </p>

      <div className="calc-inputs">
        <div className="calc-filing-toggle">
          <span className="calc-label">Filing status</span>
          <div className="metric-toggle" role="group" aria-label="Filing status">
            <button
              type="button"
              className={filingStatus === 'single' ? 'active' : ''}
              onClick={() => setFilingStatus('single')}
            >
              Single
            </button>
            <button
              type="button"
              className={filingStatus === 'mfj' ? 'active' : ''}
              onClick={() => setFilingStatus('mfj')}
            >
              Married filing jointly
            </button>
          </div>
        </div>

        <div className="calc-fields">
          <div className="calc-field">
            <label htmlFor="calc-ordinary-income" className="calc-label">
              Ordinary income
            </label>
            <div className="calc-input-wrap">
              <span className="calc-prefix">$</span>
              <input
                id="calc-ordinary-income"
                type="text"
                inputMode="numeric"
                className="calc-input"
                placeholder="0"
                value={ordinaryIncome}
                onChange={(e) => setOrdinaryIncome(e.target.value)}
              />
            </div>
          </div>

          <div className="calc-field">
            <label htmlFor="calc-capital-gains" className="calc-label">
              Long-term capital gains
            </label>
            <div className="calc-input-wrap">
              <span className="calc-prefix">$</span>
              <input
                id="calc-capital-gains"
                type="text"
                inputMode="numeric"
                className="calc-input"
                placeholder="0"
                value={capitalGains}
                onChange={(e) => setCapitalGains(e.target.value)}
              />
            </div>
          </div>

          <div className="calc-field">
            <label htmlFor="calc-home-value" className="calc-label">
              Home value{' '}
              <span className="calc-label-note">(optional)</span>
            </label>
            <div className="calc-input-wrap">
              <span className="calc-prefix">$</span>
              <input
                id="calc-home-value"
                type="text"
                inputMode="numeric"
                className="calc-input"
                placeholder="0"
                value={homeValue}
                onChange={(e) => setHomeValue(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="calc-skip"
              onClick={() => setHomeValue('')}
              aria-label="Skip home value"
            >
              I rent — skip
            </button>
          </div>
        </div>
      </div>

      {!hasInput && (
        <p className="calc-prompt">
          Enter your income above to see a personalized estimate across all 50 states.
        </p>
      )}

      {results && (
        <>
          <div className="calc-legend">
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: CALC_COLORS.incomeTax }} />
              Income tax
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: CALC_COLORS.salesTax }} />
              Sales tax (est.)
            </span>
            {debounced.homeValue != null && (
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: CALC_COLORS.propertyTax }} />
                Property tax (est.)
              </span>
            )}
          </div>

          <div className="bar-list">
            {results.map((r) => (
              <article
                key={r.state}
                className="bar-row"
                onMouseEnter={() => setHoveredState(r.state)}
                onMouseLeave={() => setHoveredState(null)}
              >
                <header>
                  <h3>{r.state}</h3>
                  <p>{currencyFormatter.format(r.total)} / yr</p>
                </header>
                <div className="bar-track">
                  <div
                    className="bar-segment"
                    style={{
                      width: `${(r.incomeTax / maxTotal) * 100}%`,
                      background: CALC_COLORS.incomeTax,
                    }}
                  />
                  <div
                    className="bar-segment"
                    style={{
                      width: `${(r.salesTax / maxTotal) * 100}%`,
                      background: CALC_COLORS.salesTax,
                    }}
                  />
                  {debounced.homeValue != null && (
                    <div
                      className="bar-segment"
                      style={{
                        width: `${(r.propertyTax / maxTotal) * 100}%`,
                        background: CALC_COLORS.propertyTax,
                      }}
                    />
                  )}
                </div>
                {hoveredState === r.state && (
                  <div className="bar-tooltip">
                    <div className="tooltip-row">
                      <span className="tooltip-swatch" style={{ background: CALC_COLORS.incomeTax }} />
                      <span className="tooltip-label">Income tax</span>
                      <span className="tooltip-value">{currencyFormatter.format(r.incomeTax)}</span>
                    </div>
                    <div className="tooltip-row">
                      <span className="tooltip-swatch" style={{ background: CALC_COLORS.salesTax }} />
                      <span className="tooltip-label">Sales tax (est.)</span>
                      <span className="tooltip-value">{currencyFormatter.format(r.salesTax)}</span>
                    </div>
                    {debounced.homeValue != null && (
                      <div className="tooltip-row">
                        <span className="tooltip-swatch" style={{ background: CALC_COLORS.propertyTax }} />
                        <span className="tooltip-label">Property tax (est.)</span>
                        <span className="tooltip-value">{currencyFormatter.format(r.propertyTax)}</span>
                      </div>
                    )}
                    <div className="tooltip-row tooltip-total">
                      <span className="tooltip-swatch" style={{ background: 'transparent' }} />
                      <span className="tooltip-label">Total</span>
                      <span className="tooltip-value">{currencyFormatter.format(r.total)}</span>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test src/PersonalCalculator.test.tsx
```
Expected: all tests PASS.

**Step 5: Append calculator styles to `src/App.css`**

```css
/* ── Personal Calculator ──────────────────────────────────── */
.calc-panel {
  margin-top: 0;
}

.calc-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.calc-inputs {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.calc-filing-toggle {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.calc-fields {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.calc-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 180px;
}

.calc-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.calc-label-note {
  font-weight: 400;
  color: #9ca3af;
}

.calc-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}

.calc-input-wrap:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.calc-prefix {
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  color: #6b7280;
  font-size: 0.9rem;
  user-select: none;
}

.calc-input {
  border: none;
  outline: none;
  padding: 0.5rem 0.75rem 0.5rem 0;
  font-size: 0.9rem;
  width: 140px;
  background: transparent;
}

.calc-skip {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-align: left;
}

.calc-skip:hover {
  color: #2563eb;
}

.calc-prompt {
  text-align: center;
  color: #9ca3af;
  padding: 2rem 0;
  font-style: italic;
}

.calc-legend {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.tooltip-total {
  border-top: 1px solid rgba(255,255,255,0.2);
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  font-weight: 600;
}
```

**Step 6: Verify build**

```bash
npm run build
```
Expected: no TypeScript errors.

**Step 7: Commit**

```bash
git add src/PersonalCalculator.tsx src/PersonalCalculator.test.tsx src/App.css
git commit -m "feat: add PersonalCalculator component with income/capital gains inputs"
```

---

### Task 4: Wire up App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add import**

At the top of `src/App.tsx`, after the existing component imports, add:
```typescript
import PersonalCalculator from './PersonalCalculator'
```

**Step 2: Add component to JSX**

In `src/App.tsx`, find the `<section className="panel">` for "Breakout by tax type".

Add `<PersonalCalculator>` immediately before it:
```tsx
<PersonalCalculator states={data.states} />

<section className="panel">
  <h2>Breakout by tax type</h2>
  ...
```

**Step 3: Verify build**

```bash
npm run build
```
Expected: no TypeScript errors.

**Step 4: Run all tests**

```bash
npm test
```
Expected: all tests pass.

**Step 5: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:5173/state-tax-app/` and verify:
- [ ] "What Would You Pay?" panel appears between the choropleth map row and the breakdown table
- [ ] Prompt shown when inputs are empty
- [ ] Entering $100,000 ordinary income shows ranked bar chart with cheapest states (TX, FL, NV, etc.) at top
- [ ] Adding capital gains shifts the chart — states with high income tax (CA, NY) move up
- [ ] Washington state shows income tax only when capital gains exceed $250,000
- [ ] MFJ toggle changes the results
- [ ] Entering a home value adds property tax (blue) segments
- [ ] "I rent — skip" clears the home value input
- [ ] Hovering a bar shows tooltip with all three components

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add PersonalCalculator to main dashboard"
```
