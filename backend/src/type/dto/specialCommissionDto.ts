import { AcceptanceStatus, CommissionStatus, SpecialCommissionMemberRole } from "@prisma/client"

export interface SaveSpecialCommissionDto {
  ordinance?: string | null
  ordinanceDate?: string | null
}

export interface AddSpecialCommissionMemberDto {
  email: string
  role?: SpecialCommissionMemberRole
}

export interface UpdateSpecialCommissionStatusDto {
  status: CommissionStatus
}

export interface RespondSpecialCommissionInvitationDto {
  response: AcceptanceStatus
}

export interface FinalizeSpecialCommissionDecisionDto {
  decision: "APPROVED" | "REJECTED"
  opinionText: string
}
