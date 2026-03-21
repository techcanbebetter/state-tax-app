import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpendingView from './SpendingView'
import type { MultiYearPayload, StateRecord } from './types'

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
    spendingTotal: 250000000000,
    spendingBreakdown: {
      education: 80000000000,
      public_welfare: 50000000000,
      health_hospitals: 40000000000,
      highways: 20000000000,
      police_corrections: 15000000000,
      natural_resources: 10000000000,
      other: 35000000000,
    },
    federalGrants: 0,
    chargesFees: 0,
    trustUtility: 0,
    miscRevenue: 0,
    totalRevenueFull: 0,
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
    totalRevenue: 270000000000,
    perCapitaTotal: 9000,
    perCapitaIncome: 34000,
    breakdown: {},
    spendingTotal: 180000000000,
    spendingBreakdown: {
      education: 60000000000,
      public_welfare: 35000000000,
      health_hospitals: 28000000000,
      highways: 18000000000,
      police_corrections: 12000000000,
      natural_resources: 8000000000,
      other: 19000000000,
    },
    federalGrants: 0,
    chargesFees: 0,
    trustUtility: 0,
    miscRevenue: 0,
    totalRevenueFull: 0,
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

const mockData: MultiYearPayload = {
  metadata: {
    year: 2023,
    yearRange: [2019, 2023],
    currency: 'USD',
    scope: 'state+local',
    topN: 2,
    generatedAt: '2024-01-01T00:00:00.000Z',
  },
  taxTypes: [{ key: 'income_individual', label: 'Individual income' }],
  spendingTypes: [
    { key: 'education', label: 'Education' },
    { key: 'public_welfare', label: 'Public Welfare' },
    { key: 'health_hospitals', label: 'Health & Hospitals' },
    { key: 'highways', label: 'Highways' },
    { key: 'police_corrections', label: 'Police & Corrections' },
    { key: 'natural_resources', label: 'Natural Resources' },
    { key: 'other', label: 'Other' },
  ],
  years: [{ year: 2023, states: mockStates }],
}

const mockDataNoSpending: MultiYearPayload = {
  ...mockData,
  spendingTypes: [],
}

describe('SpendingView', () => {
  it('renders a bar chart sorted by spending total (highest first)', () => {
    render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    const articles = screen.getAllByRole('article')
    expect(articles[0]).toHaveTextContent('California')
    expect(articles[1]).toHaveTextContent('Texas')
  })

  it('renders Total and Per Capita metric toggle buttons', () => {
    render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(screen.getByRole('button', { name: /^total$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /per capita/i })).toBeInTheDocument()
  })

  it('calls setMetric when Per Capita button is clicked', async () => {
    const setMetric = vi.fn()
    render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={setMetric}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /per capita/i }))
    expect(setMetric).toHaveBeenCalledWith('perCapita')
  })

  it('renders a choropleth map', () => {
    const { container } = render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a breakdown table with spending category columns', () => {
    render(
      <SpendingView
        data={mockData}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Education' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Highways' })).toBeInTheDocument()
  })

  it('shows "no spending data" message when spendingTypes is empty', () => {
    render(
      <SpendingView
        data={mockDataNoSpending}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(screen.getByText(/no spending data/i)).toBeInTheDocument()
  })

  it('shows "no spending data" message when spendingTypes is undefined', () => {
    const dataWithoutSpendingTypes = { ...mockData, spendingTypes: undefined as unknown as [] }
    render(
      <SpendingView
        data={dataWithoutSpendingTypes}
        activeStates={mockStates}
        metric="total"
        setMetric={() => undefined}
      />
    )
    expect(screen.getByText(/no spending data/i)).toBeInTheDocument()
  })
})
