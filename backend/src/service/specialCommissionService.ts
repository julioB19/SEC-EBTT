import {
  AcceptanceStatus,
  CommissionStatus,
  ProcessStatus,
  ProcessTypeCategory,
  RoleName,
  SpecialCommissionMemberOrigin,
  SpecialCommissionMemberRole,
  SpecialCommissionType
} from "@prisma/client"
import { SpecialCommissionRepository } from "../repository/specialCommissionRepository"
import { BusinessRuleError, NotFoundError } from "./processoService"
import { FullProfessorProcedureService } from "./fullProfessorProcedureService"
import { assertTitularReady, assertSignedDecisionDocuments, calculateTitularEffects } from "./caseComplianceService"
import { prisma } from "../infra/prismaClient"
import { addCalendarDaysFromDateLabel } from "../util/proceduralDeadline"
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
  constructor(
    private readonly repository = new SpecialCommissionRepository(),
    private readonly fullProfessorProcedure = new FullProfessorProcedureService()
  ) {}

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
    const origin = dto.origin ?? SpecialCommissionMemberOrigin.EXTERNAL
    const evaluator = origin === SpecialCommissionMemberOrigin.INTERNAL
      ? await this.repository.findInternalEvaluatorByEmail(email)
      : await this.repository.findExternalEvaluatorByEmail(email)
    if (!evaluator?.personId || !evaluator.person) {
      throw new NotFoundError(
        origin === SpecialCommissionMemberOrigin.INTERNAL
          ? "Avaliador interno não encontrado para o e-mail informado"
          : "Avaliador externo não encontrado para o e-mail informado"
      )
    }

    if (
      process.processTypeConfig?.category === ProcessTypeCategory.RSC ||
      process.processTypeConfig?.category === ProcessTypeCategory.FULL_PROFESSOR
    ) {
      if (evaluator.personId === process.user.personId) {
        throw new BusinessRuleError("O docente interessado não pode integrar a própria comissão")
      }
      if (commission.members.length >= 4) {
        throw new BusinessRuleError("A comissão especial possui exatamente quatro membros")
      }
    }

    if (process.processTypeConfig?.category === ProcessTypeCategory.FULL_PROFESSOR) {
      if (origin === SpecialCommissionMemberOrigin.INTERNAL && dto.role !== SpecialCommissionMemberRole.PRESIDENT) {
        throw new BusinessRuleError("O membro interno deve ser indicado como presidente da comissão")
      }
      if (origin === SpecialCommissionMemberOrigin.EXTERNAL && dto.role === SpecialCommissionMemberRole.PRESIDENT) {
        throw new BusinessRuleError("A presidência da comissão deve ser exercida pelo membro interno")
      }
    }

    const appeal = await prisma.rscAppeal.findFirst({ where: { processId, status: "SUBMITTED", newCommissionId: commission.idSpecialCommission } })
    if (appeal?.originalCommissionId) {
      const previousMember = await prisma.specialCommissionMember.findFirst({ where: { specialCommissionId: appeal.originalCommissionId, personId: evaluator.personId } })
      if (previousMember) throw new BusinessRuleError("A comissão de recurso deve ter membros diferentes da comissão original")
    }
    if (process.processTypeConfig?.category === ProcessTypeCategory.FULL_PROFESSOR) {
      const nominee = await prisma.processNominee.findFirst({ where: { processId, email, membership: "PRIMARY", origin } })
      if (!nominee) throw new BusinessRuleError("O avaliador deve constar entre os titulares da lista validada de indicados")
    }
    const existing = await this.repository.findActiveMember(commission.idSpecialCommission, evaluator.personId)
    if (existing) throw new BusinessRuleError("Este avaliador já pertence à comissão")

    try {
      await this.repository.addExternalMember({
        processId,
        specialCommissionId: commission.idSpecialCommission,
        commissionType: commission.type,
        personId: evaluator.personId,
        origin,
        role: dto.role ?? SpecialCommissionMemberRole.MEMBER,
        sortOrder: commission.members.length,
        changedById: currentUserId
      })
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new BusinessRuleError("Este avaliador já pertence à comissão")
      }
      throw error
    }

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
    const process = await this.getManageableProcess(processId)
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
      if (commission.type === SpecialCommissionType.RSC) {
        this.assertRscComposition(commission)
      }
      if (commission.type === SpecialCommissionType.FULL_PROFESSOR) {
        this.assertFullProfessorComposition(commission)
        await assertTitularReady(processId, "ACTIVATE")
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
      if (process.processTypeConfig?.category === ProcessTypeCategory.FULL_PROFESSOR) {
        const procedure = await this.fullProfessorProcedure.get(processId, {
          userId: currentUserId,
          role: RoleName.CPPD_MEMBER
        })
        if (procedure.evaluationMode === "THESIS" && procedure.stage !== "THESIS_DEFENSE_RECORDED") {
          throw new BusinessRuleError("Registre a sessão e a gravação da defesa da tese antes de concluir a comissão")
        }
      }
    }

    await this.repository.updateStatus({
      commissionId: commission.idSpecialCommission,
      processId,
      status: dto.status,
      changedById: currentUserId,
      evaluationDeadlineAt:
        dto.status === CommissionStatus.ACTIVE && commission.ordinanceDate
          ? addCalendarDaysFromDateLabel(commission.ordinanceDate, 45, await prisma.academicCalendarPeriod.findMany({ where: { deletedAt: null, OR: [{ campusId: null }, { campusId: process.campusId ?? -1 }] } }))
          : undefined
    })
    if (
      dto.status === CommissionStatus.COMPLETED &&
      process.processTypeConfig?.category === ProcessTypeCategory.FULL_PROFESSOR
    ) {
      await this.fullProfessorProcedure.initializeAfterCommission(processId, currentUserId)
    }
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
        conflictDeclarationAt: member.conflictDeclarationAt,
        responseReason: member.responseReason,
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
    if (dto.response === AcceptanceStatus.ACCEPTED && dto.absenceOfConflictDeclared !== true) {
      throw new BusinessRuleError("Declare a ausência de conflito de interesses para aceitar o convite")
    }
    const responseReason = dto.reason?.trim() || null
    if (dto.response === AcceptanceStatus.DECLINED && !responseReason) {
      throw new BusinessRuleError("Informe o motivo da recusa")
    }

    await this.repository.respondToInvitation({
      memberId,
      userId,
      response: dto.response,
      absenceOfConflictDeclared: dto.absenceOfConflictDeclared === true,
      reason: responseReason
    })
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

    if (process.processTypeConfig?.category === ProcessTypeCategory.RSC) {
      this.assertRscComposition(commission)
      const favorable = submittedEvaluations.filter(evaluation =>
        evaluation.result === "DEFERRED" || evaluation.result === "APPROVED"
      ).length
      const expectedDecision = favorable >= 3 ? "APPROVED" : "REJECTED"
      if (dto.decision !== expectedDecision) {
        throw new BusinessRuleError("A decisão do RSC deve corresponder aos quatro pareceres: são necessários pelo menos três pareceres favoráveis")
      }
    }

    if (process.processTypeConfig?.category === ProcessTypeCategory.FULL_PROFESSOR) {
      const procedure = await this.fullProfessorProcedure.get(processId, {
        userId: currentUserId,
        role: RoleName.CPPD_MEMBER
      })
      if (procedure.stage !== "COMPLETED" || !procedure.currentOutcome) {
        throw new BusinessRuleError("Conclua o rito de reavaliação e recurso antes da decisão final")
      }
      const expectedDecision = procedure.currentOutcome === "APPROVED" ? "APPROVED" : "REJECTED"
      if (dto.decision !== expectedDecision) {
        throw new BusinessRuleError("A decisão da CPPD deve corresponder ao resultado final do rito")
      }
      if (dto.decision === "APPROVED") {
        const profile = process.user.docente
        if (!profile || profile.classLevel !== "C4" || !profile.start_interstice) {
          throw new BusinessRuleError("A concessão da Classe Titular exige vínculo ativo em C4")
        }
        const eligibleAt = new Date(profile.start_interstice)
        eligibleAt.setUTCMonth(eligibleAt.getUTCMonth() + 24)
        if (eligibleAt.getTime() > Date.now()) {
          throw new BusinessRuleError(
            "A concessão da Classe Titular exige 24 meses completos em C4",
            { eligibleAt: eligibleAt.toISOString(), requiredMonths: 24 }
          )
        }
      }
    }

    await assertSignedDecisionDocuments(processId, process.processTypeConfig?.category ?? "RSC", commission)
    const financialEffectsAt = dto.decision === "APPROVED" && process.processTypeConfig?.category === ProcessTypeCategory.FULL_PROFESSOR
      ? await calculateTitularEffects(processId) : null

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
      changedById: currentUserId,
      financialEffectsAt
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

  private assertFullProfessorComposition(commission: any) {
    if (commission.members.length !== 4) {
      throw new BusinessRuleError("A comissão da Classe Titular deve ter um membro interno e três externos")
    }
    const internalMembers = commission.members.filter(
      (member: any) => member.origin === SpecialCommissionMemberOrigin.INTERNAL
    )
    const externalMembers = commission.members.filter(
      (member: any) => member.origin === SpecialCommissionMemberOrigin.EXTERNAL
    )
    if (
      internalMembers.length !== 1 ||
      internalMembers[0].role !== SpecialCommissionMemberRole.PRESIDENT ||
      externalMembers.length !== 3 ||
      externalMembers.some((member: any) => member.role === SpecialCommissionMemberRole.SUBSTITUTE)
    ) {
      throw new BusinessRuleError(
        "A comissão da Classe Titular deve ter um presidente interno e três membros externos titulares"
      )
    }
  }

  private assertRscComposition(commission: any) {
    if (commission.members.length !== 4) {
      throw new BusinessRuleError("A comissão do RSC deve ter um membro interno e três externos")
    }
    const internalMembers = commission.members.filter(
      (member: any) => member.origin === SpecialCommissionMemberOrigin.INTERNAL
    )
    const externalMembers = commission.members.filter(
      (member: any) => member.origin === SpecialCommissionMemberOrigin.EXTERNAL
    )
    if (
      internalMembers.length !== 1 ||
      externalMembers.length !== 3 ||
      commission.members.some(
        (member: any) => member.role === SpecialCommissionMemberRole.SUBSTITUTE
      )
    ) {
      throw new BusinessRuleError(
        "A comissão do RSC deve ter um membro interno e três membros externos titulares"
      )
    }
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
            evaluationDeadlineAt: commission.evaluationDeadlineAt,
            evaluationOverdue: Boolean(
              commission.evaluationDeadlineAt &&
              new Date().getTime() > commission.evaluationDeadlineAt.getTime()
            ),
            members: commission.members.map((member: any) => ({
              idSpecialCommissionMember: member.idSpecialCommissionMember,
              name: member.person.name,
              email: member.person.email,
              origin: member.origin,
              role: member.role,
              sortOrder: member.sortOrder,
              acceptanceStatus: member.acceptanceStatus,
              acceptedAt: member.acceptedAt,
              conflictDeclarationAt: member.conflictDeclarationAt,
              responseReason: member.responseReason,
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
