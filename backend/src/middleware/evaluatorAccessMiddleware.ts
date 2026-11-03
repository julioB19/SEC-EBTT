import { RequestHandler } from "express"
import { RoleName, SpecialCommissionMemberOrigin } from "@prisma/client"
import { prisma } from "../infra/prismaClient"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"

export function evaluatorOrigin(role: RoleName) {
  return role === RoleName.DOCENTE ? SpecialCommissionMemberOrigin.INTERNAL : SpecialCommissionMemberOrigin.EXTERNAL
}

export const requireEvaluatorAssignment: RequestHandler = async (req: any, res, next) => {
  const memberId = Number(req.params.memberId)
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Atribuição inválida", null)
  }
  try {
    const member = await prisma.specialCommissionMember.findFirst({ where: {
      idSpecialCommissionMember: memberId, deletedDate: null, origin: evaluatorOrigin(req.user.selectedRole),
      person: { users: { some: { idUser: Number(req.user.sub), active: true, deletedDate: null } } }
    }, select: { idSpecialCommissionMember: true } })
    if (!member) return HttpResponse.forbidden(res, "Esta avaliação não pertence ao perfil em uso")
    next()
  } catch { return HttpResponse.internalError(res) }
}
