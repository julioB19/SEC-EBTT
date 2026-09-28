import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ProcessStatus, ProcessTypeCategory } from "@prisma/client";
import { ProcessRepository } from "../../../src/repository/processoRepository";
import { ScoringTableRepository } from "../../../src/repository/scoringTableRepository";
import { UserRepository } from "../../../src/repository/userRepository";
import { ProcessScoreRepository } from "../../../src/repository/processScoreRepository";
import {
  BusinessRuleError,
  ProcessoService,
} from "../../../src/service/processoService";

describe("ProcessoService - documentos configurados", () => {
  let processRepo: jest.Mocked<ProcessRepository>;
  let service: ProcessoService;

  const requirement = {
    idDocumentRequirement: 11,
    code: "REQUEST_FORM",
    name: "Requerimento assinado",
    description: null,
    required: true,
    allowsMultiple: false,
    acceptedFormats: "pdf",
    maxSizeMb: 10,
    sortOrder: 1,
    active: true,
    deletedDate: null,
  };

  const process = {
    idProcess: 25,
    userId: 7,
    status: ProcessStatus.DRAFT,
    deletedDate: null,
    processTypeConfig: {
      idProcessType: 3,
      code: "CUSTOM_PROCESS",
      name: "Processo customizado",
      category: ProcessTypeCategory.SIMPLE,
      requiresScoring: false,
      documentRequirements: [requirement],
    },
    documents: [],
  };

  beforeEach(() => {
    processRepo = {
      findById: jest.fn(),
      attachConfiguredDocument: jest.fn(),
      removeConfiguredDocument: jest.fn(),
      updateStatus: jest.fn(),
    } as any;
    service = new ProcessoService(
      processRepo,
      {} as ScoringTableRepository,
      {} as UserRepository,
      {} as ProcessScoreRepository,
    );
  });

  test("bloqueia o envio quando falta documento obrigatório configurado", async () => {
    processRepo.findById.mockResolvedValue(process as any);

    await expect(service.enviarParaAvaliacao(25, 7)).rejects.toMatchObject({
      name: "BusinessRuleError",
      message: "Anexe todos os documentos obrigatórios antes do envio",
      details: {
        missingDocuments: [
          { code: "REQUEST_FORM", name: "Requerimento assinado" },
        ],
      },
    });
    expect(processRepo.updateStatus).not.toHaveBeenCalled();
  });

  test("valida formato e tamanho antes de persistir o anexo", async () => {
    processRepo.findById.mockResolvedValue(process as any);

    await expect(
      service.anexarDocumentoConfigurado({
        processId: 25,
        userId: 7,
        requirementCode: "REQUEST_FORM",
        originalName: "requerimento.png",
        storedName: "arquivo.png",
        webUrl: "/uploads/7/25/arquivo.png",
        mimeType: "image/png",
        sizeBytes: 1024,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);

    await expect(
      service.anexarDocumentoConfigurado({
        processId: 25,
        userId: 7,
        requirementCode: "REQUEST_FORM",
        originalName: "requerimento.pdf",
        storedName: "arquivo.pdf",
        webUrl: "/uploads/7/25/arquivo.pdf",
        mimeType: "application/pdf",
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(processRepo.attachConfiguredDocument).not.toHaveBeenCalled();
  });

  test("anexa PDF válido usando a regra da versão do processo", async () => {
    processRepo.findById.mockResolvedValue(process as any);
    processRepo.attachConfiguredDocument.mockResolvedValue({
      process: {
        ...process,
        documents: [
          {
            idDocumentProcess: 81,
            documentType: "REQUEST_FORM",
            nature: "REQUIRED",
            checked: false,
            receivedAt: new Date(),
            evidenceFile: {
              idEvidenceFile: 91,
              originalName: "requerimento.pdf",
              mimeType: "application/pdf",
              sizeBytes: BigInt(2048),
              uploadedAt: new Date(),
            },
          },
        ],
      } as any,
      replacedFileUrl: null,
    });

    const result = await service.anexarDocumentoConfigurado({
      processId: 25,
      userId: 7,
      requirementCode: "request_form",
      originalName: "requerimento.pdf",
      storedName: "arquivo.pdf",
      webUrl: "/uploads/7/25/arquivo.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    });

    expect(processRepo.attachConfiguredDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: 25,
        userId: 7,
        requirementCode: "REQUEST_FORM",
        required: true,
        allowsMultiple: false,
      }),
    );
    expect(result.process.configuredDocuments).toEqual([
      expect.objectContaining({
        idDocumentProcess: 81,
        documentType: "REQUEST_FORM",
        file: expect.objectContaining({ sizeBytes: 2048 }),
      }),
    ]);
  });
});
