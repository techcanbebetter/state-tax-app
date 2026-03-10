import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChoroplethMap from './ChoroplethMap'
import type { StateRecord } from './types'

// Mock react-simple-maps so tests don't make network requests.
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
        { rsmKey: 'XX', properties: { name: 'Unknown State' } },
      ],
    }),
  Geography: ({
    geography,
    onClick,
  }: {
    geography: { properties: { name: string } }
    onClick: () => void
  }) => (
    <rect
      data-testid={`geo-${geography.properties.name}`}
      onClick={onClick}
    />
  ),
}))

const states: StateRecord[] = [
  {
    state: 'California',
    population: 39000000,
    totalRevenue: 300000000,
    perCapitaTotal: 7692,
    perCapitaIncome: 40000,
    breakdown: {},
  },
  {
    state: 'Texas',
    population: 30000000,
    totalRevenue: 180000000,
    perCapitaTotal: 6000,
    perCapitaIncome: 35000,
    breakdown: {},
  },
]

describe('ChoroplethMap', () => {
  it('renders an SVG container', () => {
    const { container } = render(
      <ChoroplethMap states={states} metric="total" selectedStates={new Set()} onToggleState={vi.fn()} />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a geography element for each state in mock data', () => {
    render(
      <ChoroplethMap states={states} metric="total" selectedStates={new Set()} onToggleState={vi.fn()} />
    )
    expect(screen.getByTestId('geo-California')).toBeInTheDocument()
    expect(screen.getByTestId('geo-Texas')).toBeInTheDocument()
  })

  it('calls onToggleState with state name when a geography is clicked', async () => {
    const onToggle = vi.fn()
    render(
      <ChoroplethMap states={states} metric="total" selectedStates={new Set()} onToggleState={onToggle} />
    )
    await userEvent.click(screen.getByTestId('geo-California'))
    expect(onToggle).toHaveBeenCalledWith('California')
  })

  it('does not call onToggleState when clicking a geography with no matching state', async () => {
    const onToggle = vi.fn()
    render(
      <ChoroplethMap states={states} metric="total" selectedStates={new Set()} onToggleState={onToggle} />
    )
    await userEvent.click(screen.getByTestId('geo-Unknown State'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('renders without error when a different metric is used', () => {
    const { container } = render(
      <ChoroplethMap states={states} metric="perCapita" selectedStates={new Set()} onToggleState={vi.fn()} />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
