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
import { ProcessoService } from "../../../src/service/processoService";
import { AberturaProcessoDto } from "../../../src/type/dto/processoDto";
import dayjs from "dayjs";

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
      findById: jest.fn(),
      updateStatus: jest.fn(),
      create: jest.fn(),
      obterParaCppdPorId: jest.fn(),
    } as any;

    tableRepo = {
      findVigente: jest.fn(),
    } as any;

    userRepo = {
      findById: jest.fn(),
      updateWithRolesAndDocente: jest.fn(),
    } as any;

    scoreRepo = {
      findBlocksWithScoresByProcess: jest.fn(),
    } as any;

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
    userRepo.findById.mockResolvedValue({
      docente: { classLevel: "B1" },
    } as any);
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
      rscDetails: {
        targetLevel: "RSC_II",
        careerEntryDateISO: "2018-01-01",
        activityPeriodStartISO: "2018-01-01",
        activityPeriodEndISO: "2025-12-31",
        truthDeclarationAccepted: true,
      },
    };
    userRepo.findById.mockResolvedValue({
      docente: { educationLevel: "Especialização", specialization: "Gestão" },
    } as any);
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

  test("rejeita RSC III sem mestrado concluído", async () => {
    const rscConfig = {
      ...processTypeConfig,
      idProcessType: 3,
      code: "RSC",
      name: "Reconhecimento de Saberes e Competências",
      category: ProcessTypeCategory.RSC,
    };
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      rscConfig as any,
    );
    tableRepo.findVigente.mockResolvedValue({ idScoringTable: 20 } as any);
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue({
      docente: { educationLevel: "Especialização", specialization: "Gestão" },
    } as any);

    await expect(
      service.abrirComAtualizacao(7, null, {
        campus: "Campus Teste",
        cidadeUF: "Santa Maria/RS",
        processTypeCode: "RSC",
        rscDetails: {
          targetLevel: "RSC_III",
          careerEntryDateISO: "2018-01-01",
          activityPeriodStartISO: "2018-01-01",
          activityPeriodEndISO: "2025-12-31",
          truthDeclarationAccepted: true,
        },
      }),
    ).rejects.toThrow("exige mestrado concluída");
  });

  test("rejeita atividades RSC anteriores à janela de cinco anos", async () => {
    const rscConfig = {
      ...processTypeConfig,
      idProcessType: 3,
      code: "RSC",
      name: "Reconhecimento de Saberes e Competências",
      category: ProcessTypeCategory.RSC,
    };
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      rscConfig as any,
    );
    tableRepo.findVigente.mockResolvedValue({ idScoringTable: 20 } as any);
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue({
      docente: { educationLevel: "Mestrado", mastersDegree: "Educação" },
    } as any);

    await expect(
      service.abrirComAtualizacao(7, null, {
        campus: "Campus Teste",
        cidadeUF: "Santa Maria/RS",
        processTypeCode: "RSC",
        rscDetails: {
          targetLevel: "RSC_III",
          careerEntryDateISO: "2020-01-01",
          activityPeriodStartISO: "2014-12-31",
          activityPeriodEndISO: "2025-12-31",
          truthDeclarationAccepted: true,
        },
      }),
    ).rejects.toThrow("cinco anos regulamentares");
  });

  test("rejeita novo nível RSC sem três anos após a concessão anterior", async () => {
    const rscConfig = {
      ...processTypeConfig,
      idProcessType: 3,
      code: "RSC",
      name: "Reconhecimento de Saberes e Competências",
      category: ProcessTypeCategory.RSC,
    };
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      rscConfig as any,
    );
    tableRepo.findVigente.mockResolvedValue({ idScoringTable: 20 } as any);
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue({
      docente: { educationLevel: "Mestrado", mastersDegree: "Educação" },
    } as any);

    await expect(
      service.abrirComAtualizacao(7, null, {
        campus: "Campus Teste",
        cidadeUF: "Santa Maria/RS",
        processTypeCode: "RSC",
        rscDetails: {
          targetLevel: "RSC_III",
          careerEntryDateISO: "2010-01-01",
          previousRscGrantedAtISO: "2024-01-01",
          activityPeriodStartISO: "2024-01-01",
          activityPeriodEndISO: "2026-01-01",
          truthDeclarationAccepted: true,
        },
      }),
    ).rejects.toThrow("ao menos três anos");
  });

  test("exige 36 pontos no nível pretendido para enviar RSC", async () => {
    const rscConfig = {
      ...processTypeConfig,
      code: "RSC",
      category: ProcessTypeCategory.RSC,
    };
    processRepo.findById.mockResolvedValue({
      idProcess: 100,
      userId: 7,
      status: ProcessStatus.DRAFT,
      scoringTableId: 20,
      processTypeConfig: rscConfig,
      table: { minRequiredPoints: 60 },
      rscDetail: {
        targetLevel: "RSC_II",
        reportFileId: 9,
        careerEntryDate: new Date("2018-01-01"),
        previousRscGrantedAt: null,
        activityPeriodStart: new Date("2018-01-01"),
        activityPeriodEnd: new Date("2025-12-31"),
        truthDeclarationAcceptedAt: new Date("2026-01-01"),
      },
      documents: [],
    } as any);
    userRepo.findById.mockResolvedValue({
      docente: { educationLevel: "Especialização", specialization: "Gestão" },
    } as any);
    scoreRepo.findBlocksWithScoresByProcess.mockResolvedValue([
      {
        nodeId: 1,
        code: "RSC_II",
        name: "RSC II",
        parentId: null,
        sortOrder: 1,
        hasFormula: false,
        formulaExpression: null,
        items: [
          {
            itemId: 1,
            points: 1,
            hasMaxPoints: false,
            maxPoints: null,
            formulaKey: null,
            currentScore: { quantity: 1, awardedPoints: 35 },
          },
        ],
      },
      {
        nodeId: 2,
        code: "RSC_I",
        name: "RSC I",
        parentId: null,
        sortOrder: 2,
        hasFormula: false,
        formulaExpression: null,
        items: [
          {
            itemId: 2,
            points: 1,
            hasMaxPoints: false,
            maxPoints: null,
            formulaKey: null,
            currentScore: { quantity: 1, awardedPoints: 30 },
          },
        ],
      },
    ] as any);

    await expect(service.enviarParaAvaliacao(100, 7)).rejects.toThrow(
      "36 pontos no nível pretendido",
    );
    expect(processRepo.updateStatus).not.toHaveBeenCalled();
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
    userRepo.findById.mockResolvedValue({
      docente: {
        classLevel: "C4",
        start_interstice: new Date("2024-01-01"),
      },
    } as any);
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

  test("rejeita abertura da Classe Titular fora de C4", async () => {
    const fullProfessorConfig = {
      ...processTypeConfig,
      idProcessType: 4,
      code: "FULL_PROFESSOR",
      name: "Acesso à Classe Titular",
      category: ProcessTypeCategory.FULL_PROFESSOR,
      requiresScoring: false,
      requiresCommittee: true,
    };
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      fullProfessorConfig as any,
    );
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue({
      docente: {
        classLevel: "C3",
        start_interstice: new Date("2020-01-01"),
      },
    } as any);

    await expect(
      service.abrirComAtualizacao(7, null, {
        campus: "Campus Teste",
        cidadeUF: "Santa Maria/RS",
        processTypeCode: "FULL_PROFESSOR",
        fullProfessorDetails: { evaluationMode: "MEMORIAL" },
      }),
    ).rejects.toThrow("esteja em C4");
  });

  test("rejeita abertura da Classe Titular antes de 12 meses em C4", async () => {
    const fullProfessorConfig = {
      ...processTypeConfig,
      idProcessType: 4,
      code: "FULL_PROFESSOR",
      name: "Acesso à Classe Titular",
      category: ProcessTypeCategory.FULL_PROFESSOR,
      requiresScoring: false,
      requiresCommittee: true,
    };
    processRepo.findActiveProcessTypeConfigByCode.mockResolvedValue(
      fullProfessorConfig as any,
    );
    processRepo.findAnyActiveProcessForUser.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue({
      docente: {
        classLevel: "C4",
        start_interstice: dayjs().subtract(11, "month").toDate(),
      },
    } as any);

    await expect(
      service.abrirComAtualizacao(7, null, {
        campus: "Campus Teste",
        cidadeUF: "Santa Maria/RS",
        processTypeCode: "FULL_PROFESSOR",
        fullProfessorDetails: { evaluationMode: "MEMORIAL" },
      }),
    ).rejects.toThrow("após 12 meses completos");
  });
});
