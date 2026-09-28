import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { PasswordResetRepository } from "../../../src/repository/passwordResetRepository"
import { prisma } from "../../../src/infra/prismaClient"

jest.mock("../../../src/infra/prismaClient", () => ({
  prisma: {
    passwordResetCode: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn()
  }
}))

describe("PasswordResetRepository", () => {
  const repository = new PasswordResetRepository()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("invalida somente códigos ativos e futuros", async () => {
    const now = new Date()
    await repository.invalidateActiveCodes(3, now)
    expect(prisma.passwordResetCode.updateMany).toHaveBeenCalledWith({
      where: { userId: 3, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now }
    })
  })

  test("busca usuário por CPF com seleção necessária", async () => {
    await repository.findUserByCpf("123")
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ cpfHash: expect.any(String) }, { cpf: "123" }]
        },
        select: expect.objectContaining({
          idUser: true,
          email: true,
          cpf: true,
          cpfEncrypted: true
        })
      })
    )
  })

  test("busca usuário pelo e-mail do convite", async () => {
    await repository.findUserByEmail("avaliador@if.edu.br")
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "avaliador@if.edu.br" },
        select: expect.objectContaining({
          idUser: true,
          email: true,
          cpf: true,
          cpfEncrypted: true
        })
      })
    )
  })

  test("busca último código válido", async () => {
    const now = new Date()
    await repository.findLatestActiveCode(4, now)
    expect(prisma.passwordResetCode.findFirst).toHaveBeenCalledWith({
      where: { userId: 4, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" }
    })
  })

  test("senha e consumo do código usam mesma transação", async () => {
    ;(prisma.user.update as jest.Mock).mockReturnValue("update-user" as never)
    ;(prisma.passwordResetCode.update as jest.Mock).mockReturnValue("update-code" as never)
    const now = new Date()
    await repository.updatePasswordAndUseCode(1, "hash", 2, now)
    expect(prisma.$transaction).toHaveBeenCalledWith(["update-user", "update-code"])
  })

  test("aceite do convite grava CPF, senha e consumo do código atomicamente", async () => {
    ;(prisma.user.update as jest.Mock).mockReturnValue("update-user" as never)
    ;(prisma.passwordResetCode.update as jest.Mock).mockReturnValue("update-code" as never)
    const now = new Date()

    await repository.updateCredentialsAndUseCode(1, "12345678901", "hash", 2, now)

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idUser: 1 },
        data: expect.objectContaining({
          cpf: null,
          cpfEncrypted: expect.stringMatching(/^v1\./),
          cpfHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          passwordHash: "hash",
          person: {
            update: expect.objectContaining({
              cpfEncrypted: expect.stringMatching(/^v1\./),
              cpfHash: expect.stringMatching(/^[a-f0-9]{64}$/)
            })
          }
        })
      })
    )
    expect(prisma.$transaction).toHaveBeenCalledWith(["update-user", "update-code"])
  })
})
