import { useMemo, useState } from 'react'
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

  const parsedOrdinaryIncome = parseAmount(ordinaryIncome)
  const parsedCapitalGains = parseAmount(capitalGains)
  const parsedHomeValue = homeValue ? parseAmount(homeValue) || null : null

  const hasInput =
    parsedOrdinaryIncome > 0 ||
    parsedCapitalGains > 0 ||
    parsedHomeValue != null

  // Only compute for states present in STATE_RATES; sort low-to-high (cheapest first)
  const results = useMemo(() => {
    if (!hasInput) return null
    return states
      .filter((s) => STATE_RATES[s.state] !== undefined)
      .map((s) => ({
        state: s.state,
        ...computeStateTax(
          s.state,
          parsedOrdinaryIncome,
          parsedCapitalGains,
          parsedHomeValue,
          filingStatus
        ),
      }))
      .sort((a, b) => a.total - b.total)
  }, [hasInput, states, parsedOrdinaryIncome, parsedCapitalGains, parsedHomeValue, filingStatus])

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
              aria-label="Skip, I rent"
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
            {parsedHomeValue != null && (
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
                  {parsedHomeValue != null && (
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
                    {parsedHomeValue != null && (
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
