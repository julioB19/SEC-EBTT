import { RequestHandler } from "express"
import { RoleName } from "@prisma/client"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { BusinessRuleError, NotFoundError } from "../service/processoService"
import { SpecialCommissionService } from "../service/specialCommissionService"
import {
  AddSpecialCommissionMemberDto,
  FinalizeSpecialCommissionDecisionDto,
  RespondSpecialCommissionInvitationDto,
  SaveSpecialCommissionDto,
  UpdateSpecialCommissionStatusDto
} from "../type/dto/specialCommissionDto"

export class SpecialCommissionController {
  constructor(private readonly service = new SpecialCommissionService()) {}

  private getAuth(req: any, requiredRole: RoleName) {
    const userId = Number(req.user?.sub)
    const selectedRole = req.user?.selectedRole as RoleName | undefined
    const hasRequiredRole = requiredRole === RoleName.CPPD_MEMBER
      ? selectedRole === RoleName.CPPD_MEMBER || selectedRole === RoleName.CPPD_CENTRAL
      : selectedRole === requiredRole
    if (!userId || Number.isNaN(userId) || !hasRequiredRole) return null
    return { userId }
  }

  private getPositiveId(raw: string | undefined) {
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
  }

  private handleError(res: any, error: unknown) {
    console.error("Special commission request failed:", error)
    if (error instanceof NotFoundError || error instanceof BusinessRuleError) {
      HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      return
    }
    HttpResponse.internalError(res)
  }

  public getForProcess: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req, RoleName.CPPD_MEMBER)
      if (!auth) return HttpResponse.unauthorized(res)
      const processId = this.getPositiveId(req.params.id)
      if (!processId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      }
      return HttpResponse.ok(res, "Special commission loaded", await this.service.getForProcess(processId))
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public save: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req, RoleName.CPPD_MEMBER)
      if (!auth) return HttpResponse.unauthorized(res)
      const processId = this.getPositiveId(req.params.id)
      if (!processId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      }
      const result = await this.service.save(processId, req.body as SaveSpecialCommissionDto)
      return HttpResponse.ok(res, "Special commission saved", result)
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public addMember: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req, RoleName.CPPD_MEMBER)
      if (!auth) return HttpResponse.unauthorized(res)
      const processId = this.getPositiveId(req.params.id)
      if (!processId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      }
      const result = await this.service.addExternalMember(
        processId,
        auth.userId,
        req.body as AddSpecialCommissionMemberDto
      )
      return HttpResponse.created(res, "Special commission member added", result)
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public removeMember: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req, RoleName.CPPD_MEMBER)
      if (!auth) return HttpResponse.unauthorized(res)
      const processId = this.getPositiveId(req.params.id)
      const memberId = this.getPositiveId(req.params.memberId)
      if (!processId || !memberId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid identifier", null)
      }
      return HttpResponse.ok(
        res,
        "Special commission member removed",
        await this.service.removeMember(processId, memberId)
      )
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public updateStatus: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req, RoleName.CPPD_MEMBER)
      if (!auth) return HttpResponse.unauthorized(res)
      const processId = this.getPositiveId(req.params.id)
      if (!processId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      }
      const result = await this.service.updateStatus(
        processId,
        auth.userId,
        req.body as UpdateSpecialCommissionStatusDto
      )
      return HttpResponse.ok(res, "Special commission status updated", result)
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public listAssignments: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req, RoleName.EXTERNAL_EVALUATOR)
      if (!auth) return HttpResponse.unauthorized(res)
      return HttpResponse.ok(
        res,
        "External evaluator assignments loaded",
        await this.service.listAssignments(auth.userId)
      )
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public respond: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req, RoleName.EXTERNAL_EVALUATOR)
      if (!auth) return HttpResponse.unauthorized(res)
      const memberId = this.getPositiveId(req.params.memberId)
      if (!memberId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid member id", null)
      }
      const result = await this.service.respond(
        auth.userId,
        memberId,
        req.body as RespondSpecialCommissionInvitationDto
      )
      return HttpResponse.ok(res, "Special commission invitation answered", result)
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public finalizeDecision: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req, RoleName.CPPD_MEMBER)
      if (!auth) return HttpResponse.unauthorized(res)
      const processId = this.getPositiveId(req.params.id)
      if (!processId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      }
      const result = await this.service.finalizeDecision(
        processId,
        auth.userId,
        req.body as FinalizeSpecialCommissionDecisionDto
      )
      return HttpResponse.ok(res, "Special commission decision finalized", result)
    } catch (error) {
      this.handleError(res, error)
    }
  }
}
