import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import fs from "fs"
import { ProcessStatus, ProcessType } from "@prisma/client"
import { ProcessEvaluationService } from "../../../src/service/processEvaluationService"
import {
  MissingDocenteProfileError,
  MissingProcessScoreError,
  ProcessEvaluationRepository
} from "../../../src/repository/processEvaluationRepository"
import { BusinessRuleError, NotFoundError } from "../../../src/service/processoService"

describe("ProcessEvaluationService", () => {
  let repository: jest.Mocked<ProcessEvaluationRepository>
  let service: ProcessEvaluationService

  const process = {
    idProcess: 1, userId: 7, scoringTableId: 2, status: ProcessStatus.SUBMITTED,
    deletedDate: null, type: ProcessType.PROGRESSAO, campus: "Campus Teste", cidadeUF: "Cidade/RS",
    intersticeStart: new Date("2020-01-01"), intersticeEnd: new Date("2023-01-01"),
    classeOrigem: "A", nivelOrigem: "1", classeDestino: "B", nivelDestino: "1",
    finalPoints: null, evaluationOpinion: null, evaluatorUserIds: [],
    user: { name: "Docente", docente: { siape: "123" } },
    table: { minRequiredPoints: 10 }
  }

  beforeEach(() => {
    repository = {
      findEvidenceLinkedToProcess: jest.fn(), findProcess: jest.fn(),
      findProcessWithUserAndTable: jest.fn(), findEvaluationData: jest.fn(),
      updateItemScores: jest.fn(), setEvaluators: jest.fn(), upsertNodeTotals: jest.fn(),
      updateFinalPoints: jest.fn(), findScoresWithItems: jest.fn(), finalizeEvaluation: jest.fn()
    } as any
    service = new ProcessEvaluationService(repository)
  })

  test("resolve conteúdo de evidência vinculada", async () => {
    repository.findEvidenceLinkedToProcess.mockResolvedValue({
      process: { idProcess: 1 }, linked: true,
      file: { url: "/uploads/7/1/a.pdf", originalName: "a.pdf", mimeType: null }
    } as any)
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    await expect(service.getEvidenceContentForCppd(1, 3)).resolves.toEqual(expect.objectContaining({
      originalName: "a.pdf", mimeType: "application/pdf"
    }))
  })

  test.each([
    ["processo ausente", { process: null, file: null, linked: false }, NotFoundError],
    ["arquivo ausente", { process: {}, file: null, linked: false }, NotFoundError],
    ["não vinculado", { process: {}, file: {}, linked: false }, BusinessRuleError],
    ["URL inválida", { process: {}, file: { url: "http://x" }, linked: true }, BusinessRuleError]
  ])("rejeita evidência: %s", async (_label, result, errorType) => {
    repository.findEvidenceLinkedToProcess.mockResolvedValue(result as any)
    await expect(service.getEvidenceContentForCppd(1, 2)).rejects.toBeInstanceOf(errorType)
  })

  test("rejeita processo fora de avaliação", async () => {
    repository.findProcessWithUserAndTable.mockResolvedValue({
      ...process, status: ProcessStatus.DRAFT
    } as any)
    await expect(service.getProcessForEvaluation(1)).rejects.toThrow("not available")
  })

  test("mapeia estrutura de avaliação", async () => {
    repository.findProcessWithUserAndTable.mockResolvedValue(process as any)
    repository.findEvaluationData.mockResolvedValue({
      nodes: [{ idScoringNode: 4, parentId: null, name: "Bloco", code: "B", sortOrder: 1,
        hasFormula: false, formulaExpression: null }],
      items: [{ idScoringItem: 5, nodeId: 4, description: "Item", unit: "un", points: 2,
        hasMaxPoints: false, maxPoints: null, formulaKey: null }],
      scores: [{ idProcessScore: 6, itemId: 5, quantity: 2, awardedPoints: 4,
        evaluatorAwardedPoints: null, evaluatorComment: null, evidenceFile: null }],
      nodeScores: [{ nodeId: 4, totalPoints: 4, evaluatorTotalPoints: null }]
    })
    const result = await service.getProcessForEvaluation(1)
    expect(result.process.idProcess).toBe(1)
    expect(result.items[0].idScoringItem).toBe(5)
    expect(result.scores[0].awardedPoints).toBe(4)
  })

  test("normaliza notas antes de persistir", async () => {
    repository.findProcess.mockResolvedValue(process as any)
    jest.spyOn(service as any, "recalculateEvaluationTotals").mockResolvedValue({ ok: true })
    await service.updateItemScores(1, [{
      itemId: 5, evaluatorAwardedPoints: "10,5", evaluatorComment: undefined
    }])
    expect(repository.updateItemScores).toHaveBeenCalledWith(1, [{
      itemId: 5, evaluatorAwardedPoints: "10.50", evaluatorComment: null
    }])
  })

  test("converte ausência de score em regra de negócio", async () => {
    repository.findProcess.mockResolvedValue(process as any)
    repository.updateItemScores.mockRejectedValue(new MissingProcessScoreError())
    await expect(service.updateItemScores(1, [{
      itemId: 5, evaluatorAwardedPoints: "1", evaluatorComment: null
    }])).rejects.toThrow("não existe pontuação registrada")
  })

  test("sanitiza e inclui avaliador atual", async () => {
    repository.findProcess.mockResolvedValue(process as any)
    jest.spyOn(service, "getProcessForEvaluation").mockResolvedValue({} as any)
    await service.setEvaluationEvaluators(1, 7, [8, 8, -1, Number.NaN])
    expect(repository.setEvaluators).toHaveBeenCalledWith(1, [7, 8])
  })

  test("finalização traduz ausência de perfil docente", async () => {
    repository.findProcessWithUserAndTable.mockResolvedValue(process as any)
    jest.spyOn(service, "getProcessForEvaluation").mockResolvedValue({ scores: [] } as any)
    jest.spyOn(service as any, "checkAllFilledItemsEvaluated").mockReturnValue(true)
    jest.spyOn(service as any, "recalculateEvaluationTotals").mockResolvedValue({})
    jest.spyOn(service as any, "computeOverallTotals").mockResolvedValue({ totalsCppd: 120 })
    repository.finalizeEvaluation.mockRejectedValue(new MissingDocenteProfileError())
    await expect(service.finalizeEvaluation(1, 9, { decision: "APPROVED" }))
      .rejects.toThrow("DocenteProfile não encontrado")
  })
})
