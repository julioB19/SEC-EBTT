import { RoleName } from "@prisma/client"

export interface CppdAccessScope {
  userId: number
  selectedRole: RoleName
  isCentral: boolean
  campusIds: number[]
}
