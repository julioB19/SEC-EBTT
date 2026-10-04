import { RoleName } from "@prisma/client"
import { RequestHandler } from "express"
import { BusinessRuleError, NotFoundError } from "../service/processoService"
import { FullProfessorProcedureService } from "../service/fullProfessorProcedureService"
import { FullProfessorProcedureActionDto } from "../type/dto/fullProfessorProcedureDto"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"

export class FullProfessorProcedureController {
  constructor(private readonly service = new FullProfessorProcedureService()) {}

  public get: RequestHandler = async (req: any, res) => {
    try {
      const actor = this.actor(req)
      if (!actor) return HttpResponse.unauthorized(res)
      const processId = this.processId(req.params.id)
      if (!processId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Identificador de processo inválido", null)
      return HttpResponse.ok(res, "Rito da Classe Titular carregado", await this.service.get(processId, actor))
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public execute: RequestHandler = async (req: any, res) => {
    try {
      const actor = this.actor(req)
      if (!actor) return HttpResponse.unauthorized(res)
      const processId = this.processId(req.params.id)
      if (!processId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Identificador de processo inválido", null)
      return HttpResponse.ok(
        res,
        "Rito da Classe Titular atualizado",
        await this.service.execute(processId, actor, req.body as FullProfessorProcedureActionDto)
      )
    } catch (error) {
      this.handleError(res, error)
    }
  }

  private actor(req: any) {
    const userId = Number(req.user?.sub)
    const role = req.user?.selectedRole as RoleName | undefined
    if (!Number.isInteger(userId) || userId <= 0 || !role) return null
    return { userId, role }
  }

  private processId(raw: string | undefined) {
    const value = Number(raw)
    return Number.isInteger(value) && value > 0 ? value : null
  }

  private handleError(res: any, error: unknown) {
    if (error instanceof BusinessRuleError || error instanceof NotFoundError) {
      return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
    }
    console.error("Full professor procedure request failed:", error)
    return HttpResponse.internalError(res)
  }
}
