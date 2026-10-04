import { IndividualEvaluationResult } from "@prisma/client"

export interface IndividualEvaluationScoreDto {
  itemId: number
  recognizedQuantity: number
  evaluatorComment?: string | null
}

export interface SaveIndividualEvaluationDto {
  result?: IndividualEvaluationResult | null
  opinionText?: string | null
  scores?: IndividualEvaluationScoreDto[]
}
