# Design: State Comparison Selector + Choropleth Map

**Date:** 2026-03-09
**Features:** State Comparison Selector (Feature 1) + Choropleth Map View (Feature 2)

---

## Overview

Two new features added to the existing single-page dashboard:

1. **State Comparison Selector** — users hover bar chart bars to reveal checkboxes; checked states appear in a side-by-side comparison panel below the chart
2. **Choropleth Map** — a US map panel rendered alongside the bar chart, shaded by the active metric

---

## Layout

```
[ metric toggle ]
[ bar chart (with hover checkboxes) ]   [ choropleth map ]
[ comparison panel (when states selected) ]
[ breakdown table ]
```

Map sits to the right of the bar chart. Both respond to the same metric toggle. Comparison panel appears below both only when 1+ states are selected, and disappears when all are deselected.

---

## Interaction Model

**State selection:**
1. Hover a bar → checkbox fades in on the left edge
2. Click checkbox → state added to `selectedStates: Set<string>` in `App.tsx`
3. Selected bars get a subtle highlight border
4. `ComparisonPanel` renders below with one column per selected state
5. Each column has an X button to deselect
6. Clicking a state on the map also toggles `selectedStates`
7. Max 5 states; additional checkboxes disabled with tooltip "max 5 states"

---

## Components

### `ChoroplethMap.tsx`
- Library: `react-simple-maps` + `d3-scale` for color interpolation
- Props: `states`, `activeMetric`, `selectedStates`, `onToggleState`
- Color scale: white → dark blue (low → high), using `scaleQuantile` to handle outliers (e.g., Alaska/Wyoming mineral tax revenue)
- Hover tooltip: state name + metric value (same format as bar chart)
- Selected states rendered with distinct outline/border color
- Clicking a state calls `onToggleState`
- Static FIPS code lookup map (constant in component file) to match geography to state data

### `ComparisonPanel.tsx`
- Props: `states`, `selectedStates`, `onToggleState`
- Only renders when `selectedStates.size > 0`
- One column per selected state
- Rows: state name (with X to deselect), Total Revenue, Per Capita, % of Income, then one row per tax type breakdown
- Values formatted same as bar chart tooltips (currency, percentages)
- States with $0 for a tax type render as "$0" or "N/A"

### `App.tsx` changes
- Add `selectedStates: Set<string>` state
- Add `toggleState(name: string)` handler
- Pass `toggleState` to bar chart, `ChoroplethMap`, and `ComparisonPanel`
- Bar chart: show checkbox on hover; click calls `toggleState`
- Layout: flex row for `[bar chart + map]`, then `[comparison panel]` below

---

## Data Flow

- Both new components receive the existing `states` array + `activeMetric` — no new data fetching
- `ChoroplethMap` computes min/max from `states` array to build color scale
- No changes to data pipeline scripts or existing breakdown table

---

## Dependencies

- `react-simple-maps` — SVG-based US map component
- `d3-scale` — color scale interpolation (likely already available or add as dev dep)

---

## Out of Scope

- No data pipeline changes
- No new data sources
- No routing / multi-page architecture
- No changes to existing breakdown table
