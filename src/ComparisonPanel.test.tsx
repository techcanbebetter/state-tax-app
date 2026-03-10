import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComparisonPanel from './ComparisonPanel'
import type { StateRecord, TaxType } from './types'

const taxTypes: TaxType[] = [
  { key: 'property', label: 'Property' },
  { key: 'income_individual', label: 'Individual Income' },
]

const states: StateRecord[] = [
  {
    state: 'California',
    population: 39000000,
    totalRevenue: 300000000,
    perCapitaTotal: 7692,
    perCapitaIncome: 40000,
    breakdown: { property: 80000000, income_individual: 120000000 },
  },
  {
    state: 'Texas',
    population: 30000000,
    totalRevenue: 180000000,
    perCapitaTotal: 6000,
    perCapitaIncome: 35000,
    breakdown: { property: 90000000, income_individual: 0 },
  },
]

describe('ComparisonPanel', () => {
  it('renders nothing when no states are selected', () => {
    const { container } = render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set()}
        onToggleState={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a column header for each selected state', () => {
    render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set(['California', 'Texas'])}
        onToggleState={vi.fn()}
      />
    )
    expect(screen.getByText('California')).toBeInTheDocument()
    expect(screen.getByText('Texas')).toBeInTheDocument()
  })

  it('shows Total Revenue row label', () => {
    render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set(['California'])}
        onToggleState={vi.fn()}
      />
    )
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
  })

  it('shows tax type row labels', () => {
    render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set(['California'])}
        onToggleState={vi.fn()}
      />
    )
    expect(screen.getByText('Property')).toBeInTheDocument()
    expect(screen.getByText('Individual Income')).toBeInTheDocument()
  })

  it('calls onToggleState with state name when X button is clicked', async () => {
    const onToggle = vi.fn()
    render(
      <ComparisonPanel
        states={states}
        taxTypes={taxTypes}
        selectedStates={new Set(['California'])}
        onToggleState={onToggle}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /remove california/i }))
    expect(onToggle).toHaveBeenCalledWith('California')
  })
})
