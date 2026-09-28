import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import {
  AcceptanceStatus,
  CommissionStatus,
  IndividualEvaluationResult,
  IndividualEvaluationStatus,
  ProcessStatus,
  SpecialCommissionType
} from "@prisma/client"
import { IndividualEvaluationRepository } from "../../../src/repository/individualEvaluationRepository"
import { IndividualEvaluationService } from "../../../src/service/individualEvaluationService"

describe("IndividualEvaluationService", () => {
  let repository: jest.Mocked<IndividualEvaluationRepository>
  let service: IndividualEvaluationService

  const assignment = {
    idSpecialCommissionMember: 5,
    role: "MEMBER",
    acceptanceStatus: AcceptanceStatus.ACCEPTED,
    person: { name: "Avaliador" },
    individualEvaluations: [
      {
        idIndividualEvaluation: 8,
        status: IndividualEvaluationStatus.DRAFT,
        result: null,
        recognizedPoints: null,
        opinionText: null,
        submittedAt: null,
        scores: []
      }
    ],
    specialCommission: {
      type: SpecialCommissionType.RSC,
      status: CommissionStatus.ACTIVE,
      ordinance: "Portaria 10/2026",
      ordinanceDate: new Date("2026-09-01"),
      process: {
        idProcess: 12,
        status: ProcessStatus.IN_EVALUATION,
        scoringTableId: 3,
        externalNumber: null,
        campus: "Campus Alegrete",
        cidadeUF: "Alegrete/RS",
        type: null,
        user: { name: "Docente", docente: { siape: "123" } },
        processTypeConfig: { code: "RSC", name: "RSC", category: "RSC" },
        table: {
          idScoringTable: 3,
          name: "Tabela RSC",
          minRequiredPoints: 60,
          nodes: []
        },
        scores: [
          {
            itemId: 20,
            quantity: 2,
            awardedPoints: 20,
            item: { nodeId: 2, description: "Atividade de ensino", unit: "item" },
            evidenceFile: null
          },
          {
            itemId: 21,
            quantity: 1,
            awardedPoints: 5,
            item: { nodeId: 2, description: "Orientação", unit: "item" },
            evidenceFile: null
          }
        ],
        rscDetail: null,
        fullProfessorDetail: null
      }
    }
  }

  beforeEach(() => {
    repository = {
      findAssignmentForUser: jest.fn(),
      saveEvaluation: jest.fn()
    } as any
    repository.findAssignmentForUser.mockResolvedValue(assignment as any)
    service = new IndividualEvaluationService(repository)
  })

  test("exige que o convite tenha sido aceito", async () => {
    repository.findAssignmentForUser.mockResolvedValue({
      ...assignment,
      acceptanceStatus: AcceptanceStatus.PENDING
    } as any)

    await expect(service.getEvaluation(7, 5)).rejects.toThrow("Aceite o convite")
  })

  test("calcula o total RSC a partir dos itens reconhecidos", async () => {
    await service.submit(7, 5, {
      result: IndividualEvaluationResult.DENIED,
      opinionText: "A documentação apresentada comprova as atividades informadas.",
      scores: [
        { itemId: 20, awardedPoints: 15, evaluatorComment: "Parcialmente comprovado" },
        { itemId: 21, awardedPoints: 5 }
      ]
    })

    expect(repository.saveEvaluation).toHaveBeenCalledWith({
      evaluationId: 8,
      status: IndividualEvaluationStatus.SUBMITTED,
      result: IndividualEvaluationResult.DENIED,
      opinionText: "A documentação apresentada comprova as atividades informadas.",
      recognizedPoints: "20.00",
      scores: [
        { itemId: 20, quantity: 2, awardedPoints: 15, evaluatorComment: "Parcialmente comprovado" },
        { itemId: 21, quantity: 1, awardedPoints: 5, evaluatorComment: null }
      ]
    })
  })

  test("exige avaliação de todos os itens declarados ao enviar RSC", async () => {
    await expect(
      service.submit(7, 5, {
        result: IndividualEvaluationResult.DENIED,
        opinionText: "Os documentos não comprovam integralmente as atividades.",
        scores: [{ itemId: 20, awardedPoints: 0 }]
      })
    ).rejects.toThrow("Avalie todos os itens")
    expect(repository.saveEvaluation).not.toHaveBeenCalled()
  })

  test("não permite resultado favorável abaixo do mínimo RSC", async () => {
    await expect(
      service.submit(7, 5, {
        result: IndividualEvaluationResult.DEFERRED,
        opinionText: "A documentação foi analisada, mas a pontuação ficou abaixo do mínimo.",
        scores: [
          { itemId: 20, awardedPoints: 20 },
          { itemId: 21, awardedPoints: 5 }
        ]
      })
    ).rejects.toThrow("exige ao menos 60.00 pontos")
  })

  test("não permite reconhecer mais pontos do que o docente declarou", async () => {
    await expect(
      service.saveDraft(7, 5, {
        scores: [{ itemId: 20, awardedPoints: 20.01 }]
      })
    ).rejects.toThrow("deve ficar entre 0 e 20.00")
  })

  test("Professor Titular exige parecer e não utiliza itens de pontuação", async () => {
    repository.findAssignmentForUser.mockResolvedValue({
      ...assignment,
      specialCommission: {
        ...assignment.specialCommission,
        type: SpecialCommissionType.FULL_PROFESSOR,
        process: {
          ...assignment.specialCommission.process,
          scoringTableId: null,
          table: null,
          scores: []
        }
      }
    } as any)

    await expect(
      service.submit(7, 5, { result: IndividualEvaluationResult.APPROVED, opinionText: "" })
    ).rejects.toThrow("Informe o parecer individual")

    await expect(
      service.saveDraft(7, 5, { scores: [{ itemId: 20, awardedPoints: 1 }] })
    ).rejects.toThrow("não utiliza pontuação por item")
  })

  test("avaliação enviada fica bloqueada para edição", async () => {
    repository.findAssignmentForUser.mockResolvedValue({
      ...assignment,
      individualEvaluations: [
        { ...assignment.individualEvaluations[0], status: IndividualEvaluationStatus.SUBMITTED }
      ]
    } as any)

    await expect(service.saveDraft(7, 5, {})).rejects.toThrow("não pode mais ser alterada")
  })
})
