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
  // Extended revenue fields (populated after running npm run data:refresh with updated pipeline)
  federalGrants: number
  chargesFees: number
  trustUtility: number
  miscRevenue: number
  totalRevenueFull: number
  // Federal grants breakdown (from Census Individual Unit Files)
  grantsWelfare: number        // B79 — Medicaid, TANF, SNAP, public welfare
  grantsEducation: number      // B21 — Title I, IDEA, vocational education
  grantsHealth: number         // B42 + B43 — CHIP, hospital grants, public health
  grantsTransportation: number // B46 + B01 — highway formula funds, airports
  grantsOther: number          // B22+B30+B50+B54+B59+B80+B89 — housing, nat resources, etc.
  // Education effectiveness (K-12 only; from Census F-33 and NAEP)
  educationPerPupil: number    // K-12 per-pupil expenditure in dollars (0 if not ingested)
  naepGrade4Reading: number    // NAEP 4th grade reading score, ~200–240 range (0 if no data for year)
  naepGrade8Math: number       // NAEP 8th grade math score, ~255–290 range (0 if no data for year)
  // Transportation effectiveness (from Reason Foundation 29th Annual Highway Report)
  reasonOverallRank: number      // 1 = best, 50 = worst; 0 if not ingested
  reasonPavementRank: number     // avg of 4 pavement sub-rankings, rounded; 0 if not ingested
  reasonBridgeRank: number       // Structurally Deficient Bridges ranking; 0 if not ingested
  reasonCongestionRank: number   // Urbanized Area Congestion ranking; 0 if not ingested
  reasonFatalityRank: number     // avg of 3 fatality rate sub-rankings, rounded; 0 if not ingested
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

export type SimpleMetric = 'total' | 'perCapita'

export type SpendingMetric = SimpleMetric
