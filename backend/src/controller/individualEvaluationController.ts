import fs from "fs"
import { RequestHandler } from "express"
import { RoleName } from "@prisma/client"
import { IndividualEvaluationService } from "../service/individualEvaluationService"
import { SaveIndividualEvaluationDto } from "../type/dto/individualEvaluationDto"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { BusinessRuleError, NotFoundError } from "../service/processoService"

export class IndividualEvaluationController {
  constructor(private readonly service = new IndividualEvaluationService()) {}

  private getAuth(req: any) {
    const userId = Number(req.user?.sub)
    if (!userId || Number.isNaN(userId) || req.user?.selectedRole !== RoleName.EXTERNAL_EVALUATOR) return null
    return { userId }
  }

  private getPositiveId(raw: string | undefined) {
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
  }

  private handleError(res: any, error: unknown) {
    console.error("Individual evaluation request failed:", error)
    if (error instanceof NotFoundError || error instanceof BusinessRuleError) {
      HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      return
    }
    HttpResponse.internalError(res)
  }

  public get: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req)
      if (!auth) return HttpResponse.unauthorized(res)
      const memberId = this.getPositiveId(req.params.memberId)
      if (!memberId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid member id", null)
      return HttpResponse.ok(res, "Individual evaluation loaded", await this.service.getEvaluation(auth.userId, memberId))
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public save: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req)
      if (!auth) return HttpResponse.unauthorized(res)
      const memberId = this.getPositiveId(req.params.memberId)
      if (!memberId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid member id", null)
      return HttpResponse.ok(
        res,
        "Individual evaluation saved",
        await this.service.saveDraft(auth.userId, memberId, req.body as SaveIndividualEvaluationDto)
      )
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public submit: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req)
      if (!auth) return HttpResponse.unauthorized(res)
      const memberId = this.getPositiveId(req.params.memberId)
      if (!memberId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid member id", null)
      return HttpResponse.ok(
        res,
        "Individual evaluation submitted",
        await this.service.submit(auth.userId, memberId, req.body as SaveIndividualEvaluationDto)
      )
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public getEvidenceContent: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req)
      if (!auth) return HttpResponse.unauthorized(res)
      const memberId = this.getPositiveId(req.params.memberId)
      const evidenceFileId = this.getPositiveId(req.params.evidenceFileId)
      if (!memberId || !evidenceFileId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid identifier", null)
      }

      const file = await this.service.getEvidenceContent(auth.userId, memberId, evidenceFileId)
      res.setHeader("Content-Type", file.mimeType)
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`)
      const stream = fs.createReadStream(file.filePath)
      stream.on("error", error => {
        console.error("Error reading evaluation evidence:", error)
        if (!res.headersSent) HttpResponse.internalError(res)
        else res.end()
      })
      stream.pipe(res)
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public getOpinionPdf: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req)
      if (!auth) return HttpResponse.unauthorized(res)
      const memberId = this.getPositiveId(req.params.memberId)
      if (!memberId) {
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid member id", null)
      }
      const file = await this.service.generateOpinionPdf(auth.userId, memberId)
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`)
      return res.send(file.buffer)
    } catch (error) {
      this.handleError(res, error)
    }
  }
}
