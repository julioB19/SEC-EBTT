import { ScoringTablePurpose } from "@prisma/client"

export interface CreateScoringTableDto {
  name: string
  purpose?: ScoringTablePurpose
  minRequiredPoints?: string | number | null
  startsOn?: string | null
  endsOn?: string | null
}

export interface UpdateScoringTableDto {
  name?: string
  startsOn?: string | null
  endsOn?: string | null
  purpose?: ScoringTablePurpose
  minRequiredPoints?: string | number | null
  status?: "DRAFT" | "ACTIVE" | "INACTIVE"
}

export interface AdminListScoringTablesQueryDto {
  q?: string | null
  status?: "DRAFT" | "ACTIVE" | "INACTIVE" | null
  startsOnFrom?: string | null
  startsOnTo?: string | null
  endsOnFrom?: string | null
  endsOnTo?: string | null
}

export interface CreateScoringNodeDto {
  name: string
  code?: string | null
  sortOrder?: number
  parentId?: number | null
  hasFormula?: boolean
  formulaExpression?: string | null
  maxPoints?: string | number | null
}

export interface UpdateScoringNodeParentDto {
  parentId?: number | null
}

export interface CreateScoringItemDto {
  description: string
  unit?: string | null
  points: string | number
  hasMaxPoints?: boolean
  maxPoints?: string | number | null
  formulaKey?: string | null
  factor?: string | number | null
  weight?: string | number | null
  maxQuantity?: number | null
}

export interface SaveScoringBlockItemDto {
  description: string
  unit?: string | null
  points: string
  hasMaxPoints?: boolean
  maxPoints?: string | null
  formulaKey?: string | null
  factor?: string | null
  weight?: string | null
  maxQuantity?: number | null
}

export interface SaveScoringBlockNodeDto {
  draftId: string
  name: string
  code: string
  parentDraftId?: string | null
  sortOrder?: number
  hasFormula?: boolean
  formulaExpression?: string | null
  maxPoints?: string | null
  items?: SaveScoringBlockItemDto[]
}

export interface SaveScoringBlockDto {
  blockName: string
  nodes: SaveScoringBlockNodeDto[]
}

export interface UpdateScoringNodeDto {
  name?: string
  code?: string | null
  sortOrder?: number
  parentId?: number | null
  hasFormula?: boolean
  formulaExpression?: string | null
  maxPoints?: string | number | null
}

export interface UpdateScoringItemDto {
  description?: string
  unit?: string | null
  points?: string | number
  hasMaxPoints?: boolean
  maxPoints?: string | number | null
  formulaKey?: string | null
  factor?: string | number | null
  weight?: string | number | null
  maxQuantity?: number | null
}
