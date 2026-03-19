import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FederalGrantsView from './FederalGrantsView'
import type { StateRecord } from './types'

vi.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Geographies: ({
    children,
  }: {
    children: (args: { geographies: unknown[] }) => React.ReactNode
  }) =>
    children({
      geographies: [
        { rsmKey: 'CA', properties: { name: 'California' } },
        { rsmKey: 'TX', properties: { name: 'Texas' } },
      ],
    }),
  Geography: ({
    geography,
  }: {
    geography: { properties: { name: string } }
  }) => <rect data-testid={`geo-${geography.properties.name}`} />,
}))

const mockStates: StateRecord[] = [
  {
    state: 'California',
    population: 39000000,
    totalRevenue: 310000000000,
    perCapitaTotal: 7948,
    perCapitaIncome: 43000,
    breakdown: {},
    spendingTotal: 0,
    spendingBreakdown: {},
    federalGrants: 120000000000,
    chargesFees: 0,
    trustUtility: 0,
    miscRevenue: 0,
    totalRevenueFull: 680000000000,
  },
  {
    state: 'Texas',
    population: 30000000,
    totalRevenue: 230000000000,
    perCapitaTotal: 7666,
    perCapitaIncome: 34000,
    breakdown: {},
    spendingTotal: 0,
    spendingBreakdown: {},
    federalGrants: 90000000000,
    chargesFees: 0,
    trustUtility: 0,
    miscRevenue: 0,
    totalRevenueFull: 505000000000,
  },
]

describe('FederalGrantsView', () => {
  it('renders bars sorted by federalGrants highest first', () => {
    render(
      <FederalGrantsView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    const articles = screen.getAllByRole('article')
    expect(articles[0]).toHaveTextContent('California')
    expect(articles[1]).toHaveTextContent('Texas')
  })

  it('renders Total and Per Capita toggle buttons', () => {
    render(
      <FederalGrantsView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.getByRole('button', { name: /^total$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /per capita/i })).toBeInTheDocument()
  })

  it('calls setMetric with perCapita when Per Capita button is clicked', async () => {
    const setMetric = vi.fn()
    render(
      <FederalGrantsView activeStates={mockStates} metric="total" setMetric={setMetric} />
    )
    await userEvent.click(screen.getByRole('button', { name: /per capita/i }))
    expect(setMetric).toHaveBeenCalledWith('perCapita')
  })

  it('renders a choropleth map', () => {
    const { container } = render(
      <FederalGrantsView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('does not render a breakdown table', () => {
    render(
      <FederalGrantsView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('does not render a color legend', () => {
    const { container } = render(
      <FederalGrantsView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    expect(container.querySelector('.tax-legend')).toBeNull()
  })

  it('shows "no extended revenue data" when all federalGrants values are 0', () => {
    const noDataStates = mockStates.map((s) => ({ ...s, federalGrants: 0 }))
    render(
      <FederalGrantsView activeStates={noDataStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.getByText(/no extended revenue data/i)).toBeInTheDocument()
  })
})
