import { prisma } from "../infra/prismaClient"

export class PasswordResetRepository {
  async invalidateActiveCodes(userId: number, usedAt: Date) {
    return prisma.passwordResetCode.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: usedAt } },
      data: { usedAt }
    })
  }

  async createCode(userId: number, codeHash: string, expiresAt: Date) {
    return prisma.passwordResetCode.create({ data: { userId, codeHash, expiresAt } })
  }

  async findUserByCpf(cpf: string) {
    return prisma.user.findUnique({
      where: { cpf },
      select: { idUser: true, email: true, name: true, deletedDate: true, active: true, cpf: true }
    })
  }

  async findLatestActiveCode(userId: number, now: Date) {
    return prisma.passwordResetCode.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" }
    })
  }

  async updatePasswordAndUseCode(userId: number, passwordHash: string, codeId: number, usedAt: Date) {
    return prisma.$transaction([
      prisma.user.update({ where: { idUser: userId }, data: { passwordHash } }),
      prisma.passwordResetCode.update({
        where: { idPasswordResetCode: codeId },
        data: { usedAt }
      })
    ])
  }
}
