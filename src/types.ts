export type TaxType = {
  key: string
  label: string
}

export type StateRecord = {
  state: string
  population: number
  totalRevenue: number
  perCapitaTotal: number
  perCapitaIncome: number
  breakdown: Record<string, number>
  spendingTotal: number
  spendingBreakdown: Record<string, number>
}

export type YearRecord = {
  year: number
  states: StateRecord[]
}

export type MultiYearPayload = {
  metadata: {
    year: number
    yearRange: [number, number]
    currency: string
    scope: string
    topN: number
    generatedAt?: string
    notes?: string[]
  }
  taxTypes: TaxType[]
  spendingTypes: TaxType[]
  years: YearRecord[]
}

// Backward-compat alias
export type DataPayload = MultiYearPayload

export type Metric = 'total' | 'perCapita' | 'perCapitaBurden'

export type SpendingMetric = 'total' | 'perCapita'
