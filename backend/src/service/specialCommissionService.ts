import {
  AcceptanceStatus,
  CommissionStatus,
  ProcessStatus,
  ProcessTypeCategory,
  SpecialCommissionMemberRole,
  SpecialCommissionType
} from "@prisma/client"
import { SpecialCommissionRepository } from "../repository/specialCommissionRepository"
import { BusinessRuleError, NotFoundError } from "./processoService"
import {
  AddSpecialCommissionMemberDto,
  FinalizeSpecialCommissionDecisionDto,
  RespondSpecialCommissionInvitationDto,
  SaveSpecialCommissionDto,
  UpdateSpecialCommissionStatusDto
} from "../type/dto/specialCommissionDto"

const manageableProcessStatuses: ProcessStatus[] = [
  ProcessStatus.SUBMITTED,
  ProcessStatus.UNDER_REVIEW,
  ProcessStatus.AWAITING_EVALUATOR_ACCEPTANCE,
  ProcessStatus.AWAITING_ORDINANCE,
  ProcessStatus.IN_EVALUATION
]

export class SpecialCommissionService {
  constructor(private readonly repository = new SpecialCommissionRepository()) {}

  async getForProcess(processId: number) {
    const process = await this.getEligibleProcess(processId)
    const commission = await this.repository.findCurrentByProcess(processId)
    return this.mapProcessResult(process, commission)
  }

  async save(processId: number, dto: SaveSpecialCommissionDto) {
    const process = await this.getManageableProcess(processId)
    const current = await this.repository.findCurrentByProcess(processId)
    if (current && current.status !== CommissionStatus.DRAFT) {
      throw new BusinessRuleError("Somente comissões em rascunho podem ser alteradas")
    }

    const ordinance = dto.ordinance?.trim() || null
    const ordinanceDate = dto.ordinanceDate ? new Date(dto.ordinanceDate) : null
    const commission = current
      ? await this.repository.updateDetails(current.idSpecialCommission, ordinance, ordinanceDate)
      : await this.repository.create(processId, this.commissionTypeForProcess(process))

    const saved = current
      ? commission
      : ordinance || ordinanceDate
        ? await this.repository.updateDetails(commission.idSpecialCommission, ordinance, ordinanceDate)
        : commission
    return this.mapProcessResult(process, saved)
  }

  async addExternalMember(processId: number, currentUserId: number, dto: AddSpecialCommissionMemberDto) {
    const process = await this.getManageableProcess(processId)
    let commission = await this.repository.findCurrentByProcess(processId)
    if (!commission) {
      commission = await this.repository.create(processId, this.commissionTypeForProcess(process))
    }
    if (commission.status !== CommissionStatus.DRAFT) {
      throw new BusinessRuleError("Não é possível adicionar membros após a ativação da comissão")
    }

    const email = dto.email.trim().toLowerCase()
    const evaluator = await this.repository.findExternalEvaluatorByEmail(email)
    if (!evaluator?.personId || !evaluator.person) {
      throw new NotFoundError("Avaliador externo não encontrado para o e-mail informado")
    }

    const existing = await this.repository.findActiveMember(commission.idSpecialCommission, evaluator.personId)
    if (existing) throw new BusinessRuleError("Este avaliador já pertence à comissão")

    await this.repository.addExternalMember({
      processId,
      specialCommissionId: commission.idSpecialCommission,
      commissionType: commission.type,
      personId: evaluator.personId,
      role: dto.role ?? SpecialCommissionMemberRole.MEMBER,
      sortOrder: commission.members.length,
      changedById: currentUserId
    })

    return this.getForProcess(processId)
  }

  async removeMember(processId: number, memberId: number) {
    await this.getManageableProcess(processId)
    const member = await this.repository.findMember(memberId)
    if (!member || member.specialCommission.processId !== processId) {
      throw new NotFoundError("Membro da comissão não encontrado")
    }
    if (member.specialCommission.status !== CommissionStatus.DRAFT) {
      throw new BusinessRuleError("Não é possível remover membros após a ativação da comissão")
    }

    await this.repository.removeMember(processId, memberId)
    return this.getForProcess(processId)
  }

  async updateStatus(processId: number, currentUserId: number, dto: UpdateSpecialCommissionStatusDto) {
    await this.getManageableProcess(processId)
    const commission = await this.repository.findCurrentByProcess(processId)
    if (!commission) throw new NotFoundError("Comissão especial não encontrada")

    if (dto.status === CommissionStatus.ACTIVE) {
      if (commission.status !== CommissionStatus.DRAFT) {
        throw new BusinessRuleError("Somente comissões em rascunho podem ser ativadas")
      }
      if (!commission.ordinance || !commission.ordinanceDate) {
        throw new BusinessRuleError("Informe a portaria e a data da portaria antes de ativar a comissão")
      }
      if (commission.members.length === 0) {
        throw new BusinessRuleError("Adicione ao menos um membro antes de ativar a comissão")
      }
      const notAccepted = commission.members.filter(member => member.acceptanceStatus !== AcceptanceStatus.ACCEPTED)
      if (notAccepted.length > 0) {
        throw new BusinessRuleError("Todos os membros precisam aceitar o convite antes da ativação")
      }
    }

    if (dto.status === CommissionStatus.COMPLETED) {
      if (commission.status !== CommissionStatus.ACTIVE) {
        throw new BusinessRuleError("Somente comissões ativas podem ser concluídas")
      }
      const pendingEvaluations = commission.members.filter(member => {
        const evaluation = member.individualEvaluations[0]
        return (
          member.acceptanceStatus === AcceptanceStatus.ACCEPTED &&
          evaluation?.status !== "SUBMITTED"
        )
      })
      if (pendingEvaluations.length > 0) {
        throw new BusinessRuleError("Todos os membros precisam enviar a avaliação individual antes da conclusão")
      }
    }

    await this.repository.updateStatus({
      commissionId: commission.idSpecialCommission,
      processId,
      status: dto.status,
      changedById: currentUserId
    })
    return this.getForProcess(processId)
  }

  async listAssignments(userId: number) {
    const assignments = await this.repository.listAssignmentsForUser(userId)
    return assignments.map(member => {
      const commission = member.specialCommission
      const process = commission.process
      const evaluation = member.individualEvaluations[0] ?? null

      return {
        memberId: member.idSpecialCommissionMember,
        acceptanceStatus: member.acceptanceStatus,
        acceptedAt: member.acceptedAt,
        role: member.role,
        origin: member.origin,
        commission: {
          idSpecialCommission: commission.idSpecialCommission,
          type: commission.type,
          status: commission.status,
          ordinance: commission.ordinance,
          ordinanceDate: commission.ordinanceDate
        },
        process: {
          idProcess: process.idProcess,
          status: process.status,
          processTypeCode: process.processTypeConfig?.code ?? process.type,
          processTypeName: process.processTypeConfig?.name ?? process.type,
          processTypeCategory: process.processTypeConfig?.category ?? null,
          campus: process.campus,
          cityState: process.cidadeUF,
          teacherName: process.user.name,
          teacherSiape: process.user.docente?.siape ?? null,
          submittedAt: process.submittedAt,
          updatedAt: process.updatedAt
        },
        evaluation: evaluation
          ? {
              idIndividualEvaluation: evaluation.idIndividualEvaluation,
              status: evaluation.status,
              result: evaluation.result,
              recognizedPoints:
                evaluation.recognizedPoints === null ? null : Number(evaluation.recognizedPoints),
              opinionText: evaluation.opinionText,
              submittedAt: evaluation.submittedAt
            }
          : null
      }
    })
  }

  async respond(userId: number, memberId: number, dto: RespondSpecialCommissionInvitationDto) {
    const member = await this.repository.findMember(memberId)
    if (!member || !member.person.users.some(user => user.idUser === userId)) {
      throw new NotFoundError("Convite de comissão não encontrado")
    }
    if (member.specialCommission.status === CommissionStatus.CANCELED) {
      throw new BusinessRuleError("Esta comissão foi cancelada")
    }
    if (member.acceptanceStatus !== AcceptanceStatus.PENDING) {
      throw new BusinessRuleError("Este convite já foi respondido")
    }

    await this.repository.respondToInvitation(memberId, userId, dto.response)
    return this.listAssignments(userId)
  }

  async finalizeDecision(
    processId: number,
    currentUserId: number,
    dto: FinalizeSpecialCommissionDecisionDto
  ) {
    const process = await this.getEligibleProcess(processId)
    if (process.status !== ProcessStatus.UNDER_REVIEW) {
      throw new BusinessRuleError("O processo não está aguardando a decisão da CPPD")
    }

    const commission = await this.repository.findCurrentByProcess(processId)
    if (!commission || commission.status !== CommissionStatus.COMPLETED) {
      throw new BusinessRuleError("Conclua a comissão especial antes de registrar a decisão da CPPD")
    }

    const submittedEvaluations = commission.members
      .map(member => member.individualEvaluations[0])
      .filter(evaluation => evaluation?.status === "SUBMITTED")
    if (submittedEvaluations.length !== commission.members.length || commission.members.length === 0) {
      throw new BusinessRuleError("Todas as avaliações individuais precisam estar enviadas")
    }

    const pointValues = submittedEvaluations
      .filter(evaluation => evaluation.recognizedPoints !== null)
      .map(evaluation => Number(evaluation.recognizedPoints))
    const finalPoints = pointValues.length
      ? (pointValues.reduce((total, points) => total + points, 0) / pointValues.length).toFixed(2)
      : null

    await this.repository.finalizeDecision({
      processId,
      decision: dto.decision,
      opinionText: dto.opinionText.trim(),
      finalPoints,
      changedById: currentUserId
    })
    return this.getForProcess(processId)
  }

  private async getEligibleProcess(processId: number) {
    const process = await this.repository.findProcess(processId)
    if (!process) throw new NotFoundError("Processo não encontrado")

    const config = process.processTypeConfig
    if (!config?.requiresCommittee) {
      throw new BusinessRuleError("Este tipo de processo não utiliza comissão especial")
    }
    if (config.category !== ProcessTypeCategory.RSC && config.category !== ProcessTypeCategory.FULL_PROFESSOR) {
      throw new BusinessRuleError("Categoria de processo incompatível com comissão especial")
    }
    return process
  }

  private async getManageableProcess(processId: number) {
    const process = await this.getEligibleProcess(processId)
    if (!manageableProcessStatuses.includes(process.status)) {
      throw new BusinessRuleError("O processo não está em uma etapa que permita gerenciar a comissão")
    }
    return process
  }

  private commissionTypeForProcess(process: any): SpecialCommissionType {
    return process.processTypeConfig.category === ProcessTypeCategory.RSC
      ? SpecialCommissionType.RSC
      : SpecialCommissionType.FULL_PROFESSOR
  }

  private mapProcessResult(process: any, commission: any) {
    const submittedEvaluations = commission
      ? commission.members
          .map((member: any) => ({ member, evaluation: member.individualEvaluations[0] }))
          .filter(({ evaluation }: any) => evaluation?.status === "SUBMITTED")
      : []
    const scoredEvaluations = submittedEvaluations.filter(
      ({ evaluation }: any) => evaluation.recognizedPoints !== null
    )
    const averageRecognizedPoints = scoredEvaluations.length
      ? Number(
          (
            scoredEvaluations.reduce(
              (total: number, { evaluation }: any) => total + Number(evaluation.recognizedPoints),
              0
            ) / scoredEvaluations.length
          ).toFixed(2)
        )
      : null

    return {
      process: {
        idProcess: process.idProcess,
        status: process.status,
        processTypeCode: process.processTypeConfig?.code ?? process.type,
        processTypeName: process.processTypeConfig?.name ?? process.type,
        processTypeCategory: process.processTypeConfig?.category ?? null,
        teacherName: process.user.name,
        teacherSiape: process.user.docente?.siape ?? null,
        campus: process.campus,
        cityState: process.cidadeUF,
        requiresGecc: process.processTypeConfig?.requiresGecc ?? false,
        finalPoints: process.finalPoints === null ? null : Number(process.finalPoints),
        evaluationOpinion: process.evaluationOpinion
      },
      commission: commission
        ? {
            idSpecialCommission: commission.idSpecialCommission,
            type: commission.type,
            status: commission.status,
            ordinance: commission.ordinance,
            ordinanceDate: commission.ordinanceDate,
            members: commission.members.map((member: any) => ({
              idSpecialCommissionMember: member.idSpecialCommissionMember,
              name: member.person.name,
              email: member.person.email,
              origin: member.origin,
              role: member.role,
              sortOrder: member.sortOrder,
              acceptanceStatus: member.acceptanceStatus,
              acceptedAt: member.acceptedAt,
              evaluation: member.individualEvaluations[0]
                ? {
                    idIndividualEvaluation: member.individualEvaluations[0].idIndividualEvaluation,
                    status: member.individualEvaluations[0].status,
                    result: member.individualEvaluations[0].result,
                    recognizedPoints:
                      member.individualEvaluations[0].recognizedPoints === null
                        ? null
                        : Number(member.individualEvaluations[0].recognizedPoints),
                    opinionText: member.individualEvaluations[0].opinionText,
                    submittedAt: member.individualEvaluations[0].submittedAt
                  }
                : null
            })),
            consolidation: {
              totalMembers: commission.members.length,
              submittedCount: submittedEvaluations.length,
              pendingCount: commission.members.length - submittedEvaluations.length,
              allSubmitted:
                commission.members.length > 0 && submittedEvaluations.length === commission.members.length,
              averageRecognizedPoints,
              results: submittedEvaluations.reduce((summary: Record<string, number>, { evaluation }: any) => {
                if (evaluation.result) summary[evaluation.result] = (summary[evaluation.result] ?? 0) + 1
                return summary
              }, {}),
              opinions: submittedEvaluations.map(({ member, evaluation }: any) => ({
                memberId: member.idSpecialCommissionMember,
                evaluatorName: member.person.name,
                result: evaluation.result,
                recognizedPoints:
                  evaluation.recognizedPoints === null ? null : Number(evaluation.recognizedPoints),
                opinionText: evaluation.opinionText,
                submittedAt: evaluation.submittedAt
              }))
            }
          }
        : null
    }
  }
}
