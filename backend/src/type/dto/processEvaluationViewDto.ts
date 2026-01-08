import { ProcessStatus, ProcessType } from "@prisma/client"

export interface EvaluationProcessInfoDto {
  idProcess: number
  type: ProcessType
  status: ProcessStatus
  campus: string
  cidadeUF: string
  intersticeStart: string
  intersticeEnd: string
  classeOrigem: string
  nivelOrigem: string
  classeDestino: string
  nivelDestino: string
  teacherName: string
  scoringTableMinRequiredPoints: number | null
}

export interface EvaluationNodeDto {
  idScoringNode: number
  parentId: number | null
  name: string
  code: string | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string | null
}

export interface EvaluationItemDto {
  idScoringItem: number
  nodeId: number
  description: string
  points: number
  unit: string | null
  hasMaxPoints: boolean
  maxPoints: number | null
  formulaKey: string | null
}

export interface EvaluationScoreDto {
  idProcessScore: number
  itemId: number
  quantity: number
  awardedPoints: number
  evaluatorAwardedPoints: number | null
  evaluatorComment: string | null
  evidenceFile?: {
    idEvidenceFile: number
    originalName: string
    url: string
    sizeBytes: string | null
  } | null
}

export interface EvaluationNodeScoreDto {
  nodeId: number
  totalPoints: number
  evaluatorTotalPoints: number | null
}

export interface ProcessEvaluationViewDto {
  process: EvaluationProcessInfoDto
  nodes: EvaluationNodeDto[]
  items: EvaluationItemDto[]
  scores: EvaluationScoreDto[]
  nodeScores: EvaluationNodeScoreDto[]
}
