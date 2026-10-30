import { Router, Request, Response, NextFunction } from "express"
import { RoleName } from "@prisma/client"
import fs from "fs/promises"
import { upload } from "../infra/upload"
import { CaseActor, CaseComplianceService } from "../service/caseComplianceService"
import { CaseDocumentService } from "../service/caseDocumentService"
import { RscAppealService } from "../service/rscAppealService"
import { CaseAdministrationService } from "../service/caseAdministrationService"
import { BusinessRuleError, NotFoundError } from "../service/processoService"
import { CppdAccessDenied } from "../exception/cppd-access-denied"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"

const service = new CaseComplianceService()
function actor(req: any): CaseActor {
  const userId = Number(req.user?.sub)
  const role = req.user?.selectedRole as RoleName
  if (!Number.isInteger(userId) || userId < 1 || !role) throw new CppdAccessDenied("Selecione um perfil para continuar")
  return { userId, role }
}
function id(value: string) { const number = Number(value); if (!Number.isInteger(number) || number < 1) throw new BusinessRuleError("Identificador inválido"); return number }
function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { await fn(req, res) } catch (error: any) {
      if (req.file) await fs.unlink(req.file.path).catch(() => undefined)
      if (error instanceof CppdAccessDenied) { HttpResponse.forbidden(res, error.message); return }
      if (error instanceof BusinessRuleError || error instanceof NotFoundError) { HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null); return }
      if (error?.code === "P2034" || error?.code === "P2002") { HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "O registro mudou durante a operação; recarregue e tente novamente", null); return }
      console.error("Case compliance request failed", error)
      HttpResponse.internalError(res)
    }
  }
}

export function caseComplianceRoute() {
  const router = Router()
  const administration = new CaseAdministrationService()
  router.post("/cases/:id/appeals", handle(async (req, res) => HttpResponse.ok(res, "Recurso registrado", await new RscAppealService().submit(id(req.params.id), actor(req), req.body))))
  router.post("/cases/:id/appeals/:appealId/decision", handle(async (req, res) => HttpResponse.ok(res, "Decisão externa registrada", await new RscAppealService().recordExternalDecision(id(req.params.id), id(req.params.appealId), actor(req), req.body))))
  router.get("/management/regulatory-configuration", handle(async (req, res) => HttpResponse.ok(res, "Configuração carregada", await administration.configuration(actor(req)))))
  router.post("/management/regulatory-configuration", handle(async (req, res) => HttpResponse.ok(res, "Configuração salva", await administration.configure(actor(req), req.body))))
  router.get("/teacher/degrees", handle(async (req, res) => HttpResponse.ok(res, "Titulações carregadas", await administration.degrees(actor(req)))))
  router.post("/teacher/degrees", handle(async (req, res) => HttpResponse.ok(res, "Titulação cadastrada", await administration.addDegree(actor(req), req.body))))
  router.post("/teacher/evidence", (req: any, res, next) => { try { if (actor(req).role !== RoleName.DOCENTE) { HttpResponse.forbidden(res); return }; next() } catch { HttpResponse.forbidden(res, "Selecione o perfil Docente") } }, upload.single("file"), handle(async (req, res) => {
    if (!req.file) throw new BusinessRuleError("Envie o arquivo PDF")
    const saved = await administration.uploadEvidence(actor(req), req.file)
    req.file = undefined
    return HttpResponse.ok(res, "Documento salvo", saved)
  }))
  router.get("/cases/:id/files/:fileId", handle(async (req, res) => {
    const file = await service.linkedFile(id(req.params.id), actor(req), id(req.params.fileId))
    res.type("application/pdf").setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`)
    res.send(file.bytes)
  }))
  router.get("/cases/:id/compliance", handle(async (req, res) => HttpResponse.ok(res, "Conformidade carregada", await service.get(id(req.params.id), actor(req)))))
  router.post("/cases/:id/compliance", handle(async (req, res) => HttpResponse.ok(res, "Registro salvo", await service.save(id(req.params.id), actor(req), req.body))))
  const authorizeUpload = async (req: Request, res: Response, next: NextFunction) => { try { await service.context(id(req.params.id), actor(req)); next() } catch (error: any) { HttpResponse.forbidden(res, error.message) } }
  router.post("/cases/:id/signatures", authorizeUpload, upload.single("file"), handle(async (req, res) => {
    if (!req.file) throw new BusinessRuleError("Envie o arquivo PDF assinado")
    const saved = await service.uploadSignature(id(req.params.id), actor(req), req.body, req.file)
    req.file = undefined
    return HttpResponse.ok(res, "Documento recebido para conferência administrativa", saved)
  }))
  router.post("/cases/:id/signatures/:artifactId/validate", handle(async (req, res) => HttpResponse.ok(res, "Conferência registrada", await service.validateSignature(id(req.params.id), actor(req), id(req.params.artifactId), req.body))))
  router.get("/cases/:id/signatures/:artifactId/file", handle(async (req, res) => {
    const file = await service.signedFile(id(req.params.id), actor(req), id(req.params.artifactId))
    res.type("application/pdf").setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`)
    res.send(file.bytes)
  }))
  router.get("/cases/:id/documents/:kind", handle(async (req, res) => {
    const file = await new CaseDocumentService().generate(id(req.params.id), actor(req), req.params.kind)
    res.type("application/pdf").setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`)
    res.send(file.bytes)
  }))
  return router
}
