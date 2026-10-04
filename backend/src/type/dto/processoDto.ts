// src/type/dto/processoDto.ts
import { ClassLevel, FullProfessorEvaluationMode, ProcessType } from "@prisma/client"

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
  tipo?: ProcessType | string
  processTypeCode?: string
  processTypeId?: number

  campus: string
  cidadeUF: string
  externalNumber?: string | null

  dataEmissaoISO?: string
  intersticioInicioISO?: string
  intersticioFimISO?: string

  classeOrigem?: string
  nivelOrigem?: string
  classeDestino?: string
  nivelDestino?: string

  rscDetails?: {
    targetLevel?: string
    careerEntryDateISO?: string
    previousRscGrantedAtISO?: string | null
    activityPeriodStartISO?: string
    activityPeriodEndISO?: string
    truthDeclarationAccepted?: boolean
  }

  fullProfessorDetails?: {
    evaluationMode?: FullProfessorEvaluationMode | string
    doctorateDegreeId?: number | null
    finalReferenceDateISO?: string | null
  }
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
  externalNumber?: string | null
  rscDetails?: {
    targetLevel?: string
    careerEntryDateISO?: string
    previousRscGrantedAtISO?: string | null
    activityPeriodStartISO?: string
    activityPeriodEndISO?: string
    truthDeclarationAccepted?: boolean
  }
  fullProfessorDetails?: {
    evaluationMode?: FullProfessorEvaluationMode | string
    doctorateDegreeId?: number | null
    finalReferenceDateISO?: string | null
  }
}
