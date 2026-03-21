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
    grantsWelfare:         60000000000,
    grantsEducation:       15000000000,
    grantsHealth:          12000000000,
    grantsTransportation:   8000000000,
    grantsOther:           11000000000,
    educationPerPupil: 0,
    naepGrade4Reading: 0,
    naepGrade8Math: 0,
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
    grantsWelfare:         45000000000,
    grantsEducation:       11000000000,
    grantsHealth:           9000000000,
    grantsTransportation:   6000000000,
    grantsOther:            8000000000,
    educationPerPupil: 0,
    naepGrade4Reading: 0,
    naepGrade8Math: 0,
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

  it('renders a breakdown table with 5 bucket column headers', () => {
    render(
      <FederalGrantsView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Medicaid & Welfare' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Education' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Health' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Transportation' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Other' })).toBeInTheDocument()
  })

  it('renders a color legend with 5 entries', () => {
    const { container } = render(
      <FederalGrantsView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    const legend = container.querySelector('.tax-legend')
    expect(legend).toBeTruthy()
    expect(legend!.querySelectorAll('.legend-item')).toHaveLength(5)
  })

  it('shows breakdown unavailable message when federalGrants > 0 but all grants* fields are 0', () => {
    const noBreakdownStates = mockStates.map((s) => ({
      ...s,
      grantsWelfare: 0,
      grantsEducation: 0,
      grantsHealth: 0,
      grantsTransportation: 0,
      grantsOther: 0,
    }))
    render(
      <FederalGrantsView activeStates={noBreakdownStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.getByText(/breakdown not available/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows "no extended revenue data" when all federalGrants values are 0', () => {
    const noDataStates = mockStates.map((s) => ({ ...s, federalGrants: 0 }))
    render(
      <FederalGrantsView activeStates={noDataStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.getByText(/no extended revenue data/i)).toBeInTheDocument()
  })
})
