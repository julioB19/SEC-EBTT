import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import bcrypt from "bcryptjs"
import { PasswordResetService } from "../../../src/service/passwordResetService"
import { PasswordResetRepository } from "../../../src/repository/passwordResetRepository"
import { sendMail } from "../../../src/util/mailer"

jest.mock("bcryptjs", () => ({ hash: jest.fn(), compare: jest.fn() }))
jest.mock("../../../src/util/mailer", () => ({ sendMail: jest.fn() }))

describe("PasswordResetService", () => {
  let repository: jest.Mocked<PasswordResetRepository>
  let service: PasswordResetService
  const activeUser = {
    idUser: 7, email: "docente@if.edu.br", name: "Docente", cpf: "12345678901",
    active: true, deletedDate: null
  }

  beforeEach(() => {
    repository = {
      invalidateActiveCodes: jest.fn(), createCode: jest.fn(), findUserByCpf: jest.fn(),
      findLatestActiveCode: jest.fn(), updatePasswordAndUseCode: jest.fn()
    } as any
    service = new PasswordResetService(repository)
    ;(bcrypt.hash as any).mockResolvedValue("hash")
    ;(bcrypt.compare as any).mockResolvedValue(true)
    ;(sendMail as any).mockResolvedValue(undefined)
    process.env.PASSWORD_RESET_CODE_LENGTH = "6"
    process.env.PASSWORD_RESET_CODE_TTL_MINUTES = "15"
    process.env.APP_URL = "https://sistema.test/"
  })

  test("reset inexistente não revela usuário nem envia e-mail", async () => {
    repository.findUserByCpf.mockResolvedValue(null)
    await expect(service.requestReset("123.456.789-01")).resolves.toBeUndefined()
    expect(repository.findUserByCpf).toHaveBeenCalledWith("12345678901")
    expect(repository.createCode).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  test("gera código, invalida anteriores e envia reset", async () => {
    repository.findUserByCpf.mockResolvedValue(activeUser as any)
    await service.requestReset(activeUser.cpf)
    expect(repository.invalidateActiveCodes).toHaveBeenCalledWith(activeUser.idUser, expect.any(Date))
    expect(repository.createCode).toHaveBeenCalledWith(activeUser.idUser, "hash", expect.any(Date))
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: activeUser.email,
      subject: expect.stringContaining("senha")
    }))
  })

  test("convite rejeita usuário ausente ou inativo", async () => {
    repository.findUserByCpf.mockResolvedValue(null)
    await expect(service.inviteFirstAccessByCpf("1")).rejects.toThrow("Usuário não encontrado")
    repository.findUserByCpf.mockResolvedValue({ ...activeUser, active: false } as any)
    await expect(service.inviteFirstAccessByCpf("1")).rejects.toThrow("Usuário inativo")
  })

  test("convite inclui link com CPF e código", async () => {
    repository.findUserByCpf.mockResolvedValue(activeUser as any)
    await service.inviteFirstAccessByCpf(activeUser.cpf)
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: activeUser.email,
      html: expect.stringContaining("https://sistema.test/reset-password?cpf=")
    }))
  })

  test("confirma código válido e atualiza senha atomicamente", async () => {
    repository.findUserByCpf.mockResolvedValue(activeUser as any)
    repository.findLatestActiveCode.mockResolvedValue({
      idPasswordResetCode: 9, codeHash: "code-hash"
    } as any)
    ;(bcrypt.hash as any).mockResolvedValue("password-hash")
    await service.confirmReset(activeUser.cpf, "123456", "NovaSenha")
    expect(bcrypt.compare).toHaveBeenCalledWith("123456", "code-hash")
    expect(repository.updatePasswordAndUseCode).toHaveBeenCalledWith(
      activeUser.idUser, "password-hash", 9, expect.any(Date)
    )
  })

  test.each([
    ["usuário inválido", null, null, true],
    ["código ausente", activeUser, null, true],
    ["código incorreto", activeUser, { idPasswordResetCode: 9, codeHash: "x" }, false]
  ])("rejeita %s", async (_label, user, record, comparison) => {
    repository.findUserByCpf.mockResolvedValue(user as any)
    repository.findLatestActiveCode.mockResolvedValue(record as any)
    ;(bcrypt.compare as any).mockResolvedValue(comparison)
    await expect(service.confirmReset("1", "000", "senha")).rejects.toThrow("Código inválido ou expirado")
    expect(repository.updatePasswordAndUseCode).not.toHaveBeenCalled()
  })
})
