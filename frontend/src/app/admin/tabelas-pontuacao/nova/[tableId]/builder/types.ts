export type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

export type SaveScoringBlockItemDto = {
  description: string
  unit?: string | null
  points: string
  hasMaxPoints?: boolean
  maxPoints?: string | null
  formulaKey?: string | null
}

export type SaveScoringBlockNodeDto = {
  draftId: string
  name: string
  code: string
  parentDraftId?: string | null
  sortOrder?: number
  hasFormula?: boolean
  formulaExpression?: string | null
  items?: SaveScoringBlockItemDto[]
}

export type SaveScoringBlockDto = {
  blockName: string
  nodes: SaveScoringBlockNodeDto[]
}

export type UiItem = {
  idScoringItem?: number
  description: string
  unit: string
  points: string
  hasMaxPoints: boolean
  maxPoints: string
  formulaKey: string
}

export type UiNode = {
  idScoringNode?: number
  draftId: string
  name: string
  code: string
  parentDraftId: string | null
  sortOrder: number
  hasFormula: boolean
  formulaExpression: string
  items: UiItem[]
}
