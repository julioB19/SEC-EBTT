// src/type/dto/processoDto.ts
import { ClassLevel, ProcessType } from "@prisma/client"

export interface DocentePatchDto {
  siape?: string
  classLevel?: ClassLevel
  startInterstice?: string | Date
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

export interface UserPatchDto {
  name?: string
  email?: string
  phone?: string | null
  city?: string | null
  uf?: string | null
  docenteProfile?: DocentePatchDto
}

export interface AberturaProcessoDto {
  tipo: ProcessType

  campus: string
  cidadeUF: string

  dataEmissaoISO: string
  intersticioInicioISO: string
  intersticioFimISO: string

  classeOrigem: string
  nivelOrigem: string
  classeDestino: string
  nivelDestino: string
}

export interface UpdateProcessoDto {
  campus?: string
  cidadeUF?: string
  intersticioInicioISO?: string
  intersticioFimISO?: string
  classeOrigem?: string
  nivelOrigem?: string
  classeDestino?: string
  nivelDestino?: string
}
