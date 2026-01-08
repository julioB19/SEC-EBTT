import { prisma } from "../infra/prismaClient"
import { ProcessStatus, ProcessType } from "@prisma/client"
import { AberturaProcessoDto } from "../type/dto/processoDto"

export class ProcessRepository {
  async create(
    userId: number,
    scoringTableId: number,
    processType: ProcessType,
    dto: AberturaProcessoDto
  ) {
    console.log("ProcessRepository.create =>", {
      userId,
      scoringTableId,
      processType
    })

    return prisma.careerProcess.create({
      data: {
        userId,
        scoringTableId,
        type: processType,
        status: ProcessStatus.DRAFT,

        campus: dto.campus,
        cidadeUF: dto.cidadeUF,
        intersticeStart: new Date(dto.intersticioInicioISO),
        intersticeEnd: new Date(dto.intersticioFimISO),
        classeOrigem: dto.classeOrigem,
        nivelOrigem: dto.nivelOrigem,
        classeDestino: dto.classeDestino,
        nivelDestino: dto.nivelDestino
      },
      include: {
        user: true,
        table: true
      }
    })
  }

  async findById(idProcess: number) {
    return prisma.careerProcess.findUnique({
      where: {
        idProcess
      },
      include: {
        user: true,
        table: true
      }
    })
  }

  async findByIdForScoreSpreadsheet(idProcess: number) {
    return prisma.careerProcess.findUnique({
      where: {
        idProcess
      },
      include: {
        user: { include: { docente: true } },
        table: true
      }
    })
  }

  async updateStatus(idProcess: number, status: ProcessStatus) {
    return prisma.careerProcess.update({
      where: {
        idProcess
      },
      data: {
        status
      },
      include: {
        user: true,
        table: true
      }
    })
  }

  async findAnyActiveProcessForUser(userId: number) {
    const activeStatuses: ProcessStatus[] = [
      ProcessStatus.DRAFT,
      ProcessStatus.SUBMITTED,
      ProcessStatus.UNDER_REVIEW,
      ProcessStatus.RETURNED,
      ProcessStatus.REJECTED
    ]

    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: {
          in: activeStatuses
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  }

  async findLastApprovedProcessForUser(userId: number) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED
      },
      orderBy: {
        intersticeEnd: "desc"
      }
    })
  }

  async findApprovedByInterstice(
    userId: number,
    intersticeStart: Date,
    intersticeEnd: Date,
    ignoreProcessId?: number
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED,
        intersticeStart,
        intersticeEnd,
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId
              }
            }
          : {})
      }
    })
  }

  async findApprovedByMovement(
    userId: number,
    processType: ProcessType,
    classeOrigem: string,
    nivelOrigem: string,
    classeDestino: string,
    nivelDestino: string,
    ignoreProcessId?: number
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED,
        type: processType,
        classeOrigem,
        nivelOrigem,
        classeDestino,
        nivelDestino,
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId
              }
            }
          : {})
      }
    })
  }

  async findByUserAndInterstice(
    userId: number,
    intersticeStart: Date,
    intersticeEnd: Date,
    ignoreProcessId?: number
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        intersticeStart: {
          lte: intersticeEnd
        },
        intersticeEnd: {
          gte: intersticeStart
        },
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId
              }
            }
          : {})
      }
    })
  }

  async softDelete(idProcess: number) {
    return prisma.careerProcess.update({
      where: {
        idProcess
      },
      data: {
        deletedDate: new Date()
      },
      include: {
        user: true,
        table: true
      }
    })
  }

  async updateProcess(
    idProcess: number,
    data: {
      campus?: string
      cidadeUF?: string
      intersticeStart?: Date
      intersticeEnd?: Date
      classeOrigem?: string
      nivelOrigem?: string
      classeDestino?: string
      nivelDestino?: string
    }
  ) {
    return prisma.careerProcess.update({
      where: {
        idProcess
      },
      data,
      include: {
        user: true,
        table: true
      }
    })
  }

  async listByUser(userId: number, statuses?: ProcessStatus[]) {
    return prisma.careerProcess.findMany({
      where: {
        userId,
        deletedDate: null,
        ...(statuses && statuses.length
          ? {
              status: {
                in: statuses
              }
            }
          : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: true,
        table: true
      }
    })
  }

  async listarParaCppdPorStatus(statuses: ProcessStatus[]) {
    return prisma.careerProcess.findMany({
      where: {
        deletedDate: null,
        status: { in: statuses }
      },
      orderBy: { updatedAt: "desc" },
      include: {
        user: { include: { docente: true } },
        table: true
      }
    })
  }

  async obterParaCppdPorId(processId: number) {
    return prisma.careerProcess.findFirst({
      where: {
        idProcess: processId,
        deletedDate: null
      },
      include: {
        user: { include: { docente: true } },
        table: true,
        ProcessStatusHistory: {
          where: { deletedDate: null },
          orderBy: { createdAt: "asc" },
          include: { changedBy: true }
        }
      }
    })
  }
}
