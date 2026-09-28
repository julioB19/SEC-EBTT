import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  ProcessStatus,
  ProcessType,
  ProcessTypeCategory,
  ScoringTablePurpose,
} from "@prisma/client";
import { ProcessRepository } from "../../../src/repository/processoRepository";
import { ScoringTableRepository } from "../../../src/repository/scoringTableRepository";
import { UserRepository } from "../../../src/repository/userRepository";
import { ProcessScoreRepository } from "../../../src/repository/processScoreRepository";
import {
  BusinessRuleError,
  ProcessoService,
} from "../../../src/service/processoService";
import { AberturaProcessoDto } from "../../../src/type/dto/processoDto";

describe("ProcessoService", () => {
  let processRepo: jest.Mocked<ProcessRepository>;
  let tableRepo: jest.Mocked<ScoringTableRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let scoreRepo: jest.Mocked<ProcessScoreRepository>;
  let service: ProcessoService;

  const processTypeConfig = {
    idProcessType: 1,
    code: "PROGRESSION",
    name: "Progressão funcional",
    category: ProcessTypeCategory.CAREER,
    requiresScoring: true,
    requiresCommittee: false,
    requiresGecc: false,
    opinionTemplateId: null,
    defaultDestination: "CPPD",
    version: 1,
    validFrom: new Date("2026-01-01"),
    validUntil: null,
    documentRequirements: [],
    active: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedDate: null,
  };

  const baseDto: AberturaProcessoDto = {
    tipo: "PROGRESSAO",
    campus: "Campus Teste",
    cidadeUF: "Santa Maria/RS",
    dataEmissaoISO: "2026-01-10",
    intersticioInicioISO: "2024-01-01",
    intersticioFimISO: "2025-12-31",
    classeOrigem: "B",
    nivelOrigem: "1",
    classeDestino: "B",
    nivelDestino: "2",
  };

  beforeEach(() => {
    processRepo = {
      listActiveProcessTypeConfigs: jest.fn(),
      findActiveProcessTypeConfigByCode: jest.fn(),
      findActiveProcessTypeConfigById: jest.fn(),
      findAnyActiveProcessForUser: jest.fn(),
      findLastApprovedProcessForUser: jest.fn(),
      findApprovedByProcessTypeId: jest.fn(),
      findApprovedByInterstice: jest.fn(),
      findApprovedByMovement: jest.fn(),
      create: jest.fn(),
      obterParaCppdPorId: jest.fn(),
      finalizeDocumentReview: jest.fn(),
    } as any;

    tableRepo = {
      findVigente: jest.fn(),
    } as any;

    userRepo = {
      updateWithRolesAndDocente: jest.fn(),
    } as any;

    scoreRepo = {} as any;

    service = new ProcessoService(processRepo, tableRepo, userRepo, scoreRepo);
  });

  test("lista tipos de processo configuráveis ativos", async () => {
    processRepo.listActiveProcessTypeConfigs.mockResolvedValue([
      processTypeConfig,
    ] as any);

    await expect(service.listarTiposProcesso()).resolves.toEqual([
      {
        idProcessType: 1,
        code: "PROGRESSION",
        name: "Progressão funcional",
        category: ProcessTypeCategory.CAREER,
        requiresScoring: true,
        requiresCommittee: false,
        requiresGecc: false,
        defaultDestination: "CPPD",
        version: 1,
        validFrom: new Date("2026-01-01"),
        validUntil: null,
        opinionTemplateId: null,
        active: true,
        documentRequirements: [],
      },
    ]);
  });

  test("abre processo legado vinculando o tipo configurável do banco", async () => {
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      processTypeConfig as any,
    );
    tableRepo.findVigente.mockResolvedValue({ idScoringTable: 10 } as any);
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    processRepo.findLastApprovedProcessForUser.mockResolvedValue(null);
    processRepo.findApprovedByInterstice.mockResolvedValue(null);
    processRepo.findApprovedByMovement.mockResolvedValue(null);
    processRepo.create.mockResolvedValue({
      idProcess: 99,
      userId: 7,
      processTypeId: 1,
      scoringTableId: 10,
      type: ProcessType.PROGRESSAO,
      status: ProcessStatus.DRAFT,
      createdAt: new Date("2026-01-10"),
      campus: baseDto.campus,
      cidadeUF: baseDto.cidadeUF,
      intersticeStart: new Date(baseDto.intersticioInicioISO!),
      intersticeEnd: new Date(baseDto.intersticioFimISO!),
      classeOrigem: baseDto.classeOrigem,
      nivelOrigem: baseDto.nivelOrigem,
      classeDestino: baseDto.classeDestino,
      nivelDestino: baseDto.nivelDestino,
      processTypeConfig,
    } as any);

    const result = await service.abrirComAtualizacao(7, null, baseDto);

    expect(processRepo.findActiveProcessTypeConfigByCode).toHaveBeenCalledWith(
      "PROGRESSION",
    );
    expect(tableRepo.findVigente).toHaveBeenCalledWith(
      expect.any(Date),
      ScoringTablePurpose.PROGRESSION_PROMOTION,
    );
    expect(processRepo.create).toHaveBeenCalledWith(
      7,
      10,
      ProcessType.PROGRESSAO,
      baseDto,
      1,
      "PROGRESSION",
    );
    expect(result).toEqual(
      expect.objectContaining({
        processId: 99,
        processTypeId: 1,
        processTypeCode: "PROGRESSION",
        processTypeName: "Progressão funcional",
      }),
    );
  });

  test("abre RSC usando tabela específica e sem tipo legado", async () => {
    const rscConfig = {
      ...processTypeConfig,
      idProcessType: 3,
      code: "RSC",
      name: "Reconhecimento de Saberes e Competências",
      category: ProcessTypeCategory.RSC,
    };
    const dto: AberturaProcessoDto = {
      campus: "Campus Teste",
      cidadeUF: "Santa Maria/RS",
      processTypeCode: "RSC",
      rscDetails: { targetLevel: "RSC_II", simecReference: "SIMEC-123" },
    };
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      rscConfig as any,
    );
    tableRepo.findVigente.mockResolvedValue({ idScoringTable: 20 } as any);
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    processRepo.create.mockResolvedValue({
      idProcess: 100,
      userId: 7,
      processTypeId: 3,
      scoringTableId: 20,
      type: null,
      status: ProcessStatus.DRAFT,
      createdAt: new Date("2026-01-10"),
      campus: dto.campus,
      cidadeUF: dto.cidadeUF,
      processTypeConfig: rscConfig,
      rscDetail: dto.rscDetails,
    } as any);

    const result = await service.abrirComAtualizacao(7, null, dto);

    expect(tableRepo.findVigente).toHaveBeenCalledWith(
      expect.any(Date),
      ScoringTablePurpose.RSC,
    );
    expect(processRepo.create).toHaveBeenCalledWith(7, 20, null, dto, 3, "RSC");
    expect(result).toEqual(
      expect.objectContaining({
        processId: 100,
        processTypeCode: "RSC",
      }),
    );
  });

  test("abre processo simples configurado sem tipo legado", async () => {
    const simpleConfig = {
      ...processTypeConfig,
      idProcessType: 5,
      code: "TRAINING_LEAVE",
      name: "Afastamento para capacitação",
      category: ProcessTypeCategory.SIMPLE,
      requiresScoring: false,
    };
    const dto: AberturaProcessoDto = {
      campus: "Campus Teste",
      cidadeUF: "Santa Maria/RS",
      processTypeCode: "TRAINING_LEAVE",
    };
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      simpleConfig as any,
    );
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    processRepo.create.mockResolvedValue({
      idProcess: 102,
      userId: 7,
      processTypeId: 5,
      scoringTableId: null,
      type: null,
      status: ProcessStatus.DRAFT,
      createdAt: new Date("2026-01-10"),
      campus: dto.campus,
      cidadeUF: dto.cidadeUF,
      processTypeConfig: simpleConfig,
    } as any);

    const result = await service.abrirComAtualizacao(7, null, dto);

    expect(tableRepo.findVigente).not.toHaveBeenCalled();
    expect(processRepo.create).toHaveBeenCalledWith(
      7,
      null,
      null,
      dto,
      5,
      "TRAINING_LEAVE",
    );
    expect(result).toEqual(
      expect.objectContaining({
        processId: 102,
        processTypeCode: "TRAINING_LEAVE",
      }),
    );
  });
  test("finaliza análise documental de processo simples", async () => {
    const simpleConfig = {
      ...processTypeConfig,
      idProcessType: 5,
      code: "TRAINING_LEAVE",
      category: ProcessTypeCategory.SIMPLE,
      requiresScoring: false,
      requiresCommittee: false,
    };
    processRepo.obterParaCppdPorId.mockResolvedValue({
      idProcess: 102,
      status: ProcessStatus.SUBMITTED,
      processTypeConfig: simpleConfig,
    } as any);
    processRepo.finalizeDocumentReview.mockResolvedValue({
      idProcess: 102,
      status: ProcessStatus.APPROVED,
      evaluationOpinion: "Documentação conferida e aprovada.",
    } as any);

    const result = await service.finalizarAnaliseDocumentalCppd(102, 8, {
      decision: "APPROVED",
      opinionText: "  Documentação conferida e aprovada.  ",
    });

    expect(processRepo.finalizeDocumentReview).toHaveBeenCalledWith({
      processId: 102,
      fromStatus: ProcessStatus.SUBMITTED,
      toStatus: ProcessStatus.APPROVED,
      evaluationOpinion: "Documentação conferida e aprovada.",
      changedById: 8,
    });
    expect(result).toEqual({
      idProcess: 102,
      status: ProcessStatus.APPROVED,
      evaluationOpinion: "Documentação conferida e aprovada.",
    });
  });

  test("impede análise documental em fluxo que exige pontuação", async () => {
    processRepo.obterParaCppdPorId.mockResolvedValue({
      idProcess: 99,
      status: ProcessStatus.SUBMITTED,
      processTypeConfig,
    } as any);

    await expect(
      service.finalizarAnaliseDocumentalCppd(99, 8, {
        decision: "APPROVED",
        opinionText: "Parecer.",
      }),
    ).rejects.toThrow("fluxo específico de pontuação ou comissão");
    expect(processRepo.finalizeDocumentReview).not.toHaveBeenCalled();
  });

  test("abre Classe Titular sem exigir tabela de pontuação", async () => {
    const fullProfessorConfig = {
      ...processTypeConfig,
      idProcessType: 4,
      code: "FULL_PROFESSOR",
      name: "Acesso à Classe Titular",
      category: ProcessTypeCategory.FULL_PROFESSOR,
      requiresScoring: false,
      requiresCommittee: true,
    };
    const dto: AberturaProcessoDto = {
      campus: "Campus Teste",
      cidadeUF: "Santa Maria/RS",
      processTypeCode: "FULL_PROFESSOR",
      fullProfessorDetails: { evaluationMode: "MEMORIAL" },
    };
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      fullProfessorConfig as any,
    );
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    processRepo.findApprovedByProcessTypeId.mockResolvedValue(null);
    processRepo.create.mockResolvedValue({
      idProcess: 101,
      userId: 7,
      processTypeId: 4,
      scoringTableId: null,
      type: null,
      status: ProcessStatus.DRAFT,
      createdAt: new Date("2026-01-10"),
      campus: dto.campus,
      cidadeUF: dto.cidadeUF,
      processTypeConfig: fullProfessorConfig,
      fullProfessorDetail: dto.fullProfessorDetails,
    } as any);

    const result = await service.abrirComAtualizacao(7, null, dto);

    expect(tableRepo.findVigente).not.toHaveBeenCalled();
    expect(processRepo.create).toHaveBeenCalledWith(
      7,
      null,
      null,
      dto,
      4,
      "FULL_PROFESSOR",
    );
    expect(result).toEqual(
      expect.objectContaining({
        processId: 101,
        processTypeCode: "FULL_PROFESSOR",
      }),
    );
  });
});
