import { describe, expect, jest, test } from "@jest/globals"
import { RoleName } from "@prisma/client"
import { SpecialCommissionController } from "../../../src/controller/specialCommissionController"
import { IndividualEvaluationController } from "../../../src/controller/individualEvaluationController"

function response() { const res: any = { status: jest.fn(), json: jest.fn() }; res.status.mockReturnValue(res); return res }
describe("Avaliador interno usa a conta docente", () => {
  test("lista suas atribuições como docente sem exigir perfil externo", async () => {
    const listAssignments = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([])
    const controller = new SpecialCommissionController({ listAssignments } as any)
    const res = response()
    await controller.listAssignments({ user: { sub: 17, selectedRole: RoleName.DOCENTE } } as any, res, jest.fn())
    expect(listAssignments).toHaveBeenCalledWith(17)
    expect(res.status).toHaveBeenCalledWith(200)
  })
  test("consulta avaliação mantendo o filtro pelo usuário da sessão", async () => {
    const get = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: 12 })
    const controller = new IndividualEvaluationController({ getEvaluation: get } as any)
    const res = response()
    await controller.get({ user: { sub: 17, selectedRole: RoleName.DOCENTE }, params: { memberId: "12" } } as any, res, jest.fn())
    expect(get).toHaveBeenCalledWith(17, 12)
    expect(res.status).toHaveBeenCalledWith(200)
  })
  test("perfil de administrador não substitui a atuação como avaliador", async () => {
    const get = jest.fn<(...args: any[]) => Promise<any>>()
    const controller = new IndividualEvaluationController({ getEvaluation: get } as any)
    const res = response()
    await controller.get({ user: { sub: 17, selectedRole: RoleName.ADMIN }, params: { memberId: "12" } } as any, res, jest.fn())
    expect(get).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
