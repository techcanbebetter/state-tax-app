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
}

export type DataPayload = {
  metadata: {
    year: number
    currency: string
    scope: string
    topN: number
    generatedAt?: string
    notes?: string[]
  }
  taxTypes: TaxType[]
  states: StateRecord[]
}

export type Metric = 'total' | 'perCapita' | 'perCapitaBurden'
