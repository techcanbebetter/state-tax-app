import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PersonalCalculator from './PersonalCalculator'
import type { StateRecord } from './types'

const states: StateRecord[] = [
  { state: 'California', population: 39000000, totalRevenue: 300000, perCapitaTotal: 7, perCapitaIncome: 80000, breakdown: {}, spendingTotal: 0, spendingBreakdown: {} },
  { state: 'Texas', population: 30000000, totalRevenue: 200000, perCapitaTotal: 6, perCapitaIncome: 60000, breakdown: {}, spendingTotal: 0, spendingBreakdown: {} },
  { state: 'Florida', population: 22000000, totalRevenue: 150000, perCapitaTotal: 5, perCapitaIncome: 55000, breakdown: {}, spendingTotal: 0, spendingBreakdown: {} },
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
