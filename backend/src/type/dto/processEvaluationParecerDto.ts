export interface ParecerTotalsDto {
  docenteTotal: number
  cppdTotal: number
  minRequiredPoints: number | null
}

export interface DivergentItemDto {
  itemId: number
  description: string
  docentePoints: number
  cppdPoints: number
  evaluatorComment: string | null
}

export interface ParecerPreviewDto {
  totals: ParecerTotalsDto
  divergentItems: DivergentItemDto[]
  suggestedOpinion: string
  evaluatorUserIds: number[]
}

