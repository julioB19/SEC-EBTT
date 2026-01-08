import { RoleName, ClassLevel } from "@prisma/client"

export interface CreateDocenteProfileDto {
  siape: string
  classLevel: ClassLevel
  startInterstice: Date
  educationLevel: string
  improvement?: string | null
  specialization?: string | null
  mastersDegree?: string | null
  doctorate?: string | null
  assignment?: string | null
  department?: string | null
  division?: string | null
  role?: string | null
  immediateSupervisor?: string | null
}

export interface UpdateDocenteProfileDto {
  siape?: string
  classLevel?: ClassLevel
  startInterstice?: Date
  educationLevel?: string
  improvement?: string | null
  specialization?: string | null
  mastersDegree?: string | null
  doctorate?: string | null
  assignment?: string | null
  department?: string | null
  division?: string | null
  role?: string | null
  immediateSupervisor?: string | null
}

export interface CreateUserDto {
  name: string
  email: string
  cpf: string
  phone?: string | null
  city?: string | null
  uf?: string | null
  password: string
  roles: RoleName[]
  docenteProfile?: CreateDocenteProfileDto
}

export interface UpdateUserDto {
  name?: string
  email?: string
  cpf?: string
  phone?: string | null
  city?: string | null
  uf?: string | null
  active?: boolean
  roles?: RoleName[]
  docenteProfile?: UpdateDocenteProfileDto
}

export interface UpdateMyDocenteProfileDto {
  name?: string
  email?: string
  phone?: string | null
  city?: string | null
  uf?: string | null
  docenteProfile?: UpdateDocenteProfileDto
}

export interface UpdateDocenteByCppdDto {
  email?: string
  cpf?: string
  siape?: string
}

export interface DocenteProfileResponseDto {
  idDocente: number
  siape: string
  classLevel: ClassLevel
  startInterstice: Date
  educationLevel: string
  improvement: string | null
  specialization: string | null
  mastersDegree: string | null
  doctorate: string | null
  assignment: string | null
  department: string | null
  division: string | null
  role: string | null
  immediateSupervisor: string | null
}

export interface UserResponseDto {
  idUser: number
  name: string
  email: string
  phone: string | null
  city: string | null
  uf: string | null
  cpf: string
  active: boolean
  createdAt: Date
  deletedDate: Date | null
  roles: RoleName[]
  docenteProfile: DocenteProfileResponseDto | null
}

export interface LoginDto {
  cpf: string
  password: string
}

export interface RefreshTokenDto {
  refreshToken: string
}
