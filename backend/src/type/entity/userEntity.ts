import { RoleName } from "@prisma/client"

export interface DocenteProfileEntity {
  idDocente: number
  siape: string
  class: string
  level: string
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

export interface UserEntity {
  idUser: number
  name: string
  email: string
  cpf: string
  active: boolean
  createdAt: Date
  deletedDate?: Date | null
  roles: RoleName[]
  docenteProfile?: DocenteProfileEntity | null
}
