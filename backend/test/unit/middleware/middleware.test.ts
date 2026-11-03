import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { prisma } from "../../../src/infra/prismaClient"
import { RoleName } from "@prisma/client"
import jwt from "jsonwebtoken"
import Joi from "joi"
import { authMiddleware } from "../../../src/middleware/authMiddleware"
import { ParamType, validatorMiddleware } from "../../../src/middleware/validatorMiddleware"
import * as blacklist from "../../../src/util/tokenBlacklist"

jest.mock("../../../src/infra/prismaClient", () => ({ prisma: { user: { findUnique: jest.fn() } } }))
jest.mock("jsonwebtoken", () => ({ verify: jest.fn() }))

function responseMock() {
  const res: any = { status: jest.fn(), json: jest.fn() }
  res.status.mockReturnValue(res)
  return res
}

describe("middlewares", () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "secret"
    jest.spyOn(blacklist, "isAccessTokenRevoked").mockReturnValue(false)
  })

  test("auth exige header e formato JWT", () => {
    let res = responseMock()
    authMiddleware({ headers: {}, header: jest.fn() }, res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)

    res = responseMock()
    authMiddleware({ headers: { authorization: "Bearer inválido" } }, res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test("auth aceita Bearer e atualiza permissões pelo cadastro atual", async () => {
    const next = jest.fn()
    const req: any = { headers: { authorization: "Bearer aaa.bbb.ccc" } }
    ;(jwt.verify as jest.Mock).mockReturnValue({ userId: 1 })
    ;(prisma.user.findUnique as jest.Mock<any>).mockResolvedValue({ active: true, deletedDate: null, roles: [{ role: { name: RoleName.ADMIN } }] })
    await authMiddleware(req, responseMock(), next)
    expect(jwt.verify).toHaveBeenCalledWith("aaa.bbb.ccc", "secret")
    expect(req.user).toEqual({ userId: 1, sub: 1, roles: [RoleName.ADMIN] })
    expect(next).toHaveBeenCalled()
  })

  test("auth bloqueia token revogado, segredo ausente e assinatura inválida", () => {
    const req = { headers: { authorization: "aaa.bbb.ccc" } }
    let res = responseMock()
    ;(blacklist.isAccessTokenRevoked as jest.Mock).mockReturnValue(true)
    authMiddleware(req, res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(401)

    ;(blacklist.isAccessTokenRevoked as jest.Mock).mockReturnValue(false)
    delete process.env.JWT_ACCESS_SECRET
    res = responseMock()
    authMiddleware(req, res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(500)

    process.env.JWT_ACCESS_SECRET = "secret"
    ;(jwt.verify as jest.Mock).mockImplementation(() => { throw new Error("bad") })
    res = responseMock()
    authMiddleware(req, res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test("validator rejeita entrada inválida e substitui por valor sanitizado", () => {
    const middleware = validatorMiddleware(ParamType.BODY, Joi.object({ age: Joi.number().required() }))
    let req: any = { body: {} }
    let res = responseMock()
    middleware(req, res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)

    req = { body: { age: "12" } }
    res = responseMock()
    const next = jest.fn()
    middleware(req, res, next)
    expect(req.body.age).toBe(12)
    expect(next).toHaveBeenCalled()
  })
  test("auth bloqueia usuário desativado e perfil removido durante uma sessão", async () => {
    const req: any = { headers: { authorization: "Bearer aaa.bbb.ccc" } }
    ;(jwt.verify as jest.Mock).mockReturnValue({ sub: 1, selectedRole: RoleName.ADMIN })
    ;(prisma.user.findUnique as jest.Mock<any>).mockResolvedValue({ active: false })
    let response = responseMock()
    const next = jest.fn()
    await authMiddleware(req, response, next)
    expect(response.status).toHaveBeenCalledWith(401)
    ;(prisma.user.findUnique as jest.Mock<any>).mockResolvedValue({ active: true, roles: [{ role: { name: RoleName.DOCENTE } }] })
    response = responseMock()
    await authMiddleware(req, response, next)
    expect(response.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
