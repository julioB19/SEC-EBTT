import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ProcessTypeCategory } from "@prisma/client";
import { ProcessConfigurationRepository } from "../../../src/repository/processConfigurationRepository";
import { ProcessConfigurationService } from "../../../src/service/processConfigurationService";

describe("ProcessConfigurationService", () => {
  let repository: jest.Mocked<ProcessConfigurationRepository>;
  let service: ProcessConfigurationService;

  const current = {
    idProcessType: 10,
    code: "TRAINING_LEAVE",
    name: "Licença para capacitação",
    category: ProcessTypeCategory.SIMPLE,
    version: 2,
    requiresScoring: false,
    requiresCommittee: false,
    requiresGecc: false,
    active: true,
    validFrom: new Date("2026-01-01"),
    validUntil: null,
    documentRequirements: [
      {
        code: "REQUEST_FORM",
        name: "Requerimento",
        description: null,
        required: true,
        allowsMultiple: false,
        acceptedFormats: "pdf",
        maxSizeMb: 10,
        sortOrder: 0,
        active: true,
      },
    ],
  };

  beforeEach(() => {
    repository = {
      listProcessTypes: jest.fn(),
      findById: jest.fn(),
      findLatestByCode: jest.fn(),
      createProcessType: jest.fn(),
      createVersion: jest.fn(),
      updateActive: jest.fn(),
    } as any;
    service = new ProcessConfigurationService(repository);
  });

  test("creates the first version with normalized requirements", async () => {
    repository.findLatestByCode.mockResolvedValue(null);

    await service.createProcessType({
      code: " training_leave ",
      name: " Licença para capacitação ",
      category: ProcessTypeCategory.SIMPLE,
      requirements: [
        {
          code: " request_form ",
          name: " Requerimento ",
          acceptedFormats: " PDF ",
          maxSizeMb: 10,
        },
      ],
    });

    expect(repository.createProcessType).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "TRAINING_LEAVE",
        version: 1,
        name: "Licença para capacitação",
        documentRequirements: {
          create: [
            expect.objectContaining({
              code: "REQUEST_FORM",
              name: "Requerimento",
              acceptedFormats: "pdf",
              required: true,
            }),
          ],
        },
      }),
    );
  });

  test("does not allow duplicate process type codes", async () => {
    repository.findLatestByCode.mockResolvedValue(current as any);

    await expect(
      service.createProcessType({
        code: "TRAINING_LEAVE",
        name: "Outro nome",
        category: ProcessTypeCategory.SIMPLE,
      }),
    ).rejects.toThrow("Já existe um tipo de processo");
  });

  test("creates a new version and copies requirements when omitted", async () => {
    repository.findById.mockResolvedValue(current as any);
    repository.findLatestByCode.mockResolvedValue(current as any);
    const validFrom = new Date("2027-01-01");

    await service.createVersion(current.idProcessType, {
      name: "Licença para capacitação atualizada",
      category: ProcessTypeCategory.SIMPLE,
      validFrom,
    });

    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "TRAINING_LEAVE",
        previousVersion: 2,
        validFrom,
        data: expect.objectContaining({
          documentRequirements: {
            create: [expect.objectContaining({ code: "REQUEST_FORM" })],
          },
        }),
      }),
    );
  });

  test("rejects a version that overlaps the current version start", async () => {
    repository.findById.mockResolvedValue(current as any);
    repository.findLatestByCode.mockResolvedValue(current as any);

    await expect(
      service.createVersion(current.idProcessType, {
        name: current.name,
        category: current.category,
        validFrom: new Date("2025-12-31"),
      }),
    ).rejects.toThrow("posterior ao início da versão atual");
  });

  test("rejects a version with an inverted validity range", async () => {
    repository.findById.mockResolvedValue(current as any);
    repository.findLatestByCode.mockResolvedValue(current as any);

    await expect(
      service.createVersion(current.idProcessType, {
        name: current.name,
        category: current.category,
        validFrom: new Date("2027-12-01"),
        validUntil: new Date("2027-01-01"),
      }),
    ).rejects.toThrow("fim da vigência");
  });

  test("only reactivates the latest version", async () => {
    repository.findById.mockResolvedValue({
      ...current,
      idProcessType: 9,
      version: 1,
    } as any);
    repository.findLatestByCode.mockResolvedValue(current as any);

    await expect(service.updateStatus(9, true)).rejects.toThrow(
      "versão mais recente",
    );
    expect(repository.updateActive).not.toHaveBeenCalled();
  });
});
