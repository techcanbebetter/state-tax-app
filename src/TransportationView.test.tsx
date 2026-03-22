import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransportationView from './TransportationView'
import type { StateRecord } from './types'

const makeState = (overrides: Partial<StateRecord> = {}): StateRecord => ({
  state: 'Virginia',
  population: 8700000,
  totalRevenue: 60000000000,
  perCapitaTotal: 6896,
  perCapitaIncome: 43000,
  breakdown: {},
  spendingTotal: 0,
  spendingBreakdown: { highways: 5000000000 },
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
  reasonOverallRank: 1,
  reasonPavementRank: 11,
  reasonBridgeRank: 10,
  reasonCongestionRank: 38,
  reasonFatalityRank: 20,
  ...overrides,
})

const mockStates: StateRecord[] = [
  makeState({ state: 'Virginia',       spendingBreakdown: { highways: 5000000000 },  reasonOverallRank: 1,  reasonPavementRank: 11, reasonBridgeRank: 10, reasonCongestionRank: 38, reasonFatalityRank: 20 }),
  makeState({ state: 'Georgia',        spendingBreakdown: { highways: 7000000000 },  population: 11000000, reasonOverallRank: 2,  reasonPavementRank: 15, reasonBridgeRank: 5,  reasonCongestionRank: 45, reasonFatalityRank: 27 }),
  makeState({ state: 'South Carolina', spendingBreakdown: { highways: 2000000000 },  population: 5300000,  reasonOverallRank: 3,  reasonPavementRank: 18, reasonBridgeRank: 24, reasonCongestionRank: 25, reasonFatalityRank: 45 }),
]

const zeroStates: StateRecord[] = [
  makeState({ state: 'California', reasonOverallRank: 0, reasonPavementRank: 0, reasonBridgeRank: 0, reasonCongestionRank: 0, reasonFatalityRank: 0 }),
  makeState({ state: 'Texas',      reasonOverallRank: 0, reasonPavementRank: 0, reasonBridgeRank: 0, reasonCongestionRank: 0, reasonFatalityRank: 0, population: 30000000 }),
]

describe('TransportationView', () => {
  it('renders scatter plot SVG when reasonOverallRank > 0', () => {
    const { container } = render(<TransportationView activeStates={mockStates} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders all 5 toggle buttons', () => {
    render(<TransportationView activeStates={mockStates} />)
    expect(screen.getByRole('button', { name: 'Overall' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pavement' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bridges' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Congestion' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fatality Rate' })).toBeInTheDocument()
  })

  it('Overall toggle is active by default', () => {
    render(<TransportationView activeStates={mockStates} />)
    expect(screen.getByRole('button', { name: 'Overall' }).className).toContain('active')
    expect(screen.getByRole('button', { name: 'Pavement' }).className).not.toContain('active')
  })

  it('clicking Pavement toggle makes it active', async () => {
    render(<TransportationView activeStates={mockStates} />)
    const pavementBtn = screen.getByRole('button', { name: 'Pavement' })
    await userEvent.click(pavementBtn)
    expect(pavementBtn.className).toContain('active')
    expect(screen.getByRole('button', { name: 'Overall' }).className).not.toContain('active')
  })

  it('clicking a toggle button switches the Y axis label', async () => {
    render(<TransportationView activeStates={mockStates} />)
    expect(screen.getByText('Overall Rank')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pavement' }))
    expect(screen.getByText('Pavement Rank')).toBeInTheDocument()
    expect(screen.queryByText('Overall Rank')).not.toBeInTheDocument()
  })

  it('renders ranked table with correct column headers', () => {
    render(<TransportationView activeStates={mockStates} />)
    expect(screen.getByRole('columnheader', { name: /state/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /\$\/capita/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /^overall/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /pavement/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /bridges/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /congestion/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /fatality rate/i })).toBeInTheDocument()
  })

  it('table is sorted by Overall rank ascending by default (rank 1 first)', () => {
    render(<TransportationView activeStates={mockStates} />)
    const rows = screen.getAllByRole('row').slice(1) // skip header
    expect(rows[0]).toHaveTextContent('Virginia')       // rank 1
    expect(rows[1]).toHaveTextContent('Georgia')        // rank 2
    expect(rows[2]).toHaveTextContent('South Carolina') // rank 3
  })

  it('clicking Overall column header reverses sort to descending', async () => {
    render(<TransportationView activeStates={mockStates} />)
    await userEvent.click(screen.getByRole('columnheader', { name: /^overall/i }))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('South Carolina') // rank 3 — worst first when descending
    expect(rows[2]).toHaveTextContent('Virginia')       // rank 1 — best last
  })

  it('shows fallback message when all reasonOverallRank values are 0', () => {
    render(<TransportationView activeStates={zeroStates} />)
    expect(screen.getByText(/npm run data:refresh/i)).toBeInTheDocument()
  })
})
