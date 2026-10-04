import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import {
  CommissionStatus,
  FullProfessorEvaluationMode,
  FullProfessorProcedureEventType,
  FullProfessorProcedureOutcome,
  FullProfessorProcedureStage,
  ProcessTypeCategory,
  RoleName
} from "@prisma/client"
import { FullProfessorProcedureRepository } from "../../../src/repository/fullProfessorProcedureRepository"
import { FullProfessorProcedureService } from "../../../src/service/fullProfessorProcedureService"

describe("FullProfessorProcedureService", () => {
  let repository: jest.Mocked<FullProfessorProcedureRepository>
  let service: FullProfessorProcedureService
  const now = new Date("2026-09-29T12:00:00.000Z")

  const evaluations = ["APPROVED", "APPROVED", "REJECTED", "REJECTED"].map(result => ({
    status: "SUBMITTED",
    result
  }))

  const context = {
    idProcess: 20,
    userId: 7,
    processTypeConfig: { category: ProcessTypeCategory.FULL_PROFESSOR },
    user: { idUser: 7, name: "Docente" },
    fullProfessorDetail: {
      processId: 20,
      evaluationMode: FullProfessorEvaluationMode.MEMORIAL,
      procedureStage: FullProfessorProcedureStage.INITIAL_EVALUATION,
      currentOutcome: null,
      evaluationDeadlineAt: null,
      initialOpinionAt: null,
      reassessmentDeadlineAt: null,
      reassessmentRequestedAt: null,
      reassessmentReason: null,
      oralDefenseDeadlineAt: null,
      oralDefenseScheduledAt: null,
      oralDefenseAccessUrl: null,
      oralDefenseHeldAt: null,
      oralDefenseRecordingUrl: null,
      oralDefenseNotes: null,
      appealDeadlineAt: null,
      appealSubmittedAt: null,
      appealReason: null,
      appealDecidedAt: null,
      appealDecisionText: null,
      procedureEvents: []
    },
    specialCommissions: [{
      status: CommissionStatus.COMPLETED,
      evaluationDeadlineAt: new Date("2026-11-13T23:59:59.999Z"),
      members: evaluations.map(evaluation => ({ individualEvaluations: [evaluation] }))
    }]
  }

  beforeEach(() => {
    repository = {
      findContext: jest.fn(),
      initialize: jest.fn(),
      transition: jest.fn()
    } as any
    repository.findContext.mockResolvedValue(context as any)
    service = new FullProfessorProcedureService(repository, () => now)
  })

  test("abre prazo de dois dias úteis para reavaliação de memorial reprovado", async () => {
    await service.initializeAfterCommission(20, 2)

    expect(repository.initialize).toHaveBeenCalledWith(expect.objectContaining({
      processId: 20,
      stage: FullProfessorProcedureStage.AWAITING_REASSESSMENT,
      outcome: FullProfessorProcedureOutcome.REJECTED,
      reassessmentDeadlineAt: new Date("2026-10-01T23:59:59.999Z"),
      oralDefenseDeadlineAt: new Date("2026-10-29T23:59:59.999Z")
    }))
  })

  test("aprova o resultado inicial somente com três votos favoráveis entre quatro", async () => {
    repository.findContext.mockResolvedValue({
      ...context,
      specialCommissions: [{
        ...context.specialCommissions[0],
        members: ["APPROVED", "APPROVED", "APPROVED", "REJECTED"].map(result => ({
          individualEvaluations: [{ status: "SUBMITTED", result }]
        }))
      }]
    } as any)

    await service.initializeAfterCommission(20, 2)
    expect(repository.initialize).toHaveBeenCalledWith(expect.objectContaining({
      stage: FullProfessorProcedureStage.COMPLETED,
      outcome: FullProfessorProcedureOutcome.APPROVED
    }))
  })

  test("permite ao docente pedir reavaliação dentro do prazo", async () => {
    repository.findContext.mockResolvedValue({
      ...context,
      fullProfessorDetail: {
        ...context.fullProfessorDetail,
        procedureStage: FullProfessorProcedureStage.AWAITING_REASSESSMENT,
        reassessmentDeadlineAt: new Date("2026-10-01T23:59:59.999Z")
      }
    } as any)

    await service.execute(20, { userId: 7, role: RoleName.DOCENTE }, {
      action: "REQUEST_REASSESSMENT",
      reason: " Solicito nova avaliação. "
    })

    expect(repository.transition).toHaveBeenCalledWith(expect.objectContaining({
      eventType: FullProfessorProcedureEventType.REASSESSMENT_REQUESTED,
      data: expect.objectContaining({
        procedureStage: FullProfessorProcedureStage.REASSESSMENT_REQUESTED,
        reassessmentReason: "Solicito nova avaliação."
      })
    }))
  })

  test("bloqueia pedido de reavaliação fora do prazo", async () => {
    repository.findContext.mockResolvedValue({
      ...context,
      fullProfessorDetail: {
        ...context.fullProfessorDetail,
        procedureStage: FullProfessorProcedureStage.AWAITING_REASSESSMENT,
        reassessmentDeadlineAt: new Date("2026-09-28T23:59:59.999Z")
      }
    } as any)

    await expect(service.execute(20, { userId: 7, role: RoleName.DOCENTE }, {
      action: "REQUEST_REASSESSMENT",
      reason: "Fora do prazo"
    })).rejects.toThrow("prazo para pedir reavaliação terminou")
  })

  test("impede agendamento da defesa após o limite de 30 dias", async () => {
    repository.findContext.mockResolvedValue({
      ...context,
      fullProfessorDetail: {
        ...context.fullProfessorDetail,
        procedureStage: FullProfessorProcedureStage.REASSESSMENT_REQUESTED,
        oralDefenseDeadlineAt: new Date("2026-10-29T23:59:59.999Z")
      }
    } as any)

    await expect(service.execute(20, { userId: 2, role: RoleName.CPPD_MEMBER }, {
      action: "SCHEDULE_ORAL_DEFENSE",
      scheduledAt: "2026-10-30T14:00:00.000Z",
      accessUrl: "https://conferenciaweb.rnp.br/sala"
    })).rejects.toThrow("até 30 dias")
  })

  test("abre recurso por dois dias úteis após defesa reprovada", async () => {
    repository.findContext.mockResolvedValue({
      ...context,
      fullProfessorDetail: {
        ...context.fullProfessorDetail,
        procedureStage: FullProfessorProcedureStage.ORAL_DEFENSE_SCHEDULED,
        oralDefenseScheduledAt: new Date("2026-09-29T10:00:00.000Z")
      }
    } as any)

    await service.execute(20, { userId: 2, role: RoleName.CPPD_CENTRAL }, {
      action: "RECORD_ORAL_DEFENSE",
      heldAt: "2026-09-29T10:00:00.000Z",
      recordingUrl: "https://drive.google.com/gravação",
      notes: "Ata registrada.",
      outcome: FullProfessorProcedureOutcome.REJECTED
    })

    expect(repository.transition).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        procedureStage: FullProfessorProcedureStage.AWAITING_APPEAL,
        appealDeadlineAt: new Date("2026-10-01T23:59:59.999Z")
      })
    }))
  })
})
