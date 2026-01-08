export interface CppdItemScoreDto {
  itemId: number
  evaluatorAwardedPoints: string | null
  evaluatorComment?: string | null
}

export type CppdDecision = "APPROVED" | "REJECTED" | "RETURNED"

export interface FinalizeEvaluationDto {
  decision: CppdDecision
  evaluatorUserIds?: number[]
  overrideOpinion?: string | null
}

export interface SetEvaluatorsDto {
  evaluatorUserIds: number[]
}

export interface GenerateParecerPreviewDto {
  overrideOpinion?: string | null
  evaluatorUserIds?: number[]
  decision?: CppdDecision
}
