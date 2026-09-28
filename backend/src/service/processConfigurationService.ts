import { Prisma } from "@prisma/client";
import { ProcessConfigurationError } from "../exception/process-configuration-error";
import { ProcessConfigurationRepository } from "../repository/processConfigurationRepository";
import {
  ProcessDocumentRequirementInput,
  SaveProcessTypeVersionDto,
} from "../type/dto/processConfigurationDto";

export class ProcessConfigurationService {
  constructor(
    private readonly repository = new ProcessConfigurationRepository(),
  ) {}

  listProcessTypes() {
    return this.repository.listProcessTypes();
  }

  async createProcessType(dto: SaveProcessTypeVersionDto) {
    const code = this.normalizeCode(dto.code);
    if (await this.repository.findLatestByCode(code)) {
      throw new ProcessConfigurationError(
        "Já existe um tipo de processo com este código",
        "CONFLICT",
      );
    }

    const validFrom = dto.validFrom ?? new Date();
    this.validateDates(validFrom, dto.validUntil);

    return this.repository.createProcessType({
      code,
      version: 1,
      name: dto.name.trim(),
      category: dto.category,
      requiresScoring: dto.requiresScoring ?? false,
      requiresCommittee: dto.requiresCommittee ?? false,
      requiresGecc: dto.requiresGecc ?? false,
      defaultDestination: dto.defaultDestination?.trim() || null,
      validFrom,
      validUntil: dto.validUntil ?? null,
      active: dto.active ?? true,
      documentRequirements: this.nestedRequirements(dto.requirements ?? []),
    });
  }

  async createVersion(processTypeId: number, dto: SaveProcessTypeVersionDto) {
    const source = await this.requireProcessType(processTypeId);
    const latest = await this.repository.findLatestByCode(source.code);
    if (!latest || latest.idProcessType !== source.idProcessType) {
      throw new ProcessConfigurationError(
        "Já existe uma versão mais recente. Atualize a página antes de continuar",
        "CONFLICT",
      );
    }

    const validFrom = dto.validFrom ?? new Date();
    this.validateDates(validFrom, dto.validUntil);
    if (validFrom <= source.validFrom) {
      throw new ProcessConfigurationError(
        "O início da nova versão deve ser posterior ao início da versão atual",
      );
    }
    const requirements =
      dto.requirements ??
      source.documentRequirements.map((item) => ({
        code: item.code,
        name: item.name,
        description: item.description,
        required: item.required,
        allowsMultiple: item.allowsMultiple,
        acceptedFormats: item.acceptedFormats,
        maxSizeMb: item.maxSizeMb,
        sortOrder: item.sortOrder,
        active: item.active,
      }));

    return this.repository.createVersion({
      code: source.code,
      previousVersion: source.version,
      validFrom,
      data: {
        name: dto.name.trim(),
        category: dto.category,
        requiresScoring: dto.requiresScoring ?? source.requiresScoring,
        requiresCommittee: dto.requiresCommittee ?? source.requiresCommittee,
        requiresGecc: dto.requiresGecc ?? source.requiresGecc,
        defaultDestination:
          dto.defaultDestination !== undefined
            ? dto.defaultDestination?.trim() || null
            : source.defaultDestination,
        validUntil: dto.validUntil ?? null,
        active: dto.active ?? true,
        documentRequirements: this.nestedRequirements(requirements),
      },
    });
  }

  async updateStatus(processTypeId: number, active: boolean) {
    const current = await this.requireProcessType(processTypeId);
    if (active) {
      const latest = await this.repository.findLatestByCode(current.code);
      if (!latest || latest.idProcessType !== current.idProcessType) {
        throw new ProcessConfigurationError(
          "Somente a versão mais recente pode ser reativada",
        );
      }
    }
    return this.repository.updateActive(processTypeId, active);
  }

  private async requireProcessType(processTypeId: number) {
    const processType = await this.repository.findById(processTypeId);
    if (!processType) {
      throw new ProcessConfigurationError(
        "Tipo de processo não encontrado",
        "NOT_FOUND",
      );
    }
    return processType;
  }

  private normalizeCode(value?: string) {
    const code = String(value ?? "")
      .trim()
      .toUpperCase();
    if (!code)
      throw new ProcessConfigurationError(
        "Código do tipo de processo é obrigatório",
      );
    return code;
  }

  private validateDates(validFrom: Date, validUntil?: Date | null) {
    if (validUntil && validUntil < validFrom) {
      throw new ProcessConfigurationError(
        "O fim da vigência não pode ser anterior ao início",
      );
    }
  }

  private nestedRequirements(requirements: ProcessDocumentRequirementInput[]) {
    if (!requirements.length) return undefined;
    return {
      create: requirements.map((item, index) =>
        this.mapRequirement(item, index),
      ),
    } satisfies Prisma.ProcessTypeDocumentRequirementCreateNestedManyWithoutProcessTypeInput;
  }

  private mapRequirement(item: ProcessDocumentRequirementInput, index: number) {
    return {
      code: item.code.trim().toUpperCase(),
      name: item.name.trim(),
      description: item.description?.trim() || null,
      required: item.required ?? true,
      allowsMultiple: item.allowsMultiple ?? false,
      acceptedFormats: item.acceptedFormats?.trim().toLowerCase() || null,
      maxSizeMb: item.maxSizeMb ?? null,
      sortOrder: item.sortOrder ?? index,
      active: item.active ?? true,
    };
  }
}
