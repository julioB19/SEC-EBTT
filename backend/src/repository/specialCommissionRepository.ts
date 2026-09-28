import {
  AcceptanceStatus,
  CommissionStatus,
  IndividualEvaluationStatus,
  IndividualEvaluationType,
  ProcessStatus,
  RoleName,
  SpecialCommissionMemberOrigin,
  SpecialCommissionMemberRole,
  SpecialCommissionType
} from "@prisma/client"
import { prisma } from "../infra/prismaClient"

const commissionInclude = {
  members: {
    where: { deletedDate: null },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      person: true,
      individualEvaluations: {
        where: { deletedDate: null },
        orderBy: { createdAt: "desc" as const },
        take: 1
      }
    }
  }
}

export class SpecialCommissionRepository {
  async findProcess(processId: number) {
    return prisma.careerProcess.findFirst({
      where: { idProcess: processId, deletedDate: null },
      include: {
        user: { include: { docente: true } },
        processTypeConfig: true
      }
    })
  }

  async findCurrentByProcess(processId: number) {
    return prisma.specialCommission.findFirst({
      where: {
        processId,
        deletedDate: null,
        status: { not: CommissionStatus.CANCELED }
      },
      orderBy: { createdAt: "desc" },
      include: commissionInclude
    })
  }

  async create(processId: number, type: SpecialCommissionType) {
    return prisma.specialCommission.create({
      data: { processId, type },
      include: commissionInclude
    })
  }

  async updateDetails(idSpecialCommission: number, ordinance: string | null, ordinanceDate: Date | null) {
    return prisma.specialCommission.update({
      where: { idSpecialCommission },
      data: { ordinance, ordinanceDate },
      include: commissionInclude
    })
  }

  async findExternalEvaluatorByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email,
        active: true,
        deletedDate: null,
        externalEvaluator: { is: { active: true, deletedDate: null } },
        roles: {
          some: {
            deletedDate: null,
            role: { name: RoleName.EXTERNAL_EVALUATOR, deletedDate: null }
          }
        }
      },
      include: { person: true, externalEvaluator: true }
    })
  }

  async findActiveMember(specialCommissionId: number, personId: number) {
    return prisma.specialCommissionMember.findFirst({
      where: { specialCommissionId, personId, deletedDate: null }
    })
  }

  async addExternalMember(params: {
    processId: number
    specialCommissionId: number
    commissionType: SpecialCommissionType
    personId: number
    role: SpecialCommissionMemberRole
    sortOrder: number
    changedById: number
  }) {
    return prisma.$transaction(async tx => {
      const key = {
        specialCommissionId_personId: {
          specialCommissionId: params.specialCommissionId,
          personId: params.personId
        }
      }

      const existing = await tx.specialCommissionMember.findUnique({ where: key })
      const member = existing
        ? await tx.specialCommissionMember.update({
            where: key,
            data: {
              origin: SpecialCommissionMemberOrigin.EXTERNAL,
              role: params.role,
              sortOrder: params.sortOrder,
              acceptanceStatus: AcceptanceStatus.PENDING,
              acceptedAt: null,
              deletedDate: null
            }
          })
        : await tx.specialCommissionMember.create({
            data: {
              specialCommissionId: params.specialCommissionId,
              personId: params.personId,
              origin: SpecialCommissionMemberOrigin.EXTERNAL,
              role: params.role,
              sortOrder: params.sortOrder
            }
          })

      const evaluationType =
        params.commissionType === SpecialCommissionType.RSC
          ? IndividualEvaluationType.RSC
          : IndividualEvaluationType.FULL_PROFESSOR
      const currentEvaluation = await tx.individualEvaluation.findFirst({
        where: { processId: params.processId, memberId: member.idSpecialCommissionMember },
        orderBy: { createdAt: "desc" }
      })

      if (currentEvaluation) {
        await tx.individualEvaluation.update({
          where: { idIndividualEvaluation: currentEvaluation.idIndividualEvaluation },
          data: {
            type: evaluationType,
            status: IndividualEvaluationStatus.DRAFT,
            result: null,
            recognizedPoints: null,
            opinionText: null,
            submittedAt: null,
            deletedDate: null
          }
        })
      } else {
        await tx.individualEvaluation.create({
          data: {
            processId: params.processId,
            memberId: member.idSpecialCommissionMember,
            type: evaluationType
          }
        })
      }

      const process = await tx.careerProcess.findUnique({ where: { idProcess: params.processId } })
      if (process && process.status !== ProcessStatus.AWAITING_EVALUATOR_ACCEPTANCE) {
        await tx.careerProcess.update({
          where: { idProcess: params.processId },
          data: { status: ProcessStatus.AWAITING_EVALUATOR_ACCEPTANCE }
        })
        await tx.processStatusHistory.create({
          data: {
            processId: params.processId,
            fromStatus: process.status,
            toStatus: ProcessStatus.AWAITING_EVALUATOR_ACCEPTANCE,
            changedById: params.changedById,
            note: "External evaluator added to special commission"
          }
        })
      }

      return member
    })
  }

  async removeMember(processId: number, memberId: number) {
    return prisma.$transaction(async tx => {
      await tx.individualEvaluation.updateMany({
        where: { processId, memberId, deletedDate: null },
        data: {
          status: IndividualEvaluationStatus.CANCELED,
          deletedDate: new Date()
        }
      })

      return tx.specialCommissionMember.update({
        where: { idSpecialCommissionMember: memberId },
        data: {
          acceptanceStatus: AcceptanceStatus.CANCELED,
          acceptedAt: null,
          deletedDate: new Date()
        }
      })
    })
  }

  async findMember(memberId: number) {
    return prisma.specialCommissionMember.findFirst({
      where: { idSpecialCommissionMember: memberId, deletedDate: null },
      include: {
        person: { include: { users: true } },
        specialCommission: {
          include: { process: { include: { processTypeConfig: true, user: true } } }
        }
      }
    })
  }

  async respondToInvitation(memberId: number, userId: number, response: AcceptanceStatus) {
    return prisma.$transaction(async tx => {
      const member = await tx.specialCommissionMember.update({
        where: { idSpecialCommissionMember: memberId },
        data: {
          acceptanceStatus: response,
          acceptedAt: response === AcceptanceStatus.ACCEPTED ? new Date() : null
        }
      })

      if (response === AcceptanceStatus.ACCEPTED) {
        const pendingCount = await tx.specialCommissionMember.count({
          where: {
            specialCommissionId: member.specialCommissionId,
            deletedDate: null,
            acceptanceStatus: { not: AcceptanceStatus.ACCEPTED }
          }
        })

        if (pendingCount === 0) {
          const commission = await tx.specialCommission.findUnique({
            where: { idSpecialCommission: member.specialCommissionId },
            include: { process: true }
          })
          if (commission && commission.process.status !== ProcessStatus.AWAITING_ORDINANCE) {
            const nextStatus =
              commission.status === CommissionStatus.ACTIVE
                ? ProcessStatus.IN_EVALUATION
                : ProcessStatus.AWAITING_ORDINANCE
            await tx.careerProcess.update({
              where: { idProcess: commission.processId },
              data: { status: nextStatus }
            })
            await tx.processStatusHistory.create({
              data: {
                processId: commission.processId,
                fromStatus: commission.process.status,
                toStatus: nextStatus,
                changedById: userId,
                note: "All special commission members accepted the invitation"
              }
            })
          }
        }
      }

      return member
    })
  }

  async updateStatus(params: {
    commissionId: number
    processId: number
    status: CommissionStatus
    changedById: number
  }) {
    return prisma.$transaction(async tx => {
      const process = await tx.careerProcess.findUnique({ where: { idProcess: params.processId } })
      const commission = await tx.specialCommission.update({
        where: { idSpecialCommission: params.commissionId },
        data: { status: params.status },
        include: commissionInclude
      })

      if (!process) return commission

      const nextProcessStatus =
        params.status === CommissionStatus.ACTIVE ? ProcessStatus.IN_EVALUATION : ProcessStatus.UNDER_REVIEW
      if (process.status !== nextProcessStatus) {
        await tx.careerProcess.update({
          where: { idProcess: params.processId },
          data: { status: nextProcessStatus }
        })
        await tx.processStatusHistory.create({
          data: {
            processId: params.processId,
            fromStatus: process.status,
            toStatus: nextProcessStatus,
            changedById: params.changedById,
            note:
              params.status === CommissionStatus.ACTIVE
                ? "Special commission activated"
                : params.status === CommissionStatus.COMPLETED
                  ? "Special commission completed"
                  : "Special commission canceled"
          }
        })
      }

      if (params.status === CommissionStatus.CANCELED) {
        await tx.specialCommissionMember.updateMany({
          where: { specialCommissionId: params.commissionId, deletedDate: null },
          data: { acceptanceStatus: AcceptanceStatus.CANCELED, deletedDate: new Date() }
        })
        await tx.individualEvaluation.updateMany({
          where: {
            processId: params.processId,
            member: { specialCommissionId: params.commissionId },
            deletedDate: null
          },
          data: { status: IndividualEvaluationStatus.CANCELED, deletedDate: new Date() }
        })
      }

      return commission
    })
  }

  async finalizeDecision(params: {
    processId: number
    decision: "APPROVED" | "REJECTED"
    opinionText: string
    finalPoints: string | null
    changedById: number
  }) {
    return prisma.$transaction(async tx => {
      const process = await tx.careerProcess.findUnique({
        where: { idProcess: params.processId },
        include: { processTypeConfig: true, rscDetail: true }
      })
      if (!process) return null

      const nextStatus =
        params.decision === "APPROVED"
          ? process.processTypeConfig?.requiresGecc
            ? ProcessStatus.AWAITING_GECC
            : ProcessStatus.APPROVED
          : ProcessStatus.REJECTED

      const updated = await tx.careerProcess.update({
        where: { idProcess: params.processId },
        data: {
          status: nextStatus,
          finalPoints: params.finalPoints,
          evaluationOpinion: params.opinionText
        }
      })

      if (process.rscDetail) {
        await tx.rscProcessDetail.update({
          where: { processId: params.processId },
          data: { finalResult: params.decision }
        })
      }

      if (nextStatus === ProcessStatus.AWAITING_GECC) {
        const existingGecc = await tx.processGecc.findFirst({
          where: { processOriginId: params.processId, deletedDate: null }
        })
        if (!existingGecc) {
          await tx.processGecc.create({
            data: {
              processOriginId: params.processId,
              externalNumber: process.externalNumber
            }
          })
        }
      }

      await tx.processStatusHistory.create({
        data: {
          processId: params.processId,
          fromStatus: process.status,
          toStatus: nextStatus,
          changedById: params.changedById,
          note:
            params.decision === "APPROVED"
              ? "Special commission opinion approved by CPPD"
              : "Special commission opinion rejected by CPPD"
        }
      })

      return updated
    })
  }

  async listAssignmentsForUser(userId: number) {
    const user = await prisma.user.findFirst({
      where: { idUser: userId, active: true, deletedDate: null },
      select: { personId: true }
    })
    if (!user?.personId) return []

    return prisma.specialCommissionMember.findMany({
      where: {
        personId: user.personId,
        deletedDate: null,
        acceptanceStatus: { not: AcceptanceStatus.CANCELED },
        specialCommission: {
          deletedDate: null,
          status: { not: CommissionStatus.CANCELED },
          process: { deletedDate: null }
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        individualEvaluations: {
          where: { deletedDate: null },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        specialCommission: {
          include: {
            process: {
              include: {
                user: { include: { docente: true } },
                processTypeConfig: true
              }
            }
          }
        }
      }
    })
  }
}
