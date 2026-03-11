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
