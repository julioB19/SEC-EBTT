import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import {
  MissingDocenteProfileError,
  MissingProcessScoreError,
  ProcessEvaluationRepository
} from "../../../src/repository/processEvaluationRepository"
import { prisma } from "../../../src/infra/prismaClient"
import { ProcessStatus } from "@prisma/client"

jest.mock("../../../src/infra/prismaClient", () => ({
  prisma: {
    careerProcess: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    evidenceFile: { findFirst: jest.fn() }, processScore: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    scoringNode: { findMany: jest.fn() }, scoringItem: { findMany: jest.fn() },
    processNodeScore: { findMany: jest.fn(), upsert: jest.fn() },
    processStatusHistory: { create: jest.fn() }, docenteProfile: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn()
  }
}))

describe("ProcessEvaluationRepository", () => {
  const repository = new ProcessEvaluationRepository()

  beforeEach(() => { jest.clearAllMocks() })

  test("não consulta arquivo quando processo não existe", async () => {
    ;(prisma.careerProcess.findFirst as jest.Mock).mockResolvedValue(null as never)
    await expect(repository.findEvidenceLinkedToProcess(1, 2)).resolves.toEqual({
      process: null, file: null, linked: false
    })
    expect(prisma.evidenceFile.findFirst).not.toHaveBeenCalled()
  })

  test("confirma vínculo entre processo e evidência", async () => {
    ;(prisma.careerProcess.findFirst as jest.Mock).mockResolvedValue({ idProcess: 1 } as never)
    ;(prisma.evidenceFile.findFirst as jest.Mock).mockResolvedValue({ idEvidenceFile: 2 } as never)
    ;(prisma.processScore.findFirst as jest.Mock).mockResolvedValue({ idProcessScore: 3 } as never)
    await expect(repository.findEvidenceLinkedToProcess(1, 2)).resolves.toEqual({
      process: { idProcess: 1 }, file: { idEvidenceFile: 2 }, linked: true
    })
  })

  test("atualização de notas falha e reverte quando score não existe", async () => {
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma))
    ;(prisma.processScore.findUnique as jest.Mock).mockResolvedValue(null as never)
    await expect(repository.updateItemScores(1, [{
      itemId: 2, evaluatorAwardedPoints: "1.00", evaluatorComment: null
    }])).rejects.toBeInstanceOf(MissingProcessScoreError)
    expect(prisma.processScore.update).not.toHaveBeenCalled()
  })

  test("finalização registra status e exige perfil para deferimento", async () => {
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma))
    ;(prisma.careerProcess.update as jest.Mock).mockResolvedValue({ idProcess: 1 } as never)
    ;(prisma.docenteProfile.findUnique as jest.Mock).mockResolvedValue(null as never)
    await expect(repository.finalizeEvaluation({
      processId: 1, userId: 2, fromStatus: ProcessStatus.SUBMITTED,
      toStatus: ProcessStatus.APPROVED, finalPoints: "10.00", evaluationOpinion: "ok",
      evaluatorUserIds: [3], changedById: 3, targetLevel: "B1" as any,
      intersticeEnd: new Date()
    })).rejects.toBeInstanceOf(MissingDocenteProfileError)
    expect(prisma.processStatusHistory.create).toHaveBeenCalled()
  })

  test("indeferimento não altera perfil docente", async () => {
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma))
    ;(prisma.careerProcess.update as jest.Mock).mockResolvedValue({ idProcess: 1 } as never)
    await repository.finalizeEvaluation({
      processId: 1, userId: 2, fromStatus: ProcessStatus.SUBMITTED,
      toStatus: ProcessStatus.REJECTED, finalPoints: "1.00", evaluationOpinion: "não",
      evaluatorUserIds: [3], changedById: 3, targetLevel: null, intersticeEnd: new Date()
    })
    expect(prisma.docenteProfile.findUnique).not.toHaveBeenCalled()
  })
})
