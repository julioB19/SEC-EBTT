import dayjs from "dayjs";
import { prisma } from "../infra/prismaClient";
import { careerPreparationAllowed, addMonthsClamped } from "../util/careerDates";
import { assertTitularReady } from "./caseComplianceService";
import "dayjs/locale/pt-br";
import utc from "dayjs/plugin/utc";
import path from "path";
import {
  ClassLevel,
  FullProfessorEvaluationMode,
  ProcessStatus,
  ProcessType,
  ProcessTypeCategory,
  ProcessTypeConfig,
  ScoringTablePurpose,
} from "@prisma/client";
import {
  AberturaProcessoDto,
  UpdateProcessoDto,
  UserPatchDto,
} from "../type/dto/processoDto";
import { renderDocxFromTemplate } from "../util/docx";
import { convertDocxToPdf } from "../util/convertToPdf";
import { ProcessRepository } from "../repository/processoRepository";
import { ScoringTableRepository } from "../repository/scoringTableRepository";
import { UserRepository } from "../repository/userRepository";
import { ProcessScoreRepository } from "../repository/processScoreRepository";
import { capScore } from "../util/rscScoring";

dayjs.locale("pt-br");
dayjs.extend(utc);

const PROCESS_TYPE_CODE_ALIASES: Record<string, string> = {
  PROGRESSAO: "PROGRESSION",
  PROGRESSAO_FUNCIONAL: "PROGRESSION",
  PROGRESSION: "PROGRESSION",
  PROMOCAO: "PROMOTION",
  PROMOCAO_FUNCIONAL: "PROMOTION",
  PROMOTION: "PROMOTION",
  RSC: "RSC",
  CLASSE_TITULAR: "FULL_PROFESSOR",
  PROFESSOR_TITULAR: "FULL_PROFESSOR",
  FULL_PROFESSOR: "FULL_PROFESSOR",
};

const RSC_TARGET_LEVELS = new Set(["RSC_I", "RSC_II", "RSC_III"]);

export class BusinessRuleError extends Error {
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "BusinessRuleError";
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ProcessoService {
  constructor(
    private readonly processRepo: ProcessRepository,
    private readonly tableRepo: ScoringTableRepository,
    private readonly userRepo: UserRepository,
    private readonly scoreRepo: ProcessScoreRepository = new ProcessScoreRepository(),
  ) {}

  async listarTiposProcesso() {
    const list = await this.processRepo.listActiveProcessTypeConfigs();
    return list.map((config) => this.mapProcessTypeConfigToDto(config));
  }

  async enviarParaAvaliacao(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findById(processId);
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT &&
      careerProcess.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Você só pode enviar processos com status DRAFT ou RETURNED",
      );
    }

    const config = careerProcess.processTypeConfig;
    const category = config?.category ?? ProcessTypeCategory.CAREER;

    this.validarDocumentosConfigurados(careerProcess);

    if (category === ProcessTypeCategory.CAREER) {
      this.validarRegrasDeRequerimento(careerProcess);
    } else if (category === ProcessTypeCategory.RSC) {
      await this.validarElegibilidadeRsc(
        userId,
        careerProcess.rscDetail?.targetLevel ?? "",
      );
      if (!careerProcess.rscDetail?.targetLevel) {
        throw new BusinessRuleError(
          "Informe o nível pretendido do RSC antes do envio",
        );
      }
      if (!careerProcess.rscDetail.reportFileId) {
        throw new BusinessRuleError(
          "Anexe o relatório descritivo ou memorial do RSC antes do envio",
        );
      }
      this.validarPeriodoRsc({
        careerEntryDateISO:
          careerProcess.rscDetail.careerEntryDate?.toISOString(),
        previousRscGrantedAtISO:
          careerProcess.rscDetail.previousRscGrantedAt?.toISOString() ?? null,
        activityPeriodStartISO:
          careerProcess.rscDetail.activityPeriodStart?.toISOString(),
        activityPeriodEndISO:
          careerProcess.rscDetail.activityPeriodEnd?.toISOString(),
        truthDeclarationAccepted: Boolean(
          careerProcess.rscDetail.truthDeclarationAcceptedAt,
        ),
      });
    } else if (category === ProcessTypeCategory.FULL_PROFESSOR) {
      await this.validarElegibilidadeClasseTitular(userId, false);
      await assertTitularReady(processId, "SUBMIT");
      const detail = careerProcess.fullProfessorDetail;
      if (!detail?.evaluationMode) {
        throw new BusinessRuleError(
          "Selecione Memorial ou Tese acadêmica antes do envio",
        );
      }

      const selectedFileId =
        detail.evaluationMode === FullProfessorEvaluationMode.MEMORIAL
          ? detail.memorialFileId
          : detail.thesisFileId;
      if (!selectedFileId) {
        throw new BusinessRuleError(
          `Anexe o arquivo de ${detail.evaluationMode === FullProfessorEvaluationMode.MEMORIAL ? "memorial" : "tese acadêmica"} antes do envio`,
        );
      }

      const degree = detail.doctorateDegree;
      const degreeType = String(degree?.degreeType ?? "").toUpperCase();
      if (
        !degree ||
        !["DOCTORATE", "DOUTORADO"].includes(degreeType) ||
        !degree.conclusionDate ||
        !degree.evidenceFileId
      ) {
        throw new BusinessRuleError(
          "Cadastre o doutorado, a data de conclusão e o diploma antes de enviar o processo",
        );
      }
    }

    let totalPontos: number | null = null;
    if (config?.requiresScoring ?? true) {
      if (!careerProcess.scoringTableId || !careerProcess.table) {
        throw new BusinessRuleError(
          "Processo sem tabela de pontuação vinculada",
        );
      }

      const scoreSummary = await this.calcularPontuacaoProcesso(processId);
      totalPontos = scoreSummary.total;
      const configuredMinimum = careerProcess.table.minRequiredPoints;
      const requiredMinimum =
        configuredMinimum !== null && configuredMinimum !== undefined
          ? Number(configuredMinimum)
          : category === ProcessTypeCategory.RSC
            ? 60
            : 120;

      if (totalPontos < requiredMinimum) {
        throw new BusinessRuleError(
          `Para enviar o processo, é necessário atingir no mínimo ${requiredMinimum} pontos. ` +
            `Pontuação atual: ${totalPontos.toFixed(2)}`,
          {
            requiredMinimum,
            currentTotal: totalPontos,
          },
        );
      }

      if (category === ProcessTypeCategory.RSC) {
        const targetLevel = careerProcess.rscDetail?.targetLevel ?? "";
        const targetLevelPoints = scoreSummary.byRscLevel[targetLevel] ?? 0;
        const requiredTargetLevelPoints = 36;

        if (targetLevelPoints < requiredTargetLevelPoints) {
          throw new BusinessRuleError(
            `Para enviar o RSC, é necessário atingir no mínimo ${requiredTargetLevelPoints} pontos no nível pretendido. ` +
              `Pontuação atual no ${targetLevel.replace("_", " ")}: ${targetLevelPoints.toFixed(2)}`,
            {
              targetLevel,
              requiredTargetLevelPoints,
              currentTargetLevelPoints: targetLevelPoints,
            },
          );
        }
      }
    }

    const updated = await this.processRepo.updateStatus(
      processId,
      ProcessStatus.SUBMITTED,
      userId,
      "Processo enviado pelo docente",
    );

    if (!updated) {
      throw new NotFoundError("Processo não encontrado");
    }

    return {
      processId: updated.idProcess,
      status: updated.status,
      totalPoints: totalPontos,
    };
  }

  async abrirComAtualizacao(
    userId: number,
    patch: UserPatchDto | null,
    dto: AberturaProcessoDto,
  ) {
    const now = new Date();

    if (patch) {
      const updateInput: any = {
        name: patch.name,
        email: patch.email,
        phone: patch.phone ?? undefined,
        city: patch.city ?? undefined,
        uf: patch.uf ?? undefined,
        docenteProfile: patch.docenteProfile
          ? {
              siape: patch.docenteProfile.siape,
              classLevel: patch.docenteProfile.classLevel,
              startInterstice: patch.docenteProfile.startInterstice
                ? new Date(patch.docenteProfile.startInterstice)
                : undefined,
              educationLevel: patch.docenteProfile.educationLevel,
              assignment: patch.docenteProfile.assignment ?? undefined,
            }
          : undefined,
      };

      await this.userRepo.updateWithRolesAndDocente(userId, updateInput);
    }

    const processTypeConfig = await this.resolveProcessTypeConfig(dto);
    const processType =
      this.resolveSupportedOpeningProcessType(processTypeConfig);
    const scoringTablePurpose = this.resolveScoringTablePurpose(
      processTypeConfig.code,
    );

    let scoringTableId: number | null = null;
    if (processTypeConfig.requiresScoring) {
      const vigente = await this.tableRepo.findVigente(
        now,
        scoringTablePurpose,
      );
      if (!vigente) {
        throw new BusinessRuleError(
          `Nenhuma tabela de pontuação vigente encontrada para ${processTypeConfig.name}`,
        );
      }
      scoringTableId = vigente.idScoringTable;
    }

    const active = await this.processRepo.findAnyActiveProcessForUser(
      userId,
      processTypeConfig.idProcessType,
    );
    if (active) {
      const msg =
        `Já existe um processo de ${processTypeConfig.name} em andamento ` +
        `(nº ${active.idProcess}, status ${active.status}). ` +
        "Finalize ou exclua esse processo antes de abrir outro do mesmo tipo";

      throw new BusinessRuleError(msg, {
        existingProcessId: active.idProcess,
        existingStatus: active.status,
      });
    }

    this.validarDadosComunsAbertura(dto);

    if (processTypeConfig.category === ProcessTypeCategory.CAREER) {
      if (!processType) {
        throw new BusinessRuleError(
          "Tipo legado obrigatório para processo de carreira",
        );
      }
      await this.validarAberturaCarreira(userId, processType, dto);
    } else if (processTypeConfig.category === ProcessTypeCategory.RSC) {
      await this.validarAberturaRsc(userId, dto);
    } else if (
      processTypeConfig.category === ProcessTypeCategory.FULL_PROFESSOR
    ) {
      await this.validarAberturaClasseTitular(userId, dto);

      const approved = await this.processRepo.findApprovedByProcessTypeId(
        userId,
        processTypeConfig.idProcessType,
      );
      if (approved) {
        throw new BusinessRuleError(
          `Já existe um processo de Classe Titular aprovado (nº ${approved.idProcess}).`,
        );
      }
    }

    const created = await this.processRepo.create(
      userId,
      scoringTableId,
      processType,
      dto,
      processTypeConfig.idProcessType,
      processTypeConfig.code,
    );

    return this.mapProcessToDto(created);
  }

  private validarDadosComunsAbertura(dto: AberturaProcessoDto) {
    if (!String(dto.campus ?? "").trim()) {
      throw new BusinessRuleError("Campus é obrigatório");
    }
    if (!String(dto.cidadeUF ?? "").trim()) {
      throw new BusinessRuleError("Cidade e UF são obrigatórios");
    }
  }

  private async validarAberturaRsc(
    userId: number,
    dto: AberturaProcessoDto,
  ) {
    const targetLevel = this.normalizeProcessTypeCode(
      dto.rscDetails?.targetLevel,
    );
    if (!RSC_TARGET_LEVELS.has(targetLevel)) {
      throw new BusinessRuleError(
        "Selecione o nível pretendido: RSC I, RSC II ou RSC III",
      );
    }
    if (dto.rscDetails) dto.rscDetails.targetLevel = targetLevel;
    await this.validarElegibilidadeRsc(userId, targetLevel);
    this.validarPeriodoRsc(dto.rscDetails);
  }

  private async validarElegibilidadeRsc(userId: number, targetLevel: string) {
    const user = await this.userRepo.findById(userId);
    const profile = user?.docente;
    if (!profile) {
      throw new BusinessRuleError("Perfil docente não encontrado");
    }

    const normalizedEducation = String(profile.educationLevel ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    const hasSpecialization =
      Boolean(profile.specialization?.trim()) ||
      /ESPECIALIZACAO|POS.?GRADUACAO/.test(normalizedEducation);
    const hasMasters =
      Boolean(profile.mastersDegree?.trim()) ||
      /MESTRADO|MESTRE/.test(normalizedEducation);
    const hasDoctorate =
      Boolean(profile.doctorate?.trim()) ||
      /DOUTORADO|DOUTOR/.test(normalizedEducation);
    const hasGraduation =
      Boolean(normalizedEducation.trim()) ||
      hasSpecialization ||
      hasMasters ||
      hasDoctorate;

    const eligible =
      targetLevel === "RSC_I"
        ? hasGraduation
        : targetLevel === "RSC_II"
          ? hasSpecialization || hasMasters || hasDoctorate
          : targetLevel === "RSC_III"
            ? hasMasters || hasDoctorate
            : false;
    if (!eligible) {
      const requirement =
        targetLevel === "RSC_II"
          ? "especialização"
          : targetLevel === "RSC_III"
            ? "mestrado"
            : "graduação";
      throw new BusinessRuleError(
        `O ${targetLevel.replace("_", " ")} exige ${requirement} concluída no perfil docente`,
      );
    }
  }

  private validarPeriodoRsc(
    details: AberturaProcessoDto["rscDetails"] | undefined,
  ) {
    if (!details?.truthDeclarationAccepted) {
      throw new BusinessRuleError(
        "Confirme a declaração de veracidade das informações do RSC",
      );
    }
    const careerEntryDate = this.parseRequiredDate(
      details.careerEntryDateISO,
      "Data de ingresso na carreira EBTT",
    );
    const activityPeriodStart = this.parseRequiredDate(
      details.activityPeriodStartISO,
      "Início do período de atividades",
    );
    const activityPeriodEnd = this.parseRequiredDate(
      details.activityPeriodEndISO,
      "Fim do período de atividades",
    );
    const today = dayjs().endOf("day");

    if (activityPeriodStart.getTime() > activityPeriodEnd.getTime()) {
      throw new BusinessRuleError(
        "O início do período de atividades deve ser anterior ao fim",
      );
    }
    if (dayjs(activityPeriodEnd).isAfter(today)) {
      throw new BusinessRuleError(
        "O período de atividades do RSC não pode terminar no futuro",
      );
    }
    if (
      dayjs(activityPeriodStart).isBefore(
        dayjs(careerEntryDate).subtract(5, "year"),
      )
    ) {
      throw new BusinessRuleError(
        "As atividades anteriores ao ingresso estão limitadas aos cinco anos regulamentares",
      );
    }

    if (details.previousRscGrantedAtISO) {
      const previousGrant = this.parseRequiredDate(
        details.previousRscGrantedAtISO,
        "Data da concessão anterior de RSC",
      );
      if (dayjs(previousGrant).isAfter(today)) {
        throw new BusinessRuleError(
          "A concessão anterior de RSC não pode estar no futuro",
        );
      }
      if (dayjs(activityPeriodStart).isBefore(dayjs(previousGrant))) {
        throw new BusinessRuleError(
          "Para um novo nível, considere apenas atividades posteriores à concessão anterior",
        );
      }
      if (dayjs(activityPeriodEnd).isBefore(dayjs(previousGrant).add(3, "year"))) {
        throw new BusinessRuleError(
          "Para um novo nível de RSC, o período deve abranger ao menos três anos após a concessão anterior",
        );
      }
    }
  }

  private async validarAberturaClasseTitular(
    userId: number,
    dto: AberturaProcessoDto,
  ) {
    const mode = String(
      dto.fullProfessorDetails?.evaluationMode ?? "",
    ).toUpperCase();
    if (
      !Object.values(FullProfessorEvaluationMode).includes(
        mode as FullProfessorEvaluationMode,
      )
    ) {
      throw new BusinessRuleError(
        "Selecione a modalidade Memorial ou Tese acadêmica",
      );
    }
    if (dto.fullProfessorDetails) {
      dto.fullProfessorDetails.evaluationMode =
        mode as FullProfessorEvaluationMode;
    }
    await this.validarElegibilidadeClasseTitular(userId, false);
  }

  private async validarElegibilidadeClasseTitular(
    userId: number,
    requireFullInterstice: boolean,
  ) {
    const user = await this.userRepo.findById(userId);
    const profile = user?.docente;
    if (!profile) {
      throw new BusinessRuleError("Perfil docente não encontrado");
    }
    if (profile.classLevel !== ClassLevel.C4) {
      throw new BusinessRuleError(
        "A Promoção à Classe Titular exige que o docente esteja em C4",
      );
    }
    if (!profile.start_interstice) {
      throw new BusinessRuleError(
        "Informe o início do interstício em C4 no perfil docente",
      );
    }

    const requiredMonths = requireFullInterstice ? 24 : 12;
    const eligibleAt = dayjs(profile.start_interstice).add(
      requiredMonths,
      "month",
    );
    if (dayjs().isBefore(eligibleAt)) {
      throw new BusinessRuleError(
        requireFullInterstice
          ? "A concessão da Classe Titular exige 24 meses completos em C4"
          : "A abertura da Classe Titular só é permitida após 12 meses completos em C4",
        { eligibleAt: eligibleAt.toISOString(), requiredMonths },
      );
    }
  }

  private async validarAberturaCarreira(
    userId: number,
    processType: ProcessType,
    dto: AberturaProcessoDto,
  ) {
    const classeOrigem = String(dto.classeOrigem ?? "");
    const nivelOrigem = String(dto.nivelOrigem ?? "");
    const classeDestino = String(dto.classeDestino ?? "");
    const nivelDestino = String(dto.nivelDestino ?? "");

    this.validarClasseENivel(classeOrigem, nivelOrigem, "origem");
    this.validarClasseENivel(classeDestino, nivelDestino, "destino");

    const origemCodigo = `${classeOrigem}${nivelOrigem}`.toUpperCase();
    const destinoCodigo = `${classeDestino}${nivelDestino}`.toUpperCase();
    this.validarCombinacaoProgressaoOuPromocao(
      processType,
      origemCodigo,
      destinoCodigo,
    );

    const user = await this.userRepo.findById(userId);
    if (!user?.docente) {
      throw new BusinessRuleError("Perfil docente não encontrado");
    }
    if (String(user.docente.classLevel).toUpperCase() !== origemCodigo) {
      throw new BusinessRuleError(
        `A classe de origem ${origemCodigo} deve corresponder à classe atual do perfil funcional (${user.docente.classLevel})`,
      );
    }

    const intersticeStart = this.parseRequiredDate(
      dto.intersticioInicioISO,
      "Início do interstício",
    );
    const intersticeEnd = this.parseRequiredDate(
      dto.intersticioFimISO,
      "Fim do interstício",
    );
    if (intersticeEnd < intersticeStart) {
      throw new BusinessRuleError(
        "Fim do interstício não pode ser anterior ao início",
      );
    }

    const requiredMonths = origemCodigo === "A1" && destinoCodigo === "B1" ? 36 : 24;
    const functionalStart = user.docente.start_interstice ?? intersticeStart;
    if (dayjs(functionalStart).format("YYYY-MM-DD") !== dayjs(intersticeStart).format("YYYY-MM-DD")) throw new BusinessRuleError("O início do interstício deve corresponder ao cadastro funcional");
    if (!careerPreparationAllowed(intersticeStart, new Date(), requiredMonths)) throw new BusinessRuleError("A preparação só pode começar nos 60 dias anteriores ao cumprimento do interstício");
    if (new Date(intersticeEnd.getTime() + 86400000) < addMonthsClamped(intersticeStart, requiredMonths)) throw new BusinessRuleError("O término informado não cumpre o interstício mínimo da movimentação");

    const lastApproved =
      await this.processRepo.findLastApprovedProcessForUser(userId);
    if (
      lastApproved?.intersticeEnd &&
      intersticeStart <= lastApproved.intersticeEnd
    ) {
      const formattedLastEnd = dayjs(lastApproved.intersticeEnd).format(
        "DD/MM/YYYY",
      );
      throw new BusinessRuleError(
        `Já existe um processo APROVADO com interstício até ${formattedLastEnd} ` +
          `(nº ${lastApproved.idProcess}). O próximo processo só pode iniciar após essa data`,
      );
    }

    const existingApprovedByInterstice =
      await this.processRepo.findApprovedByInterstice(
        userId,
        intersticeStart,
        intersticeEnd,
      );
    if (existingApprovedByInterstice) {
      throw new BusinessRuleError(
        `Já existe um processo APROVADO para este interstício ` +
          `(nº ${existingApprovedByInterstice.idProcess}).`,
      );
    }

    const existingApprovedByMovement =
      await this.processRepo.findApprovedByMovement(
        userId,
        processType,
        classeOrigem,
        nivelOrigem,
        classeDestino,
        nivelDestino,
      );
    if (existingApprovedByMovement) {
      throw new BusinessRuleError(
        `Já existe um processo APROVADO com esta movimentação ` +
          `(nº ${existingApprovedByMovement.idProcess}).`,
      );
    }
  }

  private parseRequiredDate(value: string | undefined, label: string) {
    const parsed = value ? new Date(value) : new Date(Number.NaN);
    if (Number.isNaN(parsed.getTime())) {
      throw new BusinessRuleError(
        `${label} é obrigatório e deve ser uma data válida`,
      );
    }
    return parsed;
  }

  private async resolveProcessTypeConfig(
    dto: AberturaProcessoDto,
  ): Promise<ProcessTypeConfig> {
    if (dto.processTypeId !== undefined) {
      if (!Number.isInteger(dto.processTypeId) || dto.processTypeId <= 0) {
        throw new BusinessRuleError("processTypeId inválido");
      }

      const config = await this.processRepo.findActiveProcessTypeConfigById(
        dto.processTypeId,
      );
      if (!config) {
        throw new BusinessRuleError(
          "Tipo de processo não configurado ou inativo",
          {
            processTypeId: dto.processTypeId,
          },
        );
      }

      return config;
    }

    const normalizedCode = this.normalizeProcessTypeCode(
      dto.processTypeCode ?? dto.tipo,
    );
    if (!normalizedCode) {
      throw new BusinessRuleError("Tipo de processo é obrigatório");
    }

    const code = PROCESS_TYPE_CODE_ALIASES[normalizedCode] ?? normalizedCode;
    const config =
      await this.processRepo.findActiveProcessTypeConfigByCode(code);
    if (!config) {
      throw new BusinessRuleError(
        "Tipo de processo não configurado ou inativo",
        {
          processTypeCode: code,
        },
      );
    }

    return config;
  }

  private normalizeProcessTypeCode(input: unknown): string {
    return String(input ?? "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }

  private resolveSupportedOpeningProcessType(
    config: ProcessTypeConfig,
  ): ProcessType | null {
    if (config.code === "PROGRESSION") return ProcessType.PROGRESSAO;
    if (config.code === "PROMOTION") return ProcessType.PROMOCAO;
    if (
      config.category === ProcessTypeCategory.RSC ||
      config.category === ProcessTypeCategory.FULL_PROFESSOR
    ) {
      return null;
    }

    throw new BusinessRuleError(
      `O tipo de processo "${config.name}" já está configurado, mas o fluxo de abertura ainda não foi implementado.`,
      {
        processTypeId: config.idProcessType,
        processTypeCode: config.code,
      },
    );
  }

  private resolveScoringTablePurpose(
    processTypeCode: string,
  ): ScoringTablePurpose {
    if (processTypeCode === "RSC") return ScoringTablePurpose.RSC;
    if (processTypeCode === "FULL_PROFESSOR") {
      return ScoringTablePurpose.FULL_PROFESSOR_EVALUATION;
    }
    if (processTypeCode === "PROGRESSION" || processTypeCode === "PROMOTION") {
      return ScoringTablePurpose.PROGRESSION_PROMOTION;
    }

    return ScoringTablePurpose.OTHER;
  }

  async listarProcessos(userId: number, statuses?: ProcessStatus[]) {
    const list = await this.processRepo.listByUser(userId, statuses);
    return list.map((p) => this.mapProcessToDto(p));
  }

  async obterProcessoPorId(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findById(processId);
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado");
    }

    return this.mapProcessToDto(careerProcess);
  }

  async excluirProcesso(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findById(processId);
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT
    ) {
      throw new BusinessRuleError(
        "Você só pode excluir processos em rascunho",
      );
    }

    const deleted = await this.processRepo.softDelete(processId);

    return {
      processId: deleted.idProcess,
      status: deleted.status,
      deletedDate: deleted.deletedDate,
    };
  }

  async anexarDocumentoEspecifico(params: {
    processId: number;
    userId: number;
    kind: string;
    originalName: string;
    storedName: string;
    webUrl: string;
    mimeType: string | null;
    sizeBytes: number | null;
    course?: string;
    institution?: string;
    conclusionDateISO?: string;
  }) {
    const careerProcess = await this.processRepo.findById(params.processId);
    if (
      !careerProcess ||
      careerProcess.deletedDate ||
      careerProcess.userId !== params.userId
    ) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT &&
      careerProcess.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Os documentos só podem ser alterados em processos em rascunho ou devolvidos",
      );
    }

    if (params.sizeBytes !== null && params.sizeBytes > 5 * 1024 * 1024) {
      throw new BusinessRuleError(
        "O arquivo excede o tamanho máximo permitido de 5 MB",
      );
    }

    if (params.mimeType !== "application/pdf") {
      throw new BusinessRuleError(
        "Os documentos de RSC e Classe Titular devem ser enviados em arquivo PDF",
      );
    }

    const kind = String(params.kind ?? "")
      .trim()
      .toUpperCase();
    const category = careerProcess.processTypeConfig?.category;
    const file = {
      originalName: params.originalName,
      storedName: params.storedName,
      url: params.webUrl,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
    };

    let updated: any = null;
    if (kind === "RSC_REPORT") {
      if (category !== ProcessTypeCategory.RSC || !careerProcess.rscDetail) {
        throw new BusinessRuleError(
          "Este documento só pode ser anexado a processos de RSC",
        );
      }
      updated = await this.processRepo.attachRscReport(
        params.processId,
        params.userId,
        file,
      );
    } else if (
      kind === "FULL_PROFESSOR_MEMORIAL" ||
      kind === "FULL_PROFESSOR_THESIS"
    ) {
      if (
        category !== ProcessTypeCategory.FULL_PROFESSOR ||
        !careerProcess.fullProfessorDetail
      ) {
        throw new BusinessRuleError(
          "Este documento só pode ser anexado a processos de Classe Titular",
        );
      }
      updated = await this.processRepo.attachFullProfessorDocument(
        params.processId,
        params.userId,
        kind,
        file,
      );
    } else if (kind === "DOCTORATE_DEGREE") {
      if (
        category !== ProcessTypeCategory.FULL_PROFESSOR ||
        !careerProcess.fullProfessorDetail
      ) {
        throw new BusinessRuleError(
          "O diploma de doutorado só pode ser vinculado a processos de Classe Titular",
        );
      }

      const course = String(params.course ?? "").trim();
      const institution = String(params.institution ?? "").trim();
      if (!course || !institution) {
        throw new BusinessRuleError(
          "Curso e instituição do doutorado são obrigatórios",
        );
      }

      const conclusionDate = this.parseRequiredDate(
        params.conclusionDateISO,
        "Data de conclusão do doutorado",
      );
      if (conclusionDate > new Date()) {
        throw new BusinessRuleError(
          "A data de conclusão do doutorado não pode estar no futuro",
        );
      }

      const user = await this.userRepo.findById(params.userId);
      if (!user?.docente) {
        throw new BusinessRuleError("Perfil docente não encontrado");
      }

      updated = await this.processRepo.attachDoctorateDegree({
        processId: params.processId,
        userId: params.userId,
        teacherId: user.docente.idDocente,
        existingDegreeId: careerProcess.fullProfessorDetail.doctorateDegreeId,
        course,
        institution,
        conclusionDate,
        file,
      });
    } else {
      throw new BusinessRuleError("Tipo de documento inválido");
    }

    if (!updated) throw new NotFoundError("Processo não encontrado");
    return this.mapProcessToDto(updated);
  }

  async anexarDocumentoConfigurado(params: {
    processId: number;
    userId: number;
    requirementCode: string;
    originalName: string;
    storedName: string;
    webUrl: string;
    mimeType: string | null;
    sizeBytes: number | null;
  }) {
    const careerProcess = await this.processRepo.findById(params.processId);
    if (
      !careerProcess ||
      careerProcess.deletedDate ||
      careerProcess.userId !== params.userId
    ) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT &&
      careerProcess.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Os documentos só podem ser alterados em processos em rascunho ou devolvidos",
      );
    }

    const requirementCode = String(params.requirementCode ?? "")
      .trim()
      .toUpperCase();
    const requirement =
      careerProcess.processTypeConfig?.documentRequirements?.find(
        (item: any) => item.active && item.code === requirementCode,
      );
    if (!requirement) {
      throw new BusinessRuleError(
        "Este documento não está configurado para o tipo e a versão do processo",
      );
    }

    this.validarArquivoConfigurado(requirement, params);

    const result = await this.processRepo.attachConfiguredDocument({
      processId: params.processId,
      userId: params.userId,
      requirementCode,
      required: requirement.required,
      allowsMultiple: requirement.allowsMultiple,
      file: {
        originalName: params.originalName,
        storedName: params.storedName,
        url: params.webUrl,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
      },
    });

    if (!result.process) throw new NotFoundError("Processo não encontrado");
    return {
      process: this.mapProcessToDto(result.process),
      replacedFileUrl: result.replacedFileUrl,
    };
  }

  async removerDocumentoConfigurado(
    processId: number,
    userId: number,
    documentId: number,
  ) {
    const careerProcess = await this.processRepo.findById(processId);
    if (
      !careerProcess ||
      careerProcess.deletedDate ||
      careerProcess.userId !== userId
    ) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT &&
      careerProcess.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Os documentos só podem ser alterados em processos em rascunho ou devolvidos",
      );
    }

    const result = await this.processRepo.removeConfiguredDocument(
      processId,
      documentId,
    );
    if (!result?.process) throw new NotFoundError("Documento não encontrado");

    return {
      process: this.mapProcessToDto(result.process),
      removedFileUrl: result.removedFileUrl,
    };
  }

  async editarProcesso(
    processId: number,
    userId: number,
    dto: UpdateProcessoDto,
  ) {
    const careerProcess = await this.processRepo.findById(processId);
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (
      careerProcess.status !== ProcessStatus.DRAFT &&
      careerProcess.status !== ProcessStatus.RETURNED
    ) {
      throw new BusinessRuleError(
        "Você só pode editar processos em rascunho ou retornados",
      );
    }

    const category = careerProcess.processTypeConfig?.category;
    if (category === ProcessTypeCategory.RSC) {
      const targetLevel = dto.rscDetails?.targetLevel
        ? this.normalizeProcessTypeCode(dto.rscDetails.targetLevel)
        : (careerProcess.rscDetail?.targetLevel ?? undefined);

      if (targetLevel && !RSC_TARGET_LEVELS.has(targetLevel)) {
        throw new BusinessRuleError("Nível de RSC inválido");
      }
      const periodDetails = {
        careerEntryDateISO:
          dto.rscDetails?.careerEntryDateISO ??
          careerProcess.rscDetail?.careerEntryDate?.toISOString(),
        previousRscGrantedAtISO:
          dto.rscDetails?.previousRscGrantedAtISO !== undefined
            ? dto.rscDetails.previousRscGrantedAtISO
            : (careerProcess.rscDetail?.previousRscGrantedAt?.toISOString() ??
              null),
        activityPeriodStartISO:
          dto.rscDetails?.activityPeriodStartISO ??
          careerProcess.rscDetail?.activityPeriodStart?.toISOString(),
        activityPeriodEndISO:
          dto.rscDetails?.activityPeriodEndISO ??
          careerProcess.rscDetail?.activityPeriodEnd?.toISOString(),
        truthDeclarationAccepted:
          dto.rscDetails?.truthDeclarationAccepted ??
          Boolean(careerProcess.rscDetail?.truthDeclarationAcceptedAt),
      };
      await this.validarElegibilidadeRsc(userId, targetLevel ?? "");
      this.validarPeriodoRsc(periodDetails);

      const updated = await this.processRepo.updateRscProcess(processId, {
        campus: dto.campus,
        cidadeUF: dto.cidadeUF,
        externalNumber:
          dto.externalNumber !== undefined
            ? dto.externalNumber?.trim() || null
            : undefined,
        targetLevel,
        careerEntryDate: periodDetails.careerEntryDateISO
          ? new Date(periodDetails.careerEntryDateISO)
          : undefined,
        previousRscGrantedAt:
          periodDetails.previousRscGrantedAtISO === null
            ? null
            : periodDetails.previousRscGrantedAtISO
              ? new Date(periodDetails.previousRscGrantedAtISO)
              : undefined,
        activityPeriodStart: periodDetails.activityPeriodStartISO
          ? new Date(periodDetails.activityPeriodStartISO)
          : undefined,
        activityPeriodEnd: periodDetails.activityPeriodEndISO
          ? new Date(periodDetails.activityPeriodEndISO)
          : undefined,
        truthDeclarationAccepted:
          periodDetails.truthDeclarationAccepted === true,
      });
      return this.mapProcessToDto(updated);
    }

    if (category === ProcessTypeCategory.FULL_PROFESSOR) {
      if (dto.fullProfessorDetails?.doctorateDegreeId) {
        const degree = await prisma.teacherDegree.findFirst({ where: { idTeacherDegree: dto.fullProfessorDetails.doctorateDegreeId, teacher: { userId }, degreeType: { in: ["DOCTORATE", "DOUTORADO"] } } });
        if (!degree) throw new BusinessRuleError("O diploma deve pertencer ao docente requerente");
      }
      const modeRaw = dto.fullProfessorDetails?.evaluationMode;
      const mode = modeRaw ? String(modeRaw).toUpperCase() : undefined;
      if (
        mode &&
        !Object.values(FullProfessorEvaluationMode).includes(
          mode as FullProfessorEvaluationMode,
        )
      ) {
        throw new BusinessRuleError("Modalidade de avaliação inválida");
      }

      if (dto.fullProfessorDetails?.finalReferenceDateISO) throw new BusinessRuleError("A data de referência final é calculada pelo servidor");
      const finalReferenceDate = undefined;

      const updated = await this.processRepo.updateFullProfessorProcess(
        processId,
        {
          campus: dto.campus,
          cidadeUF: dto.cidadeUF,
          externalNumber:
            dto.externalNumber !== undefined
              ? dto.externalNumber?.trim() || null
              : undefined,
          evaluationMode: mode as FullProfessorEvaluationMode | undefined,
          doctorateDegreeId: dto.fullProfessorDetails?.doctorateDegreeId,
          finalReferenceDate,
        },
      );
      return this.mapProcessToDto(updated);
    }

    if (
      !careerProcess.type ||
      !careerProcess.intersticeStart ||
      !careerProcess.intersticeEnd ||
      !careerProcess.classeOrigem ||
      !careerProcess.nivelOrigem ||
      !careerProcess.classeDestino ||
      !careerProcess.nivelDestino
    ) {
      throw new BusinessRuleError(
        "Processo de carreira possui dados obrigatórios incompletos",
      );
    }

    const newIntersticeStart = dto.intersticioInicioISO
      ? new Date(dto.intersticioInicioISO)
      : careerProcess.intersticeStart;

    const newIntersticeEnd = dto.intersticioFimISO
      ? new Date(dto.intersticioFimISO)
      : careerProcess.intersticeEnd;

    const classeOrigemFinal =
      dto.classeOrigem !== undefined
        ? dto.classeOrigem
        : careerProcess.classeOrigem;
    const nivelOrigemFinal =
      dto.nivelOrigem !== undefined
        ? dto.nivelOrigem
        : careerProcess.nivelOrigem;
    const classeDestinoFinal =
      dto.classeDestino !== undefined
        ? dto.classeDestino
        : careerProcess.classeDestino;
    const nivelDestinoFinal =
      dto.nivelDestino !== undefined
        ? dto.nivelDestino
        : careerProcess.nivelDestino;

    this.validarClasseENivel(classeOrigemFinal, nivelOrigemFinal, "origem");
    this.validarClasseENivel(classeDestinoFinal, nivelDestinoFinal, "destino");

    const origemCodigo =
      `${classeOrigemFinal}${nivelOrigemFinal}`.toUpperCase();
    const destinoCodigo =
      `${classeDestinoFinal}${nivelDestinoFinal}`.toUpperCase();

    this.validarCombinacaoProgressaoOuPromocao(
      careerProcess.type,
      origemCodigo,
      destinoCodigo,
    );

    const requiredMonths = origemCodigo === "A1" && destinoCodigo === "B1" ? 36 : 24;
    const currentUser = await this.userRepo.findById(userId);
    const functionalStart = currentUser?.docente?.start_interstice ?? newIntersticeStart;
    if (dayjs(functionalStart).format("YYYY-MM-DD") !== dayjs(newIntersticeStart).format("YYYY-MM-DD")) throw new BusinessRuleError("O início do interstício deve corresponder ao cadastro funcional");
    if (!careerPreparationAllowed(newIntersticeStart, new Date(), requiredMonths)) throw new BusinessRuleError("A preparação só pode começar nos 60 dias anteriores ao cumprimento do interstício");
    if (new Date(newIntersticeEnd.getTime() + 86400000) < addMonthsClamped(newIntersticeStart, requiredMonths)) throw new BusinessRuleError("O término informado não cumpre o interstício mínimo da movimentação");

    const lastApproved =
      await this.processRepo.findLastApprovedProcessForUser(userId);

    if (lastApproved) {
      const lastEnd = lastApproved.intersticeEnd;

      if (lastEnd && lastApproved.idProcess !== processId) {
        if (newIntersticeStart <= lastEnd) {
          const formattedLastEnd = dayjs(lastEnd).format("DD/MM/YYYY");

          const msg =
            `Já existe um processo APROVADO com interstício até ${formattedLastEnd} ` +
            `(nº ${lastApproved.idProcess}, ${lastApproved.type}). ` +
            "O próximo processo só pode iniciar após essa data";

          throw new BusinessRuleError(msg, {
            lastApprovedProcessId: lastApproved.idProcess,
            lastApprovedType: lastApproved.type,
            lastApprovedIntersticeEnd: lastEnd,
          });
        }
      }
    }

    if (
      dto.intersticioInicioISO !== undefined ||
      dto.intersticioFimISO !== undefined
    ) {
      const existingOverlap = await this.processRepo.findByUserAndInterstice(
        userId,
        newIntersticeStart,
        newIntersticeEnd,
        processId,
      );

      if (existingOverlap) {
        const message =
          `Já existe outro processo com interstício que se sobrepõe a este ` +
          `(nº ${existingOverlap.idProcess}). Ajuste o período ou utilize o processo existente`;

        throw new BusinessRuleError(message, {
          existingProcessId: existingOverlap.idProcess,
        });
      }
    }

    const existingApprovedByInterstice =
      await this.processRepo.findApprovedByInterstice(
        userId,
        newIntersticeStart,
        newIntersticeEnd,
        processId,
      );

    if (existingApprovedByInterstice) {
      const msg =
        `Já existe um processo APROVADO com este interstício ` +
        `(nº ${existingApprovedByInterstice.idProcess}, ${existingApprovedByInterstice.type}). ` +
        "Não é permitido editar este processo para usar o mesmo período";

      throw new BusinessRuleError(msg, {
        existingProcessId: existingApprovedByInterstice.idProcess,
        existingStatus: existingApprovedByInterstice.status,
        existingType: existingApprovedByInterstice.type,
      });
    }

    const existingApprovedByMovement =
      await this.processRepo.findApprovedByMovement(
        userId,
        careerProcess.type,
        classeOrigemFinal,
        nivelOrigemFinal,
        classeDestinoFinal,
        nivelDestinoFinal,
        processId,
      );

    if (existingApprovedByMovement) {
      const msg =
        `Já existe um processo APROVADO com esta movimentação ` +
        `(nº ${existingApprovedByMovement.idProcess}, ${existingApprovedByMovement.type}, ` +
        `${existingApprovedByMovement.classeOrigem}${existingApprovedByMovement.nivelOrigem} → ` +
        `${existingApprovedByMovement.classeDestino}${existingApprovedByMovement.nivelDestino}). ` +
        "Não é permitido editar este processo para duplicar uma movimentação já aprovada";

      throw new BusinessRuleError(msg, {
        existingProcessId: existingApprovedByMovement.idProcess,
        existingStatus: existingApprovedByMovement.status,
        existingType: existingApprovedByMovement.type,
      });
    }

    const updateData: any = {};

    if (dto.campus !== undefined) {
      updateData.campus = dto.campus;
    }
    if (dto.cidadeUF !== undefined) {
      updateData.cidadeUF = dto.cidadeUF;
    }
    if (dto.externalNumber !== undefined) {
      updateData.externalNumber = dto.externalNumber?.trim() || null;
    }
    if (dto.intersticioInicioISO !== undefined) {
      updateData.intersticeStart = newIntersticeStart;
    }
    if (dto.intersticioFimISO !== undefined) {
      updateData.intersticeEnd = newIntersticeEnd;
    }
    if (dto.classeOrigem !== undefined) {
      updateData.classeOrigem = classeOrigemFinal;
    }
    if (dto.nivelOrigem !== undefined) {
      updateData.nivelOrigem = nivelOrigemFinal;
    }
    if (dto.classeDestino !== undefined) {
      updateData.classeDestino = classeDestinoFinal;
    }
    if (dto.nivelDestino !== undefined) {
      updateData.nivelDestino = nivelDestinoFinal;
    }

    if (Object.keys(updateData).length === 0) {
      return this.mapProcessToDto(careerProcess);
    }

    const updated = await this.processRepo.updateProcess(processId, updateData);

    return this.mapProcessToDto(updated);
  }

  async gerarRequerimento(processId: number, userId: number) {
    const careerProcess = await this.processRepo.findById(processId);
    if (!careerProcess || careerProcess.deletedDate) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (careerProcess.userId !== userId) {
      throw new NotFoundError("Processo não encontrado");
    }

    if (!careerProcess.type) {
      throw new BusinessRuleError(
        "O modelo de requerimento para este tipo de processo ainda não está configurado.",
      );
    }

    const processType: ProcessType = careerProcess.type;

    this.validarRegrasDeRequerimento(careerProcess);

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError("Usuário não encontrado");
    }

    const nomeProfessor = user.name;
    const email = user.email;
    const celular = user.phone ?? "";
    const siape = user.docente?.siape ?? "";

    const dataEmissao = dayjs();

    const interIni = dayjs.utc(careerProcess.intersticeStart);
    const interFim = dayjs.utc(careerProcess.intersticeEnd);

    const dataPorExtenso =
      `${careerProcess.cidadeUF}, ${dataEmissao.format("DD")} de ` +
      `${dataEmissao.format("MMMM")} de ${dataEmissao.format("YYYY")}`;

    const intersticioStr = `${interIni.format("DD/MM/YYYY")} a ${interFim.format("DD/MM/YYYY")}`;

    const classeNivelOrigem = `Classe ${careerProcess.classeOrigem} / Nível ${careerProcess.nivelOrigem}`;
    const classeNivelDestino = `Classe ${careerProcess.classeDestino} / Nível ${careerProcess.nivelDestino}`;

    const vars = {
      campus: careerProcess.campus,
      cidade_data: dataPorExtenso,
      nome_professor: nomeProfessor,
      siape,
      email,
      celular,
      classe_nivel_origem: classeNivelOrigem,
      classe_nivel_destino: classeNivelDestino,
      intersticio: intersticioStr,
    };

    const templateFile =
      processType === ProcessType.PROMOCAO
        ? path.join(process.cwd(), "templates", "requerimento_promocao.docx")
        : path.join(process.cwd(), "templates", "requerimento_progressao.docx");

    const docxBuffer = renderDocxFromTemplate(templateFile, vars);
    const pdfBuffer = await convertDocxToPdf(docxBuffer);

    const base =
      processType === ProcessType.PROMOCAO
        ? "Requerimento_Promocao"
        : "Requerimento_Progressao";

    const filename =
      `${base}_${nomeProfessor.replace(/\s+/g, "_")}_` +
      `${dataEmissao.format("YYYYMMDD")}.pdf`;

    return {
      filename,
      pdfBuffer,
    };
  }

  private validarRegrasDeRequerimento(careerProcess: any) {
    if (
      !careerProcess.type ||
      !careerProcess.intersticeStart ||
      !careerProcess.intersticeEnd ||
      !careerProcess.classeOrigem ||
      !careerProcess.nivelOrigem ||
      !careerProcess.classeDestino ||
      !careerProcess.nivelDestino
    ) {
      throw new BusinessRuleError(
        "Processo de carreira possui dados obrigatórios incompletos",
      );
    }

    const processType: ProcessType = careerProcess.type;
    const origemCodigo =
      `${careerProcess.classeOrigem}${careerProcess.nivelOrigem}`.toUpperCase();
    const destinoCodigo =
      `${careerProcess.classeDestino}${careerProcess.nivelDestino}`.toUpperCase();

    const mesesIntersticio = dayjs().diff(
      dayjs.utc(careerProcess.intersticeStart),
      "month",
    );

    this.validarCombinacaoProgressaoOuPromocao(
      processType,
      origemCodigo,
      destinoCodigo,
    );

    if (processType === ProcessType.PROMOCAO) {
      const regrasPromocao = [
        {
          from: "A1",
          to: "B1",
          minMonths: 36,
          descricao:
            "Só é permitida promoção de A1 para B1 com interstício mínimo de 36 meses",
        },
        {
          from: "B4",
          to: "C1",
          minMonths: 24,
          descricao:
            "Só é permitida promoção para C1 após permanecer no mínimo 24 meses em B4",
        },
        {
          from: "C4",
          to: "D1",
          minMonths: 24,
          descricao:
            "Só é permitida promoção para D1 após permanecer no mínimo 24 meses em C4",
        },
      ];

      const regra = regrasPromocao.find(
        (r) => r.from === origemCodigo && r.to === destinoCodigo,
      );

      if (!regra) {
        throw new BusinessRuleError(
          `Combinação de promoção inválida: ${origemCodigo} → ${destinoCodigo}`,
        );
      }

      if (mesesIntersticio < regra.minMonths) {
        throw new BusinessRuleError(
          `${regra.descricao}. Interstício atual: ${mesesIntersticio} meses`,
        );
      }

      return;
    }

    if (processType === ProcessType.PROGRESSAO) {
      const regrasProgressao = [
        {
          from: "B1",
          to: "B2",
          minMonths: 24,
          descricao:
            "Só é permitida progressão para B2 após permanecer no mínimo 24 meses em B1",
        },
        {
          from: "B2",
          to: "B3",
          minMonths: 24,
          descricao:
            "Só é permitida progressão para B3 após permanecer no mínimo 24 meses em B2",
        },
        {
          from: "B3",
          to: "B4",
          minMonths: 24,
          descricao:
            "Só é permitida progressão para B4 após permanecer no mínimo 24 meses em B3",
        },
        {
          from: "C1",
          to: "C2",
          minMonths: 24,
          descricao:
            "Só é permitida progressão para C2 após permanecer no mínimo 24 meses em C1",
        },
        {
          from: "C2",
          to: "C3",
          minMonths: 24,
          descricao:
            "Só é permitida progressão para C3 após permanecer no mínimo 24 meses em C2",
        },
        {
          from: "C3",
          to: "C4",
          minMonths: 24,
          descricao:
            "Só é permitida progressão para C4 após permanecer no mínimo 24 meses em C3",
        },
      ];

      const regra = regrasProgressao.find(
        (r) => r.from === origemCodigo && r.to === destinoCodigo,
      );

      if (!regra) {
        throw new BusinessRuleError(
          `Combinação de progressão inválida: ${origemCodigo} → ${destinoCodigo}`,
        );
      }

      if (mesesIntersticio < regra.minMonths) {
        throw new BusinessRuleError(
          `${regra.descricao}. Interstício atual: ${mesesIntersticio} meses`,
        );
      }

      return;
    }
  }

  private validarCombinacaoProgressaoOuPromocao(
    processType: ProcessType,
    origemCodigo: string,
    destinoCodigo: string,
  ) {
    if (processType === ProcessType.PROGRESSAO) {
      const combinacoesValidas = [
        "B1->B2",
        "B2->B3",
        "B3->B4",
        "C1->C2",
        "C2->C3",
        "C3->C4",
      ];

      const chave = `${origemCodigo}->${destinoCodigo}`;

      if (!combinacoesValidas.includes(chave)) {
        throw new BusinessRuleError(
          `Combinação de progressão inválida: ${origemCodigo} → ${destinoCodigo}`,
        );
      }

      return;
    }

    if (processType === ProcessType.PROMOCAO) {
      if (origemCodigo === "C4" && destinoCodigo === "D1") {
        throw new BusinessRuleError("Utilize o processo próprio de Promoção à Classe Titular")
      }
      const combinacoesValidas = ["A1->B1", "B4->C1"];

      const chave = `${origemCodigo}->${destinoCodigo}`;

      if (!combinacoesValidas.includes(chave)) {
        throw new BusinessRuleError(
          `Combinação de promoção inválida: ${origemCodigo} → ${destinoCodigo}`,
        );
      }

      return;
    }
  }

  private validarClasseENivel(
    classe: string,
    nivel: string,
    contexto: "origem" | "destino",
  ) {
    const codigo = `${classe}${nivel}`.toUpperCase();
    const valoresValidos = Object.values(ClassLevel);

    if (!valoresValidos.includes(codigo as ClassLevel)) {
      throw new BusinessRuleError(
        `Combinação de classe/nível de ${contexto} inválida: ${codigo}`,
      );
    }
  }

  private validarDocumentosConfigurados(careerProcess: any) {
    const requirements =
      careerProcess.processTypeConfig?.documentRequirements?.filter(
        (item: any) => item.active && item.required,
      ) ?? [];
    if (requirements.length === 0) return;

    const attachedCodes = new Set(
      (careerProcess.documents ?? [])
        .filter(
          (document: any) =>
            !document.deletedDate &&
            document.purpose === "PROCESS_REQUIREMENT" &&
            document.evidenceFile &&
            !document.evidenceFile.deletedDate,
        )
        .map((document: any) => document.documentType),
    );
    const missingDocuments = requirements
      .filter((requirement: any) => !attachedCodes.has(requirement.code))
      .map((requirement: any) => ({
        code: requirement.code,
        name: requirement.name,
      }));

    if (missingDocuments.length > 0) {
      throw new BusinessRuleError(
        "Anexe todos os documentos obrigatórios antes do envio",
        { missingDocuments },
      );
    }
  }

  private validarArquivoConfigurado(
    requirement: any,
    file: {
      originalName: string;
      mimeType: string | null;
      sizeBytes: number | null;
    },
  ) {
    const maxSizeMb = requirement.maxSizeMb ?? 100;
    if (file.sizeBytes !== null && file.sizeBytes > maxSizeMb * 1024 * 1024) {
      throw new BusinessRuleError(
        `O arquivo excede o tamanho máximo permitido de ${maxSizeMb} MB`,
      );
    }

    const acceptedFormats = String(requirement.acceptedFormats ?? "")
      .split(/[\s,;]+/)
      .map((value) => this.normalizarFormato(value))
      .filter(Boolean);
    if (acceptedFormats.length === 0) return;

    const extension = path.extname(file.originalName).slice(1);
    const receivedFormats = new Set([
      this.normalizarFormato(extension),
      this.normalizarFormato(file.mimeType ?? ""),
    ]);
    if (!acceptedFormats.some((format) => receivedFormats.has(format))) {
      throw new BusinessRuleError(
        `Formato não permitido. Envie: ${acceptedFormats.join(", ").toUpperCase()}`,
      );
    }
  }

  private normalizarFormato(value: string) {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "");
    const aliases: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      jpeg: "jpg",
      "image/png": "png",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "application/vnd.oasis.opendocument.text": "odt",
      "application/vnd.oasis.opendocument.spreadsheet": "ods",
    };
    return aliases[normalized] ?? normalized;
  }

  private mapProcessToDto(careerProcess: any) {
    const processTypeConfig = careerProcess.processTypeConfig ?? null;

    return {
      processId: careerProcess.idProcess,
      type: careerProcess.type,
      processTypeId:
        careerProcess.processTypeId ?? processTypeConfig?.idProcessType ?? null,
      processTypeCode:
        processTypeConfig?.code ??
        this.inferProcessTypeCode(careerProcess.type),
      processTypeName:
        processTypeConfig?.name ??
        this.inferProcessTypeName(careerProcess.type),
      processTypeCategory: processTypeConfig?.category ?? null,
      processTypeConfig: processTypeConfig
        ? this.mapProcessTypeConfigToDto(processTypeConfig)
        : null,
      status: careerProcess.status,
      financialEffectsAt: careerProcess.financialEffectsAt ?? null,
      scoringTableId: careerProcess.scoringTableId,
      scoringTable: careerProcess.table
        ? {
            idScoringTable: careerProcess.table.idScoringTable,
            name: careerProcess.table.name,
            purpose: careerProcess.table.purpose,
            minRequiredPoints:
              careerProcess.table.minRequiredPoints !== null
                ? String(careerProcess.table.minRequiredPoints)
                : null,
          }
        : null,
      submittedAt: careerProcess.submittedAt ?? null,
      createdAt: careerProcess.createdAt,
      userId: careerProcess.userId,
      campus: careerProcess.campus,
      cidadeUF: careerProcess.cidadeUF,
      externalNumber: careerProcess.externalNumber ?? null,
      intersticeStart: careerProcess.intersticeStart,
      intersticeEnd: careerProcess.intersticeEnd,
      classeOrigem: careerProcess.classeOrigem,
      nivelOrigem: careerProcess.nivelOrigem,
      classeDestino: careerProcess.classeDestino,
      nivelDestino: careerProcess.nivelDestino,
      progressionDetails: careerProcess.progressionDetail ?? null,
      rscDetails: careerProcess.rscDetail
        ? {
            targetLevel: careerProcess.rscDetail.targetLevel,
            careerEntryDate: careerProcess.rscDetail.careerEntryDate,
            previousRscGrantedAt:
              careerProcess.rscDetail.previousRscGrantedAt,
            activityPeriodStart:
              careerProcess.rscDetail.activityPeriodStart,
            activityPeriodEnd: careerProcess.rscDetail.activityPeriodEnd,
            truthDeclarationAcceptedAt:
              careerProcess.rscDetail.truthDeclarationAcceptedAt,
            finalResult: careerProcess.rscDetail.finalResult,
            reportFile: this.mapEvidenceFileToDto(
              careerProcess.rscDetail.reportFile,
            ),
            generatedSpreadsheetFile: this.mapEvidenceFileToDto(
              careerProcess.rscDetail.generatedSpreadsheetFile,
            ),
          }
        : null,
      configuredDocuments: (careerProcess.documents ?? []).map(
        (document: any) => ({
          idDocumentProcess: document.idDocumentProcess,
          documentType: document.documentType,
          nature: document.nature,
          checked: document.checked,
          receivedAt: document.receivedAt,
          file: this.mapEvidenceFileToDto(document.evidenceFile),
        }),
      ),
      fullProfessorDetails: careerProcess.fullProfessorDetail
        ? {
            evaluationMode: careerProcess.fullProfessorDetail.evaluationMode,
            finalReferenceDate:
              careerProcess.fullProfessorDetail.finalReferenceDate,
            memorialFile: this.mapEvidenceFileToDto(
              careerProcess.fullProfessorDetail.memorialFile,
            ),
            thesisFile: this.mapEvidenceFileToDto(
              careerProcess.fullProfessorDetail.thesisFile,
            ),
            doctorateDegree: careerProcess.fullProfessorDetail.doctorateDegree
              ? {
                  idTeacherDegree:
                    careerProcess.fullProfessorDetail.doctorateDegree
                      .idTeacherDegree,
                  degreeType:
                    careerProcess.fullProfessorDetail.doctorateDegree
                      .degreeType,
                  course:
                    careerProcess.fullProfessorDetail.doctorateDegree.course,
                  institution:
                    careerProcess.fullProfessorDetail.doctorateDegree
                      .institution,
                  conclusionDate:
                    careerProcess.fullProfessorDetail.doctorateDegree
                      .conclusionDate,
                  evidenceFile: this.mapEvidenceFileToDto(
                    careerProcess.fullProfessorDetail.doctorateDegree
                      .evidenceFile,
                  ),
                }
              : null,
          }
        : null,
    };
  }

  private mapEvidenceFileToDto(file: any) {
    if (!file) return null;
    return {
      idEvidenceFile: file.idEvidenceFile,
      usageType: file.usageType,
      originalName: file.originalName,
      url: file.url,
      mimeType: file.mimeType,
      sizeBytes:
        file.sizeBytes !== null && file.sizeBytes !== undefined
          ? Number(file.sizeBytes)
          : null,
      uploadedAt: file.uploadedAt,
    };
  }

  private mapProcessTypeConfigToDto(
    config: ProcessTypeConfig & { documentRequirements?: any[] },
  ) {
    return {
      idProcessType: config.idProcessType,
      code: config.code,
      name: config.name,
      category: config.category,
      requiresScoring: config.requiresScoring,
      requiresCommittee: config.requiresCommittee,
      defaultDestination: config.defaultDestination,
      version: config.version,
      validFrom: config.validFrom,
      validUntil: config.validUntil,
      opinionTemplateId: config.opinionTemplateId,
      active: config.active,
      documentRequirements: (config.documentRequirements ?? []).map(
        (requirement) => ({
          idDocumentRequirement: requirement.idDocumentRequirement,
          code: requirement.code,
          name: requirement.name,
          description: requirement.description,
          required: requirement.required,
          allowsMultiple: requirement.allowsMultiple,
          acceptedFormats: requirement.acceptedFormats,
          maxSizeMb: requirement.maxSizeMb,
          sortOrder: requirement.sortOrder,
        }),
      ),
    };
  }

  private inferProcessTypeCode(type: ProcessType | null): string {
    if (!type) return "OTHER";
    return type === ProcessType.PROMOCAO ? "PROMOTION" : "PROGRESSION";
  }

  private inferProcessTypeName(type: ProcessType | null): string {
    if (!type) return "Outro";
    return type === ProcessType.PROMOCAO ? "Promoção" : "Progressão";
  }

  private async calcularPontuacaoProcesso(
    processId: number,
  ): Promise<{ total: number; byRscLevel: Record<string, number> }> {
    const blocks =
      await this.scoreRepo.findBlocksWithScoresByProcess(processId);

    if (!blocks || blocks.length === 0) {
      return { total: 0, byRscLevel: {} };
    }

    type TreeNode = {
      nodeId: number;
      code: string | null;
      name: string;
      parentId: number | null;
      sortOrder: number;
      hasFormula: boolean;
      formulaExpression: string | null;
      maxPoints: number | null;
      items: Array<{
        itemId: number;
        points: number;
        hasMaxPoints: boolean;
        maxPoints: number | null;
        formulaKey: string | null;
        currentScore: {
          quantity: number;
          awardedPoints: number;
        } | null;
      }>;
      children: TreeNode[];
    };

    const map = new Map<number, TreeNode>();
    blocks.forEach((b) => {
      map.set(b.nodeId, {
        nodeId: b.nodeId,
        code: b.code ?? null,
        name: b.name,
        parentId: b.parentId ?? null,
        sortOrder: b.sortOrder,
        hasFormula: b.hasFormula,
        formulaExpression: b.formulaExpression ?? null,
        maxPoints: b.maxPoints ?? null,
        items: b.items,
        children: [],
      });
    });

    const roots: TreeNode[] = [];

    map.forEach((node) => {
      if (node.parentId === null || node.parentId === undefined) {
        roots.push(node);
      } else {
        const parent = map.get(node.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    const sortTree = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      nodes.forEach((n) => sortTree(n.children));
    };

    sortTree(roots);

    function computeNodeTotal(node: TreeNode): number {
      const baseSum = node.items.reduce((acc, item) => {
        const pts = item.currentScore
          ? Number(item.currentScore.awardedPoints)
          : 0;
        return acc + (Number.isNaN(pts) ? 0 : pts);
      }, 0);

      let selfTotal = baseSum;

      if (node.hasFormula && node.formulaExpression) {
        const vars: Record<string, number> = {};

        node.items.forEach((item) => {
          if (!item.formulaKey) return;

          const val = item.currentScore
            ? Number(item.currentScore.quantity)
            : 0;
          vars[item.formulaKey] = Number.isNaN(val) ? 0 : val;
        });

        try {
          const argNames = Object.keys(vars);
          const argValues = Object.values(vars);

          if (argNames.length > 0) {
            const fn = new Function(
              ...argNames,
              `return ${node.formulaExpression};`,
            ) as (...args: number[]) => number;

            const result = fn(...argValues);
            const num = Number(result);

            selfTotal = Number.isFinite(num) ? num : baseSum;
          } else {
            selfTotal = baseSum;
          }
        } catch (e) {
          console.error("Erro ao avaliar a fórmula do bloco", node.nodeId, e);
          selfTotal = baseSum;
        }
      }

      const childrenSum = node.children.reduce(
        (acc, child) => acc + computeNodeTotal(child),
        0,
      );

      return capScore(selfTotal + childrenSum, node.maxPoints);
    }

    const byRscLevel: Record<string, number> = {};
    let total = 0;

    roots.forEach((node) => {
      const nodeTotal = computeNodeTotal(node);
      total += nodeTotal;

      const level = this.identifyRscLevel(node.code, node.name);
      if (level) byRscLevel[level] = (byRscLevel[level] ?? 0) + nodeTotal;
    });

    return { total, byRscLevel };
  }

  private identifyRscLevel(code: string | null, name: string): string | null {
    const normalized = `${code ?? ""} ${name}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_");

    if (/(^|_)RSC_?III($|_)/.test(normalized)) return "RSC_III";
    if (/(^|_)RSC_?II($|_)/.test(normalized)) return "RSC_II";
    if (/(^|_)RSC_?I($|_)/.test(normalized)) return "RSC_I";
    return null;
  }

  public async listarProcessosCppd(
    view: "pending" | "evaluated",
    campusIds: number[] | null = null,
  ) {
    const pending: ProcessStatus[] = [
      ProcessStatus.DOCUMENTATION_PENDING,
      ProcessStatus.SUBMITTED,
      ProcessStatus.AWAITING_EVALUATOR_ACCEPTANCE,
      ProcessStatus.AWAITING_ORDINANCE,
      ProcessStatus.UNDER_REVIEW,
      ProcessStatus.IN_EVALUATION,
    ];
    const evaluated: ProcessStatus[] = [
      ProcessStatus.APPROVED,
      ProcessStatus.REJECTED,
      ProcessStatus.RETURNED,
    ];

    const statuses = view === "evaluated" ? evaluated : pending;
    return this.processRepo.listarParaCppdPorStatus(statuses, campusIds);
  }

  public async obterProcessoCppd(processId: number) {
    const p = await this.processRepo.obterParaCppdPorId(processId);
    if (!p) throw new NotFoundError("Processo não encontrado");
    return p;
  }

  public async obterDetalhesAvaliacaoCppd(processId: number) {
    const p = await this.processRepo.obterParaCppdPorId(processId);
    if (!p) throw new NotFoundError("Processo não encontrado");

    const evaluatorUserIds = Array.isArray(p.evaluatorUserIds)
      ? (p.evaluatorUserIds as any[])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [];

    const evaluatorUsers = evaluatorUserIds.length
      ? await this.userRepo.findSummariesByIds(evaluatorUserIds)
      : [];

    const history = Array.isArray(p.ProcessStatusHistory)
      ? p.ProcessStatusHistory
      : [];

    const finalEvent = [...history]
      .reverse()
      .find(
        (h) =>
          h.toStatus === "APPROVED" ||
          h.toStatus === "REJECTED" ||
          h.toStatus === "RETURNED",
      );

    return {
      process: {
        idProcess: p.idProcess,
        status: p.status,
        type: p.type,
        processTypeId: p.processTypeId,
        processTypeCode:
          p.processTypeConfig?.code ?? this.inferProcessTypeCode(p.type),
        processTypeName:
          p.processTypeConfig?.name ?? this.inferProcessTypeName(p.type),
        processTypeConfig: p.processTypeConfig
          ? this.mapProcessTypeConfigToDto(p.processTypeConfig)
          : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        finalPoints: p.finalPoints,
        evaluationOpinion: p.evaluationOpinion,
        evaluatorUserIds: p.evaluatorUserIds,
        user: p.user,
        table: p.table,
      },
      evaluatorUsers,
      finalization: finalEvent
        ? {
            toStatus: finalEvent.toStatus,
            createdAt: finalEvent.createdAt,
            note: finalEvent.note ?? null,
            changedBy: finalEvent.changedBy
              ? {
                  idUser: finalEvent.changedBy.idUser,
                  name: finalEvent.changedBy.name,
                }
              : null,
          }
        : null,
    };
  }
}
