import { CommissionMembershipType, CppdMemberFunction } from "@prisma/client"

export interface SaveCampusDto {
  name?: string
  acronym?: string
  cppdEmail?: string | null
  active?: boolean
}

export interface SaveCppdCommissionDto {
  campusId?: number
  ordinance?: string | null
  mandateStart?: Date | null
  mandateEnd?: Date | null
  validityStart?: Date | null
  validityEnd?: Date | null
}

export interface SaveCppdCommissionMemberDto {
  personId: number
  function?: CppdMemberFunction
  membershipType?: CommissionMembershipType
  active?: boolean
}

export interface UpdateCppdCommissionMemberDto {
  function?: CppdMemberFunction
  membershipType?: CommissionMembershipType
  active?: boolean
}
