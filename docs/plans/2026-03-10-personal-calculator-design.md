# Design: "What Would You Pay?" Personal Tax Calculator

**Date:** 2026-03-10
**Feature:** Personal income tax calculator comparing all 50 states

---

## Overview

A new panel on the dashboard lets users enter their income and see a personalized estimated tax burden across all 50 states, ranked and broken down by income tax, sales tax, and property tax.

---

## Layout & UX

A **"What Would You Pay?"** panel appears between the existing chart row and the breakdown table.

**Inputs:**
- Filing status: toggle — Single / Married Filing Jointly
- Ordinary income: number input with $ prefix
- Long-term capital gains: number input with $ prefix
- Home value (optional): number input with $ prefix, with a "I rent / skip" link to clear it

**Output:**
A ranked bar chart of all 50 states showing estimated total annual tax burden in dollars — same visual style as existing bar charts, stacked by:
- Income tax (orange, matching existing color)
- Sales tax estimate (green)
- Property tax estimate (blue, only if home value entered)

Hovering a bar shows a tooltip breaking down the three components. The chart updates live as the user types (debounced ~300ms). If no inputs entered, shows prompt: *"Enter your income above to see a personalized estimate."*

---

## Data Model

**`src/taxRates.ts`** — static file bundling 2023 rate data for all 50 states.

```typescript
type Bracket = { upTo: number | null; rate: number }

type StateRates = {
  // Income tax brackets by filing status
  single: Bracket[]
  marriedFilingJointly: Bracket[]
  // Capital gains treatment
  capitalGains: 'ordinary' | 'preferential' | 'none' | 'special'
  capitalGainsRate?: number        // flat rate if 'preferential' or 'special'
  capitalGainsBrackets?: Bracket[] // if state has separate brackets
  // Sales tax: combined state + avg local rate (Tax Foundation 2023)
  salesTaxRate: number
  // Property tax: state avg effective rate (Tax Foundation 2023)
  propertyTaxRate: number
}

export const STATE_RATES: Record<string, StateRates> = { ... }
```

**Capital gains treatment variants:**
- `'ordinary'` — taxed same as wages (CA, NY, most states with income tax)
- `'none'` — no income tax (TX, FL, NV, SD, WY, AK; NH taxes only interest/dividends)
- `'preferential'` — flat rate lower than top income rate (AZ and others)
- `'special'` — Washington's standalone 7% capital gains tax on gains over $262,000 (no ordinary income tax)

**Sales tax estimate:** `salesTaxRate × (ordinaryIncome × 0.30)` — 30% of ordinary income assumed spent on taxable goods (Tax Foundation / WalletHub standard proxy).

**Property tax estimate:** `propertyTaxRate × homeValue` (only if home value entered).

---

## Computation

**`src/taxCalc.ts`** — pure functions, no React, fully unit-testable.

```typescript
function applyBrackets(income: number, brackets: Bracket[]): number

function computeStateTax(
  stateName: string,
  ordinaryIncome: number,
  capitalGains: number,
  homeValue: number | null,
  filingStatus: 'single' | 'mfj'
): { incomeTax: number; salesTax: number; propertyTax: number; total: number }
```

`applyBrackets` applies standard progressive marginal rate calculation. `computeStateTax` handles per-state capital gains treatment, then computes sales and property tax. Returns `0` for any component that does not apply.

---

## Components

**`src/PersonalCalculator.tsx`**
- Props: `states: StateRecord[]` (for ordering/state name list)
- Internal state: `ordinaryIncome`, `capitalGains`, `homeValue`, `filingStatus`
- Uses `useMemo` to compute all 50 states' taxes when inputs change (debounced ~300ms via `useDebounce` hook or `setTimeout`)
- Renders inputs + ranked bar chart, or prompt if all inputs are zero

**`App.tsx`** — add `<PersonalCalculator states={data.states} />` between the chart-map row and the breakdown table. No other changes.

---

## Testing

- `src/taxCalc.test.ts` — bracket math, capital gains variants, WA special case, zero-income, MFJ vs single
- `src/PersonalCalculator.test.tsx` — shows prompt when empty, shows bars when income entered, filing status toggle changes output

---

## Out of Scope

- Federal income tax (state comparison only)
- Short-term capital gains (treated as ordinary income in all states; user should include in ordinary income)
- AMT, deductions, credits
- Local income taxes (NYC, etc.)
- Estate / inheritance tax
