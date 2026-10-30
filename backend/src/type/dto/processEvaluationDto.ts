export interface CppdItemScoreDto {
  itemId: number
  evaluatorAwardedPoints: string | null
  evaluatorComment?: string | null
}

export type CppdDecision = "APPROVED" | "REJECTED"

export interface FinalizeEvaluationDto {
  decision: CppdDecision
  requirementsMetAtISO?: string
  evaluatorUserIds?: number[]
  overrideOpinion?: string | null
}

export interface SetEvaluatorsDto {
  evaluatorUserIds: number[]
}

export interface GenerateParecerPreviewDto {
  requirementsMetAtISO?: string
  overrideOpinion?: string | null
  evaluatorUserIds?: number[]
  decision?: CppdDecision
}
