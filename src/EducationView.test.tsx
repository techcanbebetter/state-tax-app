import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EducationView from './EducationView'
import type { StateRecord } from './types'

const makeState = (overrides: Partial<StateRecord> = {}): StateRecord => ({
  state: 'California',
  population: 39000000,
  totalRevenue: 310000000000,
  perCapitaTotal: 7948,
  perCapitaIncome: 43000,
  breakdown: {},
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
  educationPerPupil: 20737,
  naepGrade4Reading: 214,
  naepGrade8Math: 270,
  reasonOverallRank: 0,
  reasonPavementRank: 0,
  reasonBridgeRank: 0,
  reasonCongestionRank: 0,
  reasonFatalityRank: 0,
  ...overrides,
})

const mockStates: StateRecord[] = [
  makeState({ state: 'California', educationPerPupil: 20737, naepGrade4Reading: 214, naepGrade8Math: 270 }),
  makeState({ state: 'Texas',      population: 30000000, educationPerPupil: 15611, naepGrade4Reading: 218, naepGrade8Math: 276 }),
  makeState({ state: 'New York',   population: 19500000, educationPerPupil: 35677, naepGrade4Reading: 224, naepGrade8Math: 278 }),
]

const zeroStates: StateRecord[] = [
  makeState({ state: 'California', educationPerPupil: 0, naepGrade4Reading: 0, naepGrade8Math: 0 }),
  makeState({ state: 'Texas',      population: 30000000, educationPerPupil: 0, naepGrade4Reading: 0, naepGrade8Math: 0 }),
]

describe('EducationView', () => {
  it('renders scatter plot SVG when educationPerPupil > 0', () => {
    const { container } = render(<EducationView activeStates={mockStates} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders "4th Grade Reading" and "8th Grade Math" toggle buttons', () => {
    render(<EducationView activeStates={mockStates} />)
    expect(screen.getByRole('button', { name: '4th Grade Reading' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '8th Grade Math' })).toBeInTheDocument()
  })

  it('clicking toggle switches active metric button', async () => {
    render(<EducationView activeStates={mockStates} />)
    const readingBtn = screen.getByRole('button', { name: '4th Grade Reading' })
    const mathBtn = screen.getByRole('button', { name: '8th Grade Math' })
    // Default: reading is active
    expect(readingBtn.className).toContain('active')
    expect(mathBtn.className).not.toContain('active')
    // Click math
    await userEvent.click(mathBtn)
    expect(mathBtn.className).toContain('active')
    expect(readingBtn.className).not.toContain('active')
  })

  it('renders ranked table with correct column headers', () => {
    render(<EducationView activeStates={mockStates} />)
    expect(screen.getByRole('columnheader', { name: /state/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /\$ \/ student/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /4th gr/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /8th gr/i })).toBeInTheDocument()
  })

  it('table is sorted by $/Student descending by default', () => {
    render(<EducationView activeStates={mockStates} />)
    const rows = screen.getAllByRole('row').slice(1) // skip header
    expect(rows[0]).toHaveTextContent('New York')    // $35,677 — highest
    expect(rows[1]).toHaveTextContent('California')  // $20,737
    expect(rows[2]).toHaveTextContent('Texas')       // $15,611 — lowest
  })

  it('clicking 4th Gr. Reading column header sorts by that column', async () => {
    render(<EducationView activeStates={mockStates} />)
    const readingHeader = screen.getByRole('columnheader', { name: /4th gr/i })
    await userEvent.click(readingHeader)
    const rows = screen.getAllByRole('row').slice(1)
    // Descending by grade4_reading: NY=224, TX=218, CA=214
    expect(rows[0]).toHaveTextContent('New York')
    expect(rows[2]).toHaveTextContent('California')
  })

  it('shows fallback message when all educationPerPupil values are 0', () => {
    render(<EducationView activeStates={zeroStates} />)
    expect(screen.getByText(/npm run data:refresh/i)).toBeInTheDocument()
  })
})
