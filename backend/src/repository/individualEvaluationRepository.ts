import { IndividualEvaluationStatus } from "@prisma/client"
import { auditActor } from "../util/requestActor"
import { prisma } from "../infra/prismaClient"

const assignmentInclude = {
  person: true,
  individualEvaluations: {
    where: { deletedDate: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      scores: {
        where: { deletedDate: null },
        orderBy: { itemId: "asc" as const }
      }
    }
  },
  specialCommission: {
    include: {
      process: {
        include: {
          user: { include: { docente: true } },
          processTypeConfig: true,
          table: {
            include: {
              nodes: {
                where: { deletedDate: null, active: true },
                orderBy: { sortOrder: "asc" as const }
              }
            }
          },
          scores: {
            where: { deletedDate: null },
            orderBy: { idProcessScore: "asc" as const },
            include: { item: true, evidenceFile: true }
          },
          rscDetail: { include: { reportFile: true } },
          fullProfessorDetail: {
            include: {
              memorialFile: true,
              thesisFile: true,
              doctorateDegree: { include: { evidenceFile: true } }
            }
          }
        }
      }
    }
  }
}

export class IndividualEvaluationRepository {
  async findAssignmentForUser(memberId: number, userId: number) {
    return prisma.specialCommissionMember.findFirst({
      where: {
        idSpecialCommissionMember: memberId,
        deletedDate: null,
        person: {
          users: {
            some: { idUser: userId, active: true, deletedDate: null }
          }
        }
      },
      include: assignmentInclude
    })
  }

  async saveEvaluation(params: {
    evaluationId: number
    status: IndividualEvaluationStatus
    result: any
    opinionText: string | null
    recognizedPoints: string | null
    scores: Array<{
      itemId: number
      quantity: number
      awardedPoints: number
      evaluatorComment?: string | null
    }>
  }) {
    return prisma.$transaction(async tx => {
      const previous = await tx.individualEvaluation.findUniqueOrThrow({ where: { idIndividualEvaluation: params.evaluationId }, include: { process: true, scores: true } })
      await tx.processAudit.create({ data: { processId: previous.processId, actorId: auditActor(previous.process.userId), action: "INDIVIDUAL_EVALUATION_CHANGED", details: { evaluationId: params.evaluationId, previous: { status: previous.status, result: previous.result, opinion: previous.opinionText, scores: previous.scores.map(value => ({ itemId: value.itemId, quantity: value.quantity, points: String(value.awardedPoints) })) }, current: { status: params.status, result: params.result, opinion: params.opinionText, scores: params.scores } } } })
      const itemIds = params.scores.map(score => score.itemId)

      await tx.individualEvaluationScore.updateMany({
        where: {
          individualEvaluationId: params.evaluationId,
          deletedDate: null,
          ...(itemIds.length > 0 ? { itemId: { notIn: itemIds } } : {})
        },
        data: { deletedDate: new Date() }
      })

      for (const score of params.scores) {
        await tx.individualEvaluationScore.upsert({
          where: {
            individualEvaluationId_itemId: {
              individualEvaluationId: params.evaluationId,
              itemId: score.itemId
            }
          },
          create: {
            individualEvaluationId: params.evaluationId,
            itemId: score.itemId,
            quantity: score.quantity,
            awardedPoints: score.awardedPoints.toFixed(2),
            evaluatorComment: score.evaluatorComment?.trim() || null
          },
          update: {
            quantity: score.quantity,
            awardedPoints: score.awardedPoints.toFixed(2),
            evaluatorComment: score.evaluatorComment?.trim() || null,
            deletedDate: null
          }
        })
      }

      return tx.individualEvaluation.update({
        where: { idIndividualEvaluation: params.evaluationId },
        data: {
          status: params.status,
          result: params.result,
          opinionText: params.opinionText,
          recognizedPoints: params.recognizedPoints,
          submittedAt: params.status === IndividualEvaluationStatus.SUBMITTED ? new Date() : null
        }
      })
    })
  }
}
