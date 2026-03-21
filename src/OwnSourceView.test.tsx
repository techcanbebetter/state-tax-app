import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OwnSourceView from './OwnSourceView'
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
    chargesFees: 80000000000,
    trustUtility: 150000000000,
    miscRevenue: 20000000000,
    totalRevenueFull: 680000000000, // ownSourceTotal = 680B - 120B = 560B
    grantsWelfare: 0,
    grantsEducation: 0,
    grantsHealth: 0,
    grantsTransportation: 0,
    grantsOther: 0,
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
    chargesFees: 60000000000,
    trustUtility: 110000000000,
    miscRevenue: 15000000000,
    totalRevenueFull: 505000000000, // ownSourceTotal = 505B - 90B = 415B
    grantsWelfare: 0,
    grantsEducation: 0,
    grantsHealth: 0,
    grantsTransportation: 0,
    grantsOther: 0,
    educationPerPupil: 0,
    naepGrade4Reading: 0,
    naepGrade8Math: 0,
  },
]

describe('OwnSourceView', () => {
  it('renders bars sorted by ownSourceTotal (chargesFees + trustUtility + miscRevenue) highest first', () => {
    render(
      <OwnSourceView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    const articles = screen.getAllByRole('article')
    // CA: 80B + 150B + 20B = 250B; TX: 60B + 110B + 15B = 185B
    expect(articles[0]).toHaveTextContent('California')
    expect(articles[1]).toHaveTextContent('Texas')
  })

  it('renders Total and Per Capita toggle buttons', () => {
    render(
      <OwnSourceView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.getByRole('button', { name: /^total$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /per capita/i })).toBeInTheDocument()
  })

  it('calls setMetric with perCapita when Per Capita button is clicked', async () => {
    const setMetric = vi.fn()
    render(
      <OwnSourceView activeStates={mockStates} metric="total" setMetric={setMetric} />
    )
    await userEvent.click(screen.getByRole('button', { name: /per capita/i }))
    expect(setMetric).toHaveBeenCalledWith('perCapita')
  })

  it('renders a choropleth map', () => {
    const { container } = render(
      <OwnSourceView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a breakdown table with 3 bucket column headers (no Taxes, no Federal Grants)', () => {
    render(
      <OwnSourceView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Charges & Fees' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Trust & Utility' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Misc' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Taxes' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Federal Grants' })).toBeNull()
  })

  it('renders a color legend with 3 entries (no Taxes, no Federal Grants)', () => {
    const { container } = render(
      <OwnSourceView activeStates={mockStates} metric="total" setMetric={() => undefined} />
    )
    const legend = container.querySelector('.tax-legend')
    expect(legend).toBeTruthy()
    expect(legend!.querySelectorAll('.legend-item')).toHaveLength(3)
  })

  it('shows "no extended revenue data" when other revenue is 0 for all states', () => {
    const noDataStates = mockStates.map((s) => ({ ...s, chargesFees: 0, trustUtility: 0, miscRevenue: 0 }))
    render(
      <OwnSourceView activeStates={noDataStates} metric="total" setMetric={() => undefined} />
    )
    expect(screen.getByText(/no extended revenue data/i)).toBeInTheDocument()
  })
})
