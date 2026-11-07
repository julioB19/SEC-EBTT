import { describe, expect, jest, test } from "@jest/globals"
import { ProcessEvaluationService } from "../../../src/service/processEvaluationService"
import { SpecialCommissionService } from "../../../src/service/specialCommissionService"
import { ProcessoService } from "../../../src/service/processoService"
import { ScoringTableService } from "../../../src/service/scoringTableService"

jest.mock("../../../src/infra/prismaClient", () => ({ prisma: {
  rscAppeal: { findFirst: async () => null },
  academicCalendarPeriod: { findMany: async () => [] },
  signedProcessArtifact: { findMany: async () => [
    ...[1, 2, 3, 4].map(memberId => ({ documentKind: "INDIVIDUAL_OPINION", memberId, version: 1, validatedAt: new Date(), rejectedAt: null, uploadedAt: new Date() })),
    { documentKind: "CONSOLIDATED_OPINION", memberId: null, version: 1, validatedAt: new Date(), rejectedAt: null, uploadedAt: new Date() }
  ] }
} }))

describe("Bloqueios regulatórios de decisão", () => {
  test.each([0, 1, 2, 3, 4])("RSC: %i pareceres favoráveis determinam a decisão", async favorable => {
    const repository: any = {
      findProcess: jest.fn<() => Promise<any>>().mockResolvedValue({ idProcess: 1, status: "UNDER_REVIEW", processTypeConfig: { category: "RSC", requiresCommittee: true } }),
      findCurrentByProcess: jest.fn<() => Promise<any>>().mockResolvedValue({ status: "COMPLETED", members: Array.from({ length: 4 }, (_, i) => ({ idSpecialCommissionMember: i + 1, origin: i === 0 ? "INTERNAL" : "EXTERNAL", role: "MEMBER", individualEvaluations: [{ status: "SUBMITTED", result: i < favorable ? "DEFERRED" : "DENIED", recognizedPoints: 0 }] })) }),
      finalizeDecision: jest.fn<() => Promise<any>>().mockResolvedValue({})
    }
    const service = new SpecialCommissionService(repository)
    jest.spyOn(service, "getForProcess").mockResolvedValue({} as any)
    const expected = favorable >= 3 ? "APPROVED" : "REJECTED"
    const wrong = expected === "APPROVED" ? "REJECTED" : "APPROVED"
    await expect(service.finalizeDecision(1, 2, { decision: wrong, opinionText: "Parecer" })).rejects.toThrow("pareceres")
    expect(repository.finalizeDecision).not.toHaveBeenCalled()
    await service.finalizeDecision(1, 2, { decision: expected, opinionText: "Parecer" })
    expect(repository.finalizeDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: expected }))
  })

  test.each([0, 119, 120, 121])("carreira: reconhece %i pontos com mínimo de 120", async points => {
    const process = { idProcess: 1, userId: 1, status: "SUBMITTED", type: "PROGRESSAO", scoringTableId: 1, table: { minRequiredPoints: 120 }, intersticeStart: new Date("2020-01-01"), intersticeEnd: new Date("2022-01-01"), classeOrigem: "B", nivelOrigem: "1", classeDestino: "B", nivelDestino: "2", user: { name: "Docente", docente: { siape: "1" } }, campus: "Teste", cidadeUF: "Teste/RS" }
    const repository: any = { findProcessWithUserAndTable: jest.fn<() => Promise<any>>().mockResolvedValue(process), finalizeEvaluation: jest.fn<() => Promise<any>>().mockResolvedValue({ idProcess: 1, status: "APPROVED" }) }
    const service = new ProcessEvaluationService(repository)
    jest.spyOn(service, "getProcessForEvaluation").mockResolvedValue({ items: [{ idScoringItem: 1 }], scores: [{ itemId: 1, quantity: 1, awardedPoints: 150, evaluatorAwardedPoints: points, evaluatorComment: "Pontuação conferida" }] } as any)
    jest.spyOn(service as any, "recalculateEvaluationTotals").mockResolvedValue({})
    jest.spyOn(service as any, "computeOverallTotals").mockResolvedValue({ totalsCppd: points })
    if (points < 120) {
      await expect(service.finalizeEvaluation(1, 2, { decision: "APPROVED" })).rejects.toThrow("pontuação mínima")
      expect(repository.finalizeEvaluation).not.toHaveBeenCalled()
    } else {
      await service.finalizeEvaluation(1, 2, { decision: "APPROVED" })
      expect(repository.finalizeEvaluation).toHaveBeenCalledWith(expect.objectContaining({ finalPoints: points.toFixed(2) }))
    }
  })

  test.each([false, true])("a data financeira respeita o período completo e bloqueia concessão futura: %s", async future => {
    const process: any = { idProcess: 1, userId: 1, status: "SUBMITTED", type: "PROGRESSAO", scoringTableId: 1, table: { minRequiredPoints: 120 }, intersticeStart: new Date(future ? "2090-01-01" : "2020-01-01"), intersticeEnd: new Date(future ? "2091-12-31" : "2021-12-31"), classeOrigem: "B", nivelOrigem: "1", classeDestino: "B", nivelDestino: "2", user: { name: "Docente", docente: { siape: "1" } }, campus: "Teste", cidadeUF: "Teste/RS" }
    const repository: any = { findProcessWithUserAndTable: jest.fn<() => Promise<any>>().mockResolvedValue(process), finalizeEvaluation: jest.fn<() => Promise<any>>().mockResolvedValue({ idProcess: 1, status: "APPROVED" }) }
    const service = new ProcessEvaluationService(repository)
    jest.spyOn(service, "getProcessForEvaluation").mockResolvedValue({scores: []} as any)
    jest.spyOn(service as any, "checkAllFilledItemsEvaluated").mockReturnValue(true)
    jest.spyOn(service as any, "recalculateEvaluationTotals").mockResolvedValue({})
    jest.spyOn(service as any, "computeOverallTotals").mockResolvedValue({ totalsCppd: 120 })
    const action = service.finalizeEvaluation(1, 2, { decision: "APPROVED", requirementsMetAtISO: "2021-12-01" })
    if (future) {
      await expect(action).rejects.toThrow("interstício mínimo completo")
      expect(repository.finalizeEvaluation).not.toHaveBeenCalled()
    } else {
      await action
      expect(repository.finalizeEvaluation).toHaveBeenCalledWith(expect.objectContaining({ financialEffectsAt: new Date("2022-01-01"), evaluationOpinion: expect.stringContaining("01/01/2020 a 31/12/2021") }))
      expect(repository.finalizeEvaluation).toHaveBeenCalledWith(expect.objectContaining({ evaluationOpinion: expect.stringContaining("efeitos financeiros a contar de **01/01/2022**") }))
      await service.finalizeEvaluation(1, 2, { decision: "APPROVED", requirementsMetAtISO: "2021-12-01", overrideOpinion: "Texto conferido, com efeitos financeiros a contar de **30/12/2021**. É o parecer." })
      expect(repository.finalizeEvaluation).toHaveBeenLastCalledWith(expect.objectContaining({ evaluationOpinion: "Texto conferido. É o parecer.\n\nData oficial de efeitos financeiros: 01/01/2022." }))
    }
  })

  test("C4 para D1 exige o processo próprio de Classe Titular", () => {
    const service = new ProcessoService({} as any, {} as any, {} as any)
    expect(() => (service as any).validarCombinacaoProgressaoOuPromocao("PROMOCAO", "C4", "D1")).toThrow("Classe Titular")
  })

  test("tabela ativa não retorna a rascunho", async () => {
    const repository: any = { findById: jest.fn<() => Promise<any>>().mockResolvedValue({ status: "ACTIVE" }), updateTable: jest.fn<() => Promise<any>>().mockResolvedValue({}) }
    await expect(new ScoringTableService(repository).atualizarTabelaAdmin(1, { status: "DRAFT" } as any)).rejects.toThrow("rascunho")
    expect(repository.updateTable).not.toHaveBeenCalled()
  })
})

