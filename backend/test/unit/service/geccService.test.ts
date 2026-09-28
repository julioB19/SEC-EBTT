import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { GeccInterestedType, GeccStatus, ProcessStatus } from "@prisma/client"
import { GeccRepository } from "../../../src/repository/geccRepository"
import { GeccService } from "../../../src/service/geccService"

describe("GeccService", () => {
  let repository: jest.Mocked<GeccRepository>
  let service: GeccService

  const process = {
    idProcess: 15,
    status: ProcessStatus.AWAITING_GECC,
    type: null,
    campus: "Campus Alegrete",
    cidadeUF: "Alegrete/RS",
    user: { name: "Docente", docente: { siape: "123" } },
    processTypeConfig: { name: "RSC", requiresGecc: true },
    geccProcesses: [
      {
        idProcessGecc: 4,
        externalNumber: null,
        status: GeccStatus.PENDING_DOCUMENTS,
        sentToCgpAt: null,
        checklistDocument: null,
        interestedPeople: [],
        documents: []
      }
    ]
  }

  beforeEach(() => {
    repository = {
      findProcess: jest.fn(),
      updateDetails: jest.fn(),
      addInterested: jest.fn(),
      removeInterested: jest.fn(),
      findInterested: jest.fn(),
      addDocument: jest.fn(),
      findDocument: jest.fn(),
      removeDocument: jest.fn(),
      saveChecklist: jest.fn(),
      updateStatus: jest.fn()
    } as any
    repository.findProcess.mockResolvedValue(process as any)
    service = new GeccService(repository)
  })

  test("aceita somente processos configurados para GECC", async () => {
    repository.findProcess.mockResolvedValue({
      ...process,
      processTypeConfig: { name: "Progressão", requiresGecc: false }
    } as any)
    await expect(service.getForProcess(15)).rejects.toThrow("não utiliza GECC")
  })

  test("normaliza interessado antes de salvar", async () => {
    await service.addInterested(15, {
      name: " Avaliador Externo ",
      email: " AVALIADOR@EXEMPLO.COM ",
      type: GeccInterestedType.EXTERNAL_EVALUATOR
    })
    expect(repository.addInterested).toHaveBeenCalledWith({
      processGeccId: 4,
      name: "Avaliador Externo",
      email: "avaliador@exemplo.com",
      type: GeccInterestedType.EXTERNAL_EVALUATOR
    })
  })

  test("impede vincular documento a pessoa que não integra o GECC", async () => {
    repository.findInterested.mockResolvedValue(null)
    await expect(
      service.addDocument({
        processId: 15,
        userId: 2,
        documentType: "Declaração",
        personId: 99,
        originalName: "declaracao.pdf",
        storedName: "arquivo.pdf",
        url: "/uploads/2/15/arquivo.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100
      })
    ).rejects.toThrow("não pertence a este GECC")
    expect(repository.addDocument).not.toHaveBeenCalled()
  })

  test("exige interessado, documento e checklist para marcar como pronto", async () => {
    await expect(
      service.updateStatus(15, 2, { status: GeccStatus.READY_TO_SEND })
    ).rejects.toThrow("Adicione ao menos um interessado")

    repository.findProcess.mockResolvedValue({
      ...process,
      geccProcesses: [{
        ...process.geccProcesses[0],
        interestedPeople: [{ personId: 1 }]
      }]
    } as any)
    await expect(
      service.updateStatus(15, 2, { status: GeccStatus.READY_TO_SEND })
    ).rejects.toThrow("Anexe ao menos um documento")

    repository.findProcess.mockResolvedValue({
      ...process,
      geccProcesses: [{
        ...process.geccProcesses[0],
        interestedPeople: [{ personId: 1 }],
        documents: [{ idGeccDocument: 2 }]
      }]
    } as any)
    await expect(
      service.updateStatus(15, 2, { status: GeccStatus.READY_TO_SEND })
    ).rejects.toThrow("Gere o checklist")
  })

  test("avança um GECC completo para pronto", async () => {
    repository.findProcess.mockResolvedValue({
      ...process,
      geccProcesses: [{
        ...process.geccProcesses[0],
        interestedPeople: [{
          personId: 1,
          type: GeccInterestedType.EXTERNAL_EVALUATOR,
          informedEmail: "avaliador@exemplo.com",
          person: { name: "Avaliador", email: "avaliador@exemplo.com" }
        }],
        documents: [{
          idGeccDocument: 2,
          personId: 1,
          documentType: "Declaração",
          receivedAt: new Date(),
          person: { name: "Avaliador" },
          evidenceFile: null
        }],
        checklistDocument: {
          evidenceFile: {
            idEvidenceFile: 3,
            originalName: "checklist.pdf",
            mimeType: "application/pdf",
            sizeBytes: 100,
            deletedDate: null
          }
        }
      }]
    } as any)

    await service.updateStatus(15, 2, { status: GeccStatus.READY_TO_SEND })
    expect(repository.updateStatus).toHaveBeenCalledWith({
      processId: 15,
      processGeccId: 4,
      status: GeccStatus.READY_TO_SEND,
      changedById: 2
    })
  })

  test("respeita a sequência de envio e conclusão", async () => {
    await expect(
      service.updateStatus(15, 2, { status: GeccStatus.SENT_TO_CGP })
    ).rejects.toThrow("Marque o GECC como pronto")

    repository.findProcess.mockResolvedValue({
      ...process,
      geccProcesses: [{ ...process.geccProcesses[0], status: GeccStatus.SENT_TO_CGP }]
    } as any)
    await service.updateStatus(15, 2, { status: GeccStatus.COMPLETED })
    expect(repository.updateStatus).toHaveBeenCalledWith({
      processId: 15,
      processGeccId: 4,
      status: GeccStatus.COMPLETED,
      changedById: 2
    })
  })
})
