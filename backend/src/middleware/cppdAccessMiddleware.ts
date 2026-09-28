import { RequestHandler } from "express"
import { RoleName } from "@prisma/client"
import { CppdAccessDenied } from "../exception/cppd-access-denied"
import { CppdAccessService } from "../service/cppdAccessService"
import { CppdAccessScope } from "../type/cppdAccess"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"

const service = new CppdAccessService()

export function requireSelectedRole(...allowedRoles: RoleName[]): RequestHandler {
  return (req: any, res, next) => {
    const selectedRole = req.user?.selectedRole as RoleName | undefined
    if (!selectedRole || !allowedRoles.includes(selectedRole)) {
      return HttpResponse.forbidden(res, "O perfil selecionado não possui acesso a este recurso")
    }
    next()
  }
}

export function getCppdAccessScope(req: any): CppdAccessScope | null {
  return (req.cppdAccess as CppdAccessScope | undefined) ?? null
}

export const requireCppdAccess: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = Number(req.user?.sub)
    if (!userId || Number.isNaN(userId)) return HttpResponse.unauthorized(res)

    req.cppdAccess = await service.resolveScope(
      userId,
      req.user?.selectedRole as RoleName | null | undefined
    )
    next()
  } catch (error) {
    if (error instanceof CppdAccessDenied) {
      return HttpResponse.forbidden(res, error.message)
    }
    console.error("Falha ao resolver o escopo da CPPD:", error)
    return HttpResponse.internalError(res)
  }
}

export function requireCppdProcessAccess(paramName = "id"): RequestHandler {
  return async (req: any, res, next) => {
    const scope = getCppdAccessScope(req)
    if (!scope) return HttpResponse.unauthorized(res)

    const processId = Number(req.params?.[paramName])
    if (!Number.isInteger(processId) || processId <= 0) {
      return HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        "Identificador de processo inválido",
        null
      )
    }

    try {
      await service.assertProcessAccess(scope, processId)
      next()
    } catch (error) {
      if (error instanceof CppdAccessDenied) {
        return HttpResponse.forbidden(res, error.message)
      }
      console.error("Falha ao validar o campus do processo:", error)
      return HttpResponse.internalError(res)
    }
  }
}

export function requireCppdTeacherAccess(paramName = "userId"): RequestHandler {
  return async (req: any, res, next) => {
    const scope = getCppdAccessScope(req)
    if (!scope) return HttpResponse.unauthorized(res)

    const userId = Number(req.params?.[paramName])
    if (!Number.isInteger(userId) || userId <= 0) {
      return HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        "Identificador de docente inválido",
        null
      )
    }

    try {
      await service.assertTeacherAccess(scope, userId)
      next()
    } catch (error) {
      if (error instanceof CppdAccessDenied) {
        return HttpResponse.forbidden(res, error.message)
      }
      console.error("Falha ao validar o campus do docente:", error)
      return HttpResponse.internalError(res)
    }
  }
}
