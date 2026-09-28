import { GeccInterestedType, GeccStatus } from "@prisma/client"

export interface SaveGeccDto {
  externalNumber?: string | null
}

export interface AddGeccInterestedDto {
  name: string
  email: string
  type: GeccInterestedType
}

export interface UpdateGeccStatusDto {
  status: GeccStatus
}
