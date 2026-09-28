import fs from "fs"
import { RequestHandler } from "express"
import { GeccInterestedType, RoleName } from "@prisma/client"
import { upload } from "../infra/upload"
import { GeccService } from "../service/geccService"
import { AddGeccInterestedDto, SaveGeccDto, UpdateGeccStatusDto } from "../type/dto/geccDto"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { BusinessRuleError, NotFoundError } from "../service/processoService"

export class GeccController {
  constructor(private readonly service = new GeccService()) {}

  private getAuth(req: any) {
    const userId = Number(req.user?.sub)
    const selectedRole = req.user?.selectedRole as RoleName | undefined
    const isCppd = selectedRole === RoleName.CPPD_MEMBER || selectedRole === RoleName.CPPD_CENTRAL
    if (!userId || Number.isNaN(userId) || !isCppd) return null
    return { userId }
  }

  private positiveId(raw: string | undefined) {
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
  }

  private handleError(res: any, error: unknown) {
    console.error("GECC request failed:", error)
    if (error instanceof NotFoundError || error instanceof BusinessRuleError) {
      HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
      return
    }
    HttpResponse.internalError(res)
  }

  public get: RequestHandler = async (req, res) => {
    try {
      if (!this.getAuth(req)) return HttpResponse.unauthorized(res)
      const processId = this.positiveId(req.params.id)
      if (!processId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      return HttpResponse.ok(res, "GECC loaded", await this.service.getForProcess(processId))
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public save: RequestHandler = async (req, res) => {
    try {
      if (!this.getAuth(req)) return HttpResponse.unauthorized(res)
      const processId = this.positiveId(req.params.id)
      if (!processId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      return HttpResponse.ok(res, "GECC saved", await this.service.save(processId, req.body as SaveGeccDto))
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public addInterested: RequestHandler = async (req, res) => {
    try {
      if (!this.getAuth(req)) return HttpResponse.unauthorized(res)
      const processId = this.positiveId(req.params.id)
      if (!processId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      return HttpResponse.created(
        res,
        "GECC interested person added",
        await this.service.addInterested(processId, req.body as AddGeccInterestedDto)
      )
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public removeInterested: RequestHandler = async (req, res) => {
    try {
      if (!this.getAuth(req)) return HttpResponse.unauthorized(res)
      const processId = this.positiveId(req.params.id)
      const personId = this.positiveId(req.params.personId)
      const type = req.params.type as GeccInterestedType
      if (!processId || !personId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid identifier", null)
      return HttpResponse.ok(
        res,
        "GECC interested person removed",
        await this.service.removeInterested(processId, personId, type)
      )
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public addDocument: RequestHandler = (req, res) => {
    const auth = this.getAuth(req)
    if (!auth) return HttpResponse.unauthorized(res)
    const processId = this.positiveId(req.params.id)
    if (!processId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)

    upload.single("file")(req, res, async uploadError => {
      if (uploadError) {
        const error = uploadError as any
        const message = error.code === "LIMIT_FILE_SIZE"
          ? "O arquivo excede o tamanho máximo permitido de 5MB."
          : error.message || "Não foi possível receber o arquivo"
        return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, message, null)
      }
      const file = (req as any).file as Express.Multer.File | undefined
      if (!file) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Arquivo é obrigatório", null)

      try {
        const personId = req.body?.personId ? Number(req.body.personId) : null
        if (personId !== null && (!Number.isInteger(personId) || personId <= 0)) {
          throw new BusinessRuleError("Interessado inválido")
        }
        const result = await this.service.addDocument({
          processId,
          userId: auth.userId,
          documentType: String(req.body?.documentType ?? ""),
          personId,
          originalName: file.originalname,
          storedName: file.filename,
          url: `/uploads/${auth.userId}/${processId}/${file.filename}`,
          mimeType: file.mimetype,
          sizeBytes: file.size
        })
        return HttpResponse.created(res, "GECC document added", result)
      } catch (error) {
        await fs.promises.unlink(file.path).catch(() => undefined)
        this.handleError(res, error)
      }
    })
  }

  public removeDocument: RequestHandler = async (req, res) => {
    try {
      if (!this.getAuth(req)) return HttpResponse.unauthorized(res)
      const processId = this.positiveId(req.params.id)
      const documentId = this.positiveId(req.params.documentId)
      if (!processId || !documentId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid identifier", null)
      return HttpResponse.ok(res, "GECC document removed", await this.service.removeDocument(processId, documentId))
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public generateChecklist: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req)
      if (!auth) return HttpResponse.unauthorized(res)
      const processId = this.positiveId(req.params.id)
      if (!processId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      return HttpResponse.ok(res, "GECC checklist generated", await this.service.generateChecklist(processId, auth.userId))
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public updateStatus: RequestHandler = async (req, res) => {
    try {
      const auth = this.getAuth(req)
      if (!auth) return HttpResponse.unauthorized(res)
      const processId = this.positiveId(req.params.id)
      if (!processId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid process id", null)
      return HttpResponse.ok(
        res,
        "GECC status updated",
        await this.service.updateStatus(processId, auth.userId, req.body as UpdateGeccStatusDto)
      )
    } catch (error) {
      this.handleError(res, error)
    }
  }

  public getDocumentContent: RequestHandler = async (req, res) => {
    try {
      if (!this.getAuth(req)) return HttpResponse.unauthorized(res)
      const processId = this.positiveId(req.params.id)
      const evidenceFileId = this.positiveId(req.params.evidenceFileId)
      if (!processId || !evidenceFileId) return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "Invalid identifier", null)
      const file = await this.service.getDocumentContent(processId, evidenceFileId)
      res.setHeader("Content-Type", file.mimeType)
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`)
      const stream = fs.createReadStream(file.filePath)
      stream.on("error", error => {
        console.error("Erro ao ler documento do GECC:", error)
        if (!res.headersSent) HttpResponse.internalError(res)
        else res.end()
      })
      stream.pipe(res)
    } catch (error) {
      this.handleError(res, error)
    }
  }
}
