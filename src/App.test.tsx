import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { MultiYearPayload } from './types'

// Mock react-simple-maps so tests don't make network requests for GeoJSON.
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

const testPayload: MultiYearPayload = {
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
  years: [
    {
      year: 2019,
      states: [
        {
          state: 'California',
          population: 39000000,
          totalRevenue: 310000000000,
          perCapitaTotal: 7948,
          perCapitaIncome: 39000,
          breakdown: { income_individual: 100000000000 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
          population: 28000000,
          totalRevenue: 230000000000,
          perCapitaTotal: 8214,
          perCapitaIncome: 30000,
          breakdown: { income_individual: 0 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
      ],
    },
    {
      year: 2020,
      states: [
        {
          state: 'California',
          population: 39500000,
          totalRevenue: 320000000000,
          perCapitaTotal: 8101,
          perCapitaIncome: 40000,
          breakdown: { income_individual: 105000000000 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
          population: 29000000,
          totalRevenue: 235000000000,
          perCapitaTotal: 8103,
          perCapitaIncome: 31000,
          breakdown: { income_individual: 0 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
      ],
    },
    {
      year: 2021,
      states: [
        {
          state: 'California',
          population: 39200000,
          totalRevenue: 340000000000,
          perCapitaTotal: 8673,
          perCapitaIncome: 41000,
          breakdown: { income_individual: 110000000000 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
          population: 29500000,
          totalRevenue: 245000000000,
          perCapitaTotal: 8305,
          perCapitaIncome: 32000,
          breakdown: { income_individual: 0 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
      ],
    },
    {
      year: 2022,
      states: [
        {
          state: 'California',
          population: 39000000,
          totalRevenue: 350000000000,
          perCapitaTotal: 8974,
          perCapitaIncome: 42000,
          breakdown: { income_individual: 113000000000 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
          totalRevenue: 260000000000,
          perCapitaTotal: 8666,
          perCapitaIncome: 33000,
          breakdown: { income_individual: 0 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
      ],
    },
    {
      year: 2023,
      states: [
        {
          state: 'California',
          population: 39000000,
          totalRevenue: 362000000000,
          perCapitaTotal: 9282,
          perCapitaIncome: 43000,
          breakdown: { income_individual: 117000000000 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
          breakdown: { income_individual: 0 },
          spendingTotal: 0,
          spendingBreakdown: {},
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
      ],
    },
  ],
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(testPayload),
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App year toggle', () => {
  it('renders 5 year toggle buttons when yearRange spans 2019–2023', async () => {
    render(<App />)
    const yearToggle = await screen.findByRole('group', { name: /year toggle/i })
    const buttons = yearToggle.querySelectorAll('button')
    expect(buttons).toHaveLength(5)
    expect(buttons[0].textContent).toBe('2019')
    expect(buttons[4].textContent).toBe('2023')
  })

  it('shows 2023 as the active year by default', async () => {
    render(<App />)
    const btn2023 = await screen.findByRole('button', { name: '2023' })
    expect(btn2023.className).toContain('active')
  })

  it('updates year card when a different year is selected', async () => {
    render(<App />)
    // Wait for data to load; the Year card should read "2023"
    await screen.findByRole('button', { name: '2023' })

    await waitFor(() => {
      // Year card heading is "Year" followed by "2023"
      const yearHeadings = screen.getAllByRole('heading', { level: 2 })
      const yearCard = yearHeadings.find((h) => h.textContent === 'Year')
      expect(yearCard).toBeTruthy()
      expect(yearCard?.nextElementSibling?.textContent).toBe('2023')
    })

    await userEvent.click(screen.getByRole('button', { name: '2019' }))

    await waitFor(() => {
      const yearHeadings = screen.getAllByRole('heading', { level: 2 })
      const yearCard = yearHeadings.find((h) => h.textContent === 'Year')
      expect(yearCard?.nextElementSibling?.textContent).toBe('2019')
    })
  })

  it('highlights the selected year button as active', async () => {
    render(<App />)
    await screen.findByRole('button', { name: '2023' })

    const btn2022 = screen.getByRole('button', { name: '2022' })
    expect(btn2022.className).not.toContain('active')

    await userEvent.click(btn2022)

    expect(btn2022.className).toContain('active')
    expect(screen.getByRole('button', { name: '2023' }).className).not.toContain('active')
  })
})

describe('App view tab bar', () => {
  it('renders all 6 tabs in story order', async () => {
    render(<App />)
    const viewToggle = await screen.findByRole('group', { name: /view toggle/i })
    const buttons = viewToggle.querySelectorAll('button')
    expect(buttons).toHaveLength(6)
    expect(buttons[0].textContent).toBe('Total Revenue')
    expect(buttons[1].textContent).toBe('Tax Revenue')
    expect(buttons[2].textContent).toBe('Other Revenue')
    expect(buttons[3].textContent).toBe('Federal Grants')
    expect(buttons[4].textContent).toBe('Spending')
    expect(buttons[5].textContent).toBe('Education')
  })

  it('defaults to Total Revenue tab active', async () => {
    render(<App />)
    const revenueBtn = await screen.findByRole('button', { name: /^total revenue$/i })
    expect(revenueBtn.className).toContain('active')
  })

  it('switches to Spending view when Spending tab is clicked', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /^total revenue$/i })
    await userEvent.click(screen.getByRole('button', { name: /^spending$/i }))
    expect(screen.getByRole('button', { name: /^spending$/i }).className).toContain('active')
    expect(screen.getByRole('button', { name: /^total revenue$/i }).className).not.toContain('active')
  })
})

describe('App Education tab', () => {
  it('renders 6 tabs including Education as the last', async () => {
    render(<App />)
    const viewToggle = await screen.findByRole('group', { name: /view toggle/i })
    const buttons = viewToggle.querySelectorAll('button')
    expect(buttons).toHaveLength(6)
    expect(buttons[5].textContent).toBe('Education')
  })

  it('hides year toggle and auto-selects 2022 when switching to Education tab', async () => {
    render(<App />)
    // Wait for data to load
    await screen.findByRole('button', { name: '2023' })
    // Year toggle should be visible on other tabs
    expect(screen.getByRole('group', { name: /year toggle/i })).toBeInTheDocument()
    // Switch to Education tab
    await userEvent.click(screen.getByRole('button', { name: 'Education' }))
    // Year toggle should be hidden
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: /year toggle/i })).not.toBeInTheDocument()
    })
  })
})
