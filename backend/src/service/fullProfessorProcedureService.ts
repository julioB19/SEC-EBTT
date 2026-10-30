import {
  CommissionStatus,
  FullProfessorEvaluationMode,
  FullProfessorProcedureEventType,
  FullProfessorProcedureOutcome,
  FullProfessorProcedureStage,
  IndividualEvaluationStatus,
  ProcessTypeCategory,
  RoleName
} from "@prisma/client"
import { FullProfessorProcedureRepository } from "../repository/fullProfessorProcedureRepository"
import { FullProfessorProcedureActionDto } from "../type/dto/fullProfessorProcedureDto"
import {
  addBusinessDaysDeadline,
  addCalendarDaysDeadline,
  deadlineExpired
} from "../util/proceduralDeadline"
import { BusinessRuleError, NotFoundError } from "./processoService"

type ProcedureActor = { userId: number; role: RoleName }

const cppdRoles = new Set<RoleName>([RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL])

export class FullProfessorProcedureService {
  constructor(
    private readonly repository = new FullProfessorProcedureRepository(),
    private readonly clock: () => Date = () => new Date()
  ) {}

  async get(processId: number, actor: ProcedureActor) {
    const context = await this.getContext(processId)
    this.assertActorAccess(context, actor)
    return this.map(context, actor)
  }

  async initializeAfterCommission(processId: number, actorId: number) {
    const context = await this.getContext(processId)
    const detail = context.fullProfessorDetail!
    if (detail.initialOpinionAt) return detail

    const commission = context.specialCommissions[0]
    if (!commission || commission.status !== CommissionStatus.COMPLETED) {
      throw new BusinessRuleError("A comissão da Classe Titular ainda não foi concluída")
    }
    const evaluations = commission.members
      .map(member => member.individualEvaluations[0])
      .filter(evaluation => evaluation?.status === IndividualEvaluationStatus.SUBMITTED)
    if (commission.members.length !== 4 || evaluations.length !== 4) {
      throw new BusinessRuleError("A Classe Titular exige quatro pareceres individuais enviados")
    }

    const now = this.clock()
    const approvedCount = evaluations.filter(evaluation =>
      evaluation.result === "APPROVED" || evaluation.result === "DEFERRED"
    ).length
    const outcome = approvedCount >= 3
      ? FullProfessorProcedureOutcome.APPROVED
      : FullProfessorProcedureOutcome.REJECTED
    const isMemorial = detail.evaluationMode === FullProfessorEvaluationMode.MEMORIAL
    const stage = outcome === FullProfessorProcedureOutcome.APPROVED
      ? FullProfessorProcedureStage.COMPLETED
      : isMemorial
        ? FullProfessorProcedureStage.AWAITING_REASSESSMENT
        : FullProfessorProcedureStage.AWAITING_APPEAL

    return this.repository.initialize({
      processId,
      actorId,
      stage,
      outcome,
      initialOpinionAt: now,
      evaluationDeadlineAt: commission.evaluationDeadlineAt,
      reassessmentDeadlineAt:
        stage === FullProfessorProcedureStage.AWAITING_REASSESSMENT
          ? addBusinessDaysDeadline(now, 2, context.calendarPeriods ?? [])
          : null,
      oralDefenseDeadlineAt:
        isMemorial && outcome === FullProfessorProcedureOutcome.REJECTED
          ? addCalendarDaysDeadline(now, 30, context.calendarPeriods ?? [])
          : null,
      appealDeadlineAt:
        stage === FullProfessorProcedureStage.AWAITING_APPEAL
          ? addBusinessDaysDeadline(now, 2, context.calendarPeriods ?? [])
          : null
    })
  }

  async execute(processId: number, actor: ProcedureActor, dto: FullProfessorProcedureActionDto) {
    const context = await this.getContext(processId)
    this.assertActorAccess(context, actor)
    const detail = context.fullProfessorDetail!
    const now = this.clock()

    switch (dto.action) {
      case "REQUEST_REASSESSMENT": {
        this.assertTeacher(actor)
        this.assertStage(detail.procedureStage, FullProfessorProcedureStage.AWAITING_REASSESSMENT)
        this.assertOpenDeadline(detail.reassessmentDeadlineAt, now, "O prazo para pedir reavaliação terminou")
        const reason = this.requiredText(dto.reason, "Informe a justificativa do pedido de reavaliação")
        await this.repository.transition({
          processId,
          actorId: actor.userId,
          eventType: FullProfessorProcedureEventType.REASSESSMENT_REQUESTED,
          data: {
            procedureStage: FullProfessorProcedureStage.REASSESSMENT_REQUESTED,
            reassessmentRequestedAt: now,
            reassessmentReason: reason
          },
          details: { reason }
        })
        break
      }
      case "SCHEDULE_ORAL_DEFENSE": {
        this.assertCppd(actor)
        const thesisInitialDefense =
          detail.evaluationMode === FullProfessorEvaluationMode.THESIS &&
          detail.procedureStage === FullProfessorProcedureStage.INITIAL_EVALUATION
        if (!thesisInitialDefense) {
          this.assertStage(detail.procedureStage, FullProfessorProcedureStage.REASSESSMENT_REQUESTED)
        }
        const scheduledAt = this.requiredDate(dto.scheduledAt, "Informe a data da defesa oral")
        if (scheduledAt <= now) throw new BusinessRuleError("A defesa oral deve ser agendada para uma data futura")
        const scheduleDeadline = thesisInitialDefense
          ? context.specialCommissions[0]?.evaluationDeadlineAt
          : detail.oralDefenseDeadlineAt
        if (scheduleDeadline && scheduledAt > scheduleDeadline) {
          throw new BusinessRuleError(
            thesisInitialDefense
              ? "A defesa da tese deve ocorrer dentro do prazo de 45 dias da comissão"
              : "A defesa oral deve ocorrer em até 30 dias após o parecer"
          )
        }
        const accessUrl = this.requiredText(dto.accessUrl, "Informe o endereço de acesso à defesa oral")
        await this.repository.transition({
          processId,
          actorId: actor.userId,
          eventType: FullProfessorProcedureEventType.ORAL_DEFENSE_SCHEDULED,
          data: {
            procedureStage: FullProfessorProcedureStage.ORAL_DEFENSE_SCHEDULED,
            oralDefenseScheduledAt: scheduledAt,
            oralDefenseAccessUrl: accessUrl
          },
          details: { scheduledAt: scheduledAt.toISOString(), accessUrl }
        })
        break
      }
      case "RECORD_ORAL_DEFENSE": {
        this.assertCppd(actor)
        this.assertStage(detail.procedureStage, FullProfessorProcedureStage.ORAL_DEFENSE_SCHEDULED)
        const heldAt = dto.heldAt ? this.requiredDate(dto.heldAt, "Data inválida") : now
        if (heldAt > now) throw new BusinessRuleError("A defesa oral ainda não ocorreu")
        const recordingUrl = this.requiredText(dto.recordingUrl, "Informe o endereço da gravação da defesa")
        const notes = this.requiredText(dto.notes, "Registre a conclusão da ata da defesa")
        if (detail.evaluationMode === FullProfessorEvaluationMode.THESIS) {
          await this.repository.transition({
            processId,
            actorId: actor.userId,
            eventType: FullProfessorProcedureEventType.ORAL_DEFENSE_RECORDED,
            data: {
              procedureStage: FullProfessorProcedureStage.THESIS_DEFENSE_RECORDED,
              oralDefenseHeldAt: heldAt,
              oralDefenseRecordingUrl: recordingUrl,
              oralDefenseNotes: notes
            },
            details: { heldAt: heldAt.toISOString(), recordingUrl, mode: "THESIS" }
          })
          break
        }
        const outcome = this.requiredOutcome(dto.outcome)
        const rejected = outcome === FullProfessorProcedureOutcome.REJECTED
        await this.repository.transition({
          processId,
          actorId: actor.userId,
          eventType: FullProfessorProcedureEventType.ORAL_DEFENSE_RECORDED,
          data: {
            procedureStage: rejected
              ? FullProfessorProcedureStage.AWAITING_APPEAL
              : FullProfessorProcedureStage.COMPLETED,
            currentOutcome: outcome,
            oralDefenseHeldAt: heldAt,
            oralDefenseRecordingUrl: recordingUrl,
            oralDefenseNotes: notes,
            appealDeadlineAt: rejected ? addBusinessDaysDeadline(heldAt, 2, context.calendarPeriods ?? []) : null
          },
          details: { outcome, heldAt: heldAt.toISOString(), recordingUrl }
        })
        break
      }
      case "SUBMIT_APPEAL": {
        this.assertTeacher(actor)
        this.assertStage(detail.procedureStage, FullProfessorProcedureStage.AWAITING_APPEAL)
        this.assertOpenDeadline(detail.appealDeadlineAt, now, "O prazo para apresentar recurso terminou")
        const reason = this.requiredText(dto.reason, "Informe os fundamentos do recurso")
        await this.repository.transition({
          processId,
          actorId: actor.userId,
          eventType: FullProfessorProcedureEventType.APPEAL_SUBMITTED,
          data: {
            procedureStage: FullProfessorProcedureStage.APPEAL_SUBMITTED,
            appealSubmittedAt: now,
            appealReason: reason
          },
          details: { reason }
        })
        break
      }
      case "DECIDE_APPEAL": {
        this.assertCppd(actor)
        this.assertStage(detail.procedureStage, FullProfessorProcedureStage.APPEAL_SUBMITTED)
        const outcome = this.requiredOutcome(dto.outcome)
        const decisionText = this.requiredText(dto.decisionText, "Informe a decisão fundamentada do recurso")
        await this.repository.transition({
          processId,
          actorId: actor.userId,
          eventType: FullProfessorProcedureEventType.APPEAL_DECIDED,
          data: {
            procedureStage: FullProfessorProcedureStage.COMPLETED,
            currentOutcome: outcome,
            appealDecidedAt: now,
            appealDecisionText: decisionText
          },
          details: { outcome, decisionText }
        })
        break
      }
      case "CLOSE_EXPIRED_PERIOD": {
        this.assertCppd(actor)
        const deadline = detail.procedureStage === FullProfessorProcedureStage.AWAITING_REASSESSMENT
          ? detail.reassessmentDeadlineAt
          : detail.procedureStage === FullProfessorProcedureStage.AWAITING_APPEAL
            ? detail.appealDeadlineAt
            : null
        if (!deadline || !deadlineExpired(deadline, now)) {
          throw new BusinessRuleError("Não há prazo vencido que possa ser encerrado")
        }
        await this.repository.transition({
          processId,
          actorId: actor.userId,
          eventType: FullProfessorProcedureEventType.DEADLINE_EXPIRED,
          data: {
            procedureStage: FullProfessorProcedureStage.COMPLETED,
            currentOutcome: FullProfessorProcedureOutcome.REJECTED
          },
          details: { deadline: deadline.toISOString() }
        })
        break
      }
    }

    return this.get(processId, actor)
  }

  private async getContext(processId: number) {
    const context = await this.repository.findContext(processId)
    if (!context) throw new NotFoundError("Processo não encontrado")
    if (context.processTypeConfig?.category !== ProcessTypeCategory.FULL_PROFESSOR || !context.fullProfessorDetail) {
      throw new BusinessRuleError("Este recurso é exclusivo da Promoção à Classe Titular")
    }
    const detail = context.fullProfessorDetail
    if (detail && detail.procedureStage !== FullProfessorProcedureStage.COMPLETED && detail.initialOpinionAt) {
      const calendar = context.calendarPeriods ?? []
      detail.reassessmentDeadlineAt = addBusinessDaysDeadline(detail.initialOpinionAt, 2, calendar)
      detail.oralDefenseDeadlineAt = addCalendarDaysDeadline(detail.initialOpinionAt, 30, calendar)
      detail.appealDeadlineAt = addBusinessDaysDeadline(detail.oralDefenseHeldAt ?? detail.initialOpinionAt, 2, calendar)
    }
    return context
  }

  private assertActorAccess(context: Awaited<ReturnType<FullProfessorProcedureRepository["findContext"]>>, actor: ProcedureActor) {
    if (!context) throw new NotFoundError("Processo não encontrado")
    if (actor.role === RoleName.DOCENTE && context.userId !== actor.userId) {
      throw new BusinessRuleError("O docente não possui acesso a este processo")
    }
    if (actor.role !== RoleName.DOCENTE && !cppdRoles.has(actor.role)) {
      throw new BusinessRuleError("O perfil selecionado não possui acesso ao rito da Classe Titular")
    }
  }

  private map(context: NonNullable<Awaited<ReturnType<FullProfessorProcedureRepository["findContext"]>>>, actor: ProcedureActor) {
    const detail = context.fullProfessorDetail!
    const now = this.clock()
    const actions: string[] = []
    if (actor.role === RoleName.DOCENTE) {
      if (detail.procedureStage === FullProfessorProcedureStage.AWAITING_REASSESSMENT && !deadlineExpired(detail.reassessmentDeadlineAt, now)) actions.push("REQUEST_REASSESSMENT")
      if (detail.procedureStage === FullProfessorProcedureStage.AWAITING_APPEAL && !deadlineExpired(detail.appealDeadlineAt, now)) actions.push("SUBMIT_APPEAL")
    } else if (cppdRoles.has(actor.role)) {
      if (
        detail.evaluationMode === FullProfessorEvaluationMode.THESIS &&
        detail.procedureStage === FullProfessorProcedureStage.INITIAL_EVALUATION &&
        context.specialCommissions[0]?.status === CommissionStatus.ACTIVE
      ) actions.push("SCHEDULE_ORAL_DEFENSE")
      if (detail.procedureStage === FullProfessorProcedureStage.REASSESSMENT_REQUESTED) actions.push("SCHEDULE_ORAL_DEFENSE")
      if (detail.procedureStage === FullProfessorProcedureStage.ORAL_DEFENSE_SCHEDULED) actions.push("RECORD_ORAL_DEFENSE")
      if (detail.procedureStage === FullProfessorProcedureStage.APPEAL_SUBMITTED) actions.push("DECIDE_APPEAL")
      if (
        (detail.procedureStage === FullProfessorProcedureStage.AWAITING_REASSESSMENT && deadlineExpired(detail.reassessmentDeadlineAt, now)) ||
        (detail.procedureStage === FullProfessorProcedureStage.AWAITING_APPEAL && deadlineExpired(detail.appealDeadlineAt, now))
      ) actions.push("CLOSE_EXPIRED_PERIOD")
    }
    const commission = context.specialCommissions[0] ?? null
    return {
      processId: context.idProcess,
      evaluationMode: detail.evaluationMode,
      stage: detail.procedureStage,
      currentOutcome: detail.currentOutcome,
      evaluationDeadlineAt: detail.evaluationDeadlineAt ?? commission?.evaluationDeadlineAt ?? null,
      evaluationOverdue: deadlineExpired(detail.evaluationDeadlineAt ?? commission?.evaluationDeadlineAt, now),
      initialOpinionAt: detail.initialOpinionAt,
      reassessmentDeadlineAt: detail.reassessmentDeadlineAt,
      reassessmentRequestedAt: detail.reassessmentRequestedAt,
      reassessmentReason: detail.reassessmentReason,
      oralDefenseDeadlineAt: detail.oralDefenseDeadlineAt,
      oralDefenseScheduledAt: detail.oralDefenseScheduledAt,
      oralDefenseAccessUrl: detail.oralDefenseAccessUrl,
      oralDefenseHeldAt: detail.oralDefenseHeldAt,
      oralDefenseRecordingUrl: detail.oralDefenseRecordingUrl,
      oralDefenseNotes: detail.oralDefenseNotes,
      appealDeadlineAt: detail.appealDeadlineAt,
      appealSubmittedAt: detail.appealSubmittedAt,
      appealReason: detail.appealReason,
      appealDecidedAt: detail.appealDecidedAt,
      appealDecisionText: detail.appealDecisionText,
      availableActions: actions,
      events: detail.procedureEvents.map(event => ({
        id: event.idFullProfessorProcedureEvent,
        type: event.type,
        occurredAt: event.occurredAt,
        actor: event.actor,
        details: event.details
      }))
    }
  }

  private assertTeacher(actor: ProcedureActor) {
    if (actor.role !== RoleName.DOCENTE) throw new BusinessRuleError("Esta ação deve ser realizada pelo docente")
  }

  private assertCppd(actor: ProcedureActor) {
    if (!cppdRoles.has(actor.role)) throw new BusinessRuleError("Esta ação deve ser realizada pela CPPD")
  }

  private assertStage(current: FullProfessorProcedureStage, expected: FullProfessorProcedureStage) {
    if (current !== expected) throw new BusinessRuleError("A ação não é permitida na etapa atual do processo")
  }

  private assertOpenDeadline(deadline: Date | null, now: Date, message: string) {
    if (!deadline || deadlineExpired(deadline, now)) throw new BusinessRuleError(message)
  }

  private requiredText(value: string | undefined, message: string) {
    const text = value?.trim()
    if (!text) throw new BusinessRuleError(message)
    return text
  }

  private requiredDate(value: string | undefined, message: string) {
    const date = value ? new Date(value) : new Date(Number.NaN)
    if (Number.isNaN(date.getTime())) throw new BusinessRuleError(message)
    return date
  }

  private requiredOutcome(value: FullProfessorProcedureOutcome | undefined) {
    if (!value || !Object.values(FullProfessorProcedureOutcome).includes(value)) {
      throw new BusinessRuleError("Informe o resultado da análise")
    }
    return value
  }
}
