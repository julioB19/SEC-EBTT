import { RoleName } from "@prisma/client"

export interface UserResponse {
  id: number
  name: string
  phone: string
  email: string
  cpf: string
  role: any
  firstAccess: boolean
  createdDate: Date
  updatedDate: Date
}

export interface UserWithTeacherResponse {
  id: number
  name: string
  phone: string
  email: string
  cpf: string
  role: any
  firstAccess: boolean
  teacher: {
    id: number
    registration: string
    createdDate: Date
    updatedDate: Date
  }
  createdDate: Date
  updatedDate: Date
}

export interface LoginResponse {
  accessToken: string
  expiresIn: string
  refreshToken: string
  refreshExpiresIn: string
  firstAccess: boolean
}

export type SelectedRole = RoleName | null

export interface LoginResponseWithRoles extends LoginResponse {
  roles: RoleName[]
  selectedRole: SelectedRole
  needsProfileSelection: boolean
}
