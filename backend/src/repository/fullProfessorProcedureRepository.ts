import {
  FullProfessorProcedureEventType,
  FullProfessorProcedureOutcome,
  FullProfessorProcedureStage,
  Prisma
} from "@prisma/client"
import { prisma } from "../infra/prismaClient"

export class FullProfessorProcedureRepository {
  async findContext(processId: number) {
    const context = await prisma.careerProcess.findFirst({
      where: { idProcess: processId, deletedDate: null },
      include: {
        processTypeConfig: true,
        user: true,
        fullProfessorDetail: {
          include: {
            procedureEvents: {
              orderBy: { occurredAt: "asc" },
              include: { actor: { select: { idUser: true, name: true } } }
            }
          }
        },
        specialCommissions: {
          where: { deletedDate: null, status: { not: "CANCELED" } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            members: {
              where: { deletedDate: null },
              include: {
                individualEvaluations: {
                  where: { deletedDate: null },
                  orderBy: { createdAt: "desc" },
                  take: 1
                }
              }
            }
          }
        }
      }
    })
    if (!context) return null
    const calendarPeriods = await prisma.academicCalendarPeriod.findMany({ where: { deletedAt: null, OR: [{ campusId: null }, { campusId: context.campusId }] } })
    return { ...context, calendarPeriods }
  }

  async initialize(params: {
    processId: number
    actorId: number
    stage: FullProfessorProcedureStage
    outcome: FullProfessorProcedureOutcome
    initialOpinionAt: Date
    evaluationDeadlineAt: Date | null
    reassessmentDeadlineAt: Date | null
    oralDefenseDeadlineAt: Date | null
    appealDeadlineAt: Date | null
  }) {
    return prisma.$transaction(async tx => {
      const detail = await tx.fullProfessorProcessDetail.update({
        where: { processId: params.processId },
        data: {
          procedureStage: params.stage,
          currentOutcome: params.outcome,
          initialOpinionAt: params.initialOpinionAt,
          evaluationDeadlineAt: params.evaluationDeadlineAt,
          reassessmentDeadlineAt: params.reassessmentDeadlineAt,
          oralDefenseDeadlineAt: params.oralDefenseDeadlineAt,
          appealDeadlineAt: params.appealDeadlineAt
        }
      })
      await tx.fullProfessorProcedureEvent.create({
        data: {
          processId: params.processId,
          actorId: params.actorId,
          type: FullProfessorProcedureEventType.INITIAL_OUTCOME_RECORDED,
          details: {
            outcome: params.outcome,
            stage: params.stage
          }
        }
      })
      return detail
    })
  }

  async transition(params: {
    processId: number
    actorId: number
    eventType: FullProfessorProcedureEventType
    data: Prisma.FullProfessorProcessDetailUpdateInput
    details?: Prisma.InputJsonValue
  }) {
    return prisma.$transaction(async tx => {
      const detail = await tx.fullProfessorProcessDetail.update({
        where: { processId: params.processId },
        data: params.data
      })
      await tx.fullProfessorProcedureEvent.create({
        data: {
          processId: params.processId,
          actorId: params.actorId,
          type: params.eventType,
          details: params.details
        }
      })
      return detail
    })
  }
}
