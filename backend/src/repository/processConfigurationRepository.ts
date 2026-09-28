import { Prisma } from "@prisma/client";
import { prisma } from "../infra/prismaClient";

const processTypeInclude = {
  documentRequirements: {
    where: { deletedDate: null },
    orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
  },
} satisfies Prisma.ProcessTypeConfigInclude;

export class ProcessConfigurationRepository {
  listProcessTypes() {
    return prisma.processTypeConfig.findMany({
      where: { deletedDate: null },
      include: processTypeInclude,
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });
  }

  findById(processTypeId: number) {
    return prisma.processTypeConfig.findFirst({
      where: { idProcessType: processTypeId, deletedDate: null },
      include: processTypeInclude,
    });
  }

  findLatestByCode(code: string) {
    return prisma.processTypeConfig.findFirst({
      where: { code, deletedDate: null },
      include: processTypeInclude,
      orderBy: { version: "desc" },
    });
  }

  createProcessType(data: Prisma.ProcessTypeConfigCreateInput) {
    return prisma.processTypeConfig.create({
      data,
      include: processTypeInclude,
    });
  }

  async createVersion(args: {
    code: string;
    previousVersion: number;
    validFrom: Date;
    data: Omit<Prisma.ProcessTypeConfigCreateInput, "code" | "version">;
  }) {
    const previousValidUntil = new Date(args.validFrom.getTime() - 1);
    return prisma.$transaction(async (transaction) => {
      await transaction.processTypeConfig.updateMany({
        where: {
          code: args.code,
          active: true,
          deletedDate: null,
          validFrom: { lt: args.validFrom },
          OR: [{ validUntil: null }, { validUntil: { gte: args.validFrom } }],
        },
        data: { validUntil: previousValidUntil },
      });

      return transaction.processTypeConfig.create({
        data: {
          ...args.data,
          code: args.code,
          version: args.previousVersion + 1,
          validFrom: args.validFrom,
        },
        include: processTypeInclude,
      });
    });
  }

  updateActive(processTypeId: number, active: boolean) {
    return prisma.processTypeConfig.update({
      where: { idProcessType: processTypeId },
      data: { active },
      include: processTypeInclude,
    });
  }
}
