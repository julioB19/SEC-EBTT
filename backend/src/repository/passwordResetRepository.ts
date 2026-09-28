import { prisma } from "../infra/prismaClient"
import { hashCpf, protectCpf, readProtectedCpf } from "../util/cpfProtection"

export class PasswordResetRepository {
  async invalidateActiveCodes(userId: number, usedAt: Date) {
    return prisma.passwordResetCode.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: usedAt } },
      data: { usedAt }
    })
  }

  async createCode(userId: number, codeHash: string, expiresAt: Date) {
    return prisma.passwordResetCode.create({
      data: { userId, codeHash, expiresAt }
    })
  }

  async findUserByCpf(cpf: string) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ cpfHash: hashCpf(cpf) }, { cpf }] },
      select: {
        idUser: true,
        email: true,
        name: true,
        deletedDate: true,
        active: true,
        cpf: true,
        cpfEncrypted: true
      }
    })
    return user ? { ...user, cpf: readProtectedCpf(user) } : null
  }

  async findUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        idUser: true,
        email: true,
        name: true,
        deletedDate: true,
        active: true,
        cpf: true,
        cpfEncrypted: true
      }
    })
    return user ? { ...user, cpf: readProtectedCpf(user) } : null
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

  async updateCredentialsAndUseCode(userId: number, cpf: string, passwordHash: string, codeId: number, usedAt: Date) {
    const protectedCpf = protectCpf(cpf)
    return prisma.$transaction([
      prisma.user.update({
        where: { idUser: userId },
        data: {
          cpf: null,
          cpfEncrypted: protectedCpf.cpfEncrypted,
          cpfHash: protectedCpf.cpfHash,
          passwordHash,
          person: {
            update: {
              cpfEncrypted: protectedCpf.cpfEncrypted,
              cpfHash: protectedCpf.cpfHash
            }
          }
        }
      }),
      prisma.passwordResetCode.update({
        where: { idPasswordResetCode: codeId },
        data: { usedAt }
      })
    ])
  }
}
