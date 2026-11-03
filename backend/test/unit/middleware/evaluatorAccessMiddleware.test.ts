import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { RoleName } from "@prisma/client"
import { prisma } from "../../../src/infra/prismaClient"
import { requireEvaluatorAssignment } from "../../../src/middleware/evaluatorAccessMiddleware"
jest.mock("../../../src/infra/prismaClient", () => ({ prisma: { specialCommissionMember: { findFirst: jest.fn() } } }))
function response() { const res: any = { status: jest.fn(), json: jest.fn() }; res.status.mockReturnValue(res); return res }
describe("Atribuições internas e externas", () => {
  beforeEach(() => { jest.clearAllMocks() })
  test("docente só acessa atribuição interna ligada à sua pessoa", async () => {
    jest.mocked(prisma.specialCommissionMember.findFirst).mockResolvedValue({ idSpecialCommissionMember: 12 } as any)
    const next = jest.fn()
    await requireEvaluatorAssignment({ user: { sub: 17, selectedRole: RoleName.DOCENTE }, params: { memberId: "12" } } as any, response(), next)
    expect(prisma.specialCommissionMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      idSpecialCommissionMember: 12, origin: "INTERNAL", person: { users: { some: { idUser: 17, active: true, deletedDate: null } } }
    }) }))
    expect(next).toHaveBeenCalled()
  })
  test("atribuição externa não pode ser acessada usando o perfil docente", async () => {
    jest.mocked(prisma.specialCommissionMember.findFirst).mockResolvedValue(null)
    const res = response(), next = jest.fn()
    await requireEvaluatorAssignment({ user: { sub: 17, selectedRole: RoleName.DOCENTE }, params: { memberId: "12" } } as any, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
  test("perfil externo exige atribuição externa da mesma conta", async () => {
    jest.mocked(prisma.specialCommissionMember.findFirst).mockResolvedValue(null)
    await requireEvaluatorAssignment({ user: { sub: 17, selectedRole: RoleName.EXTERNAL_EVALUATOR }, params: { memberId: "12" } } as any, response(), jest.fn())
    expect(prisma.specialCommissionMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ origin: "EXTERNAL" }) }))
  })
})
