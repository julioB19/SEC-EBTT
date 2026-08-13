import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { PasswordResetController } from "../../../src/controller/passwordResetController"
import { PasswordResetService } from "../../../src/service/passwordResetService"

function responseMock() {
  const res: any = { status: jest.fn(), json: jest.fn() }
  res.status.mockReturnValue(res)
  return res
}

describe("PasswordResetController", () => {
  let service: jest.Mocked<PasswordResetService>
  let controller: PasswordResetController

  beforeEach(() => {
    service = { requestReset: jest.fn(), inviteFirstAccessByCpf: jest.fn(), confirmReset: jest.fn() } as any
    controller = new PasswordResetController(service)
  })

  test("request mantém resposta neutra por segurança", async () => {
    const res = responseMock()
    await controller.request({ body: { cpf: "123" } }, res)
    expect(service.requestReset).toHaveBeenCalledWith("123")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "SUCCESS", data: null }))
  })

  test("request converte falha inesperada em 500", async () => {
    service.requestReset.mockRejectedValue(new Error("smtp"))
    const res = responseMock()
    await controller.request({ body: { cpf: "123" } }, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  test("invite e confirm retornam 400 com mensagem do service", async () => {
    service.inviteFirstAccessByCpf.mockRejectedValue(new Error("inativo"))
    let res = responseMock()
    await controller.invite({ body: { cpf: "1" } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "inativo" }))

    service.confirmReset.mockRejectedValue(new Error("código inválido"))
    res = responseMock()
    await controller.confirm({ body: { cpf: "1", code: "2", newPassword: "3" } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
