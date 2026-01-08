import { RequestHandler } from "express"
import jwt from "jsonwebtoken"
import {
  BusinessRuleError,
  NotFoundError,
  ProcessoService
} from "../service/processoService"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { ProcessStatus, ProcessType } from "@prisma/client"
import {
  AberturaProcessoDto,
  UpdateProcessoDto,
  UserPatchDto
} from "../type/dto/processoDto"

export class ProcessoController {
  constructor(private readonly service: ProcessoService) {}


  public abrirProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

      if (!token) {
        HttpResponse.unauthorized(res)
        return
      }

      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res)
        return
      }

      const body: any = req.body
      const patchUsuario = (body?.patchUsuario ?? null) as UserPatchDto | null
      const processoRaw = body?.processo

      if (!processoRaw || typeof processoRaw !== "object") {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          '"processo" é obrigatório',
          null
        )
        return
      }

      const tipoStr: string = String(processoRaw.tipo).toUpperCase()

      if (tipoStr !== "PROGRESSAO" && tipoStr !== "PROMOCAO") {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          'processo.tipo deve ser "PROGRESSAO" ou "PROMOCAO"',
          null
        )
        return
      }

      const tipoEnum: ProcessType =
        tipoStr === "PROMOCAO" ? ProcessType.PROMOCAO : ProcessType.PROGRESSAO

      const dto: AberturaProcessoDto = {
        tipo: tipoEnum,
        campus: processoRaw.campus,
        cidadeUF: processoRaw.cidadeUF,
        dataEmissaoISO: processoRaw.dataEmissaoISO,
        intersticioInicioISO: processoRaw.intersticioInicioISO,
        intersticioFimISO: processoRaw.intersticioFimISO,
        classeOrigem: processoRaw.classeOrigem,
        nivelOrigem: processoRaw.nivelOrigem,
        classeDestino: processoRaw.classeDestino,
        nivelDestino: processoRaw.nivelDestino
      }

      const result = await this.service.abrirComAtualizacao(userId, patchUsuario, dto)

      return HttpResponse.created(res, "Processo aberto com sucesso", result)
    } catch (error) {
      console.error("Erro ao abrir processo:", error)

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }


  public listarProcessos: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

      if (!token) {
        HttpResponse.unauthorized(res)
        return
      }

      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res)
        return
      }

      const statusQuery = req.query.status
      let statuses: ProcessStatus[] | undefined = undefined

      if (statusQuery) {
        const rawValues: string[] = Array.isArray(statusQuery)
          ? statusQuery.flatMap(s => String(s).split(","))
          : String(statusQuery).split(",")

        const cleaned = rawValues
          .map(s => s.trim().toUpperCase())
          .filter(s => s.length > 0)

        const validStatuses = Object.values(ProcessStatus)

        const parsed = cleaned.filter(s =>
          validStatuses.includes(s as ProcessStatus)
        ) as ProcessStatus[]

        if (parsed.length) {
          statuses = parsed
        }
      }

      const list = await this.service.listarProcessos(userId, statuses)

      return HttpResponse.ok(
        res,
        "Lista de processos recuperada com sucesso",
        list
      )
    } catch (error) {
      console.error("Erro ao listar processos:", error)
      HttpResponse.internalError(res)
      return
    }
  }

  public obterProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

      if (!token) {
        HttpResponse.unauthorized(res)
        return
      }

      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res)
        return
      }

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null
        )
        return
      }

      const result = await this.service.obterProcessoPorId(processId, userId)

      return HttpResponse.ok(res, "Processo recuperado com sucesso", result)
    } catch (error) {
      console.error("Erro ao obter processo:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }


  public editarProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

      if (!token) {
        HttpResponse.unauthorized(res)
        return
      }

      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res)
        return
      }

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null
        )
        return
      }

      const body: any = req.body
      const processoRaw = body?.processo

      if (!processoRaw || typeof processoRaw !== "object") {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          '"processo" é obrigatório para edição',
          null
        )
        return
      }

      const dto: UpdateProcessoDto = {
        campus: processoRaw.campus,
        cidadeUF: processoRaw.cidadeUF,
        intersticioInicioISO: processoRaw.intersticioInicioISO,
        intersticioFimISO: processoRaw.intersticioFimISO,
        classeOrigem: processoRaw.classeOrigem,
        nivelOrigem: processoRaw.nivelOrigem,
        classeDestino: processoRaw.classeDestino,
        nivelDestino: processoRaw.nivelDestino
      }

      const result = await this.service.editarProcesso(processId, userId, dto)

      return HttpResponse.ok(res, "Processo atualizado com sucesso", result)
    } catch (error) {
      console.error("Erro ao editar processo:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }


  public excluirProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

      if (!token) {
        HttpResponse.unauthorized(res)
        return
      }

      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res)
        return
      }

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null
        )
        return
      }

      const result = await this.service.excluirProcesso(processId, userId)

      return HttpResponse.ok(res, "Processo excluído com sucesso", result)
    } catch (error) {
      console.error("Erro ao excluir processo:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }


  public gerarRequerimento: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

      if (!token) {
        HttpResponse.unauthorized(res)
        return
      }

      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res)
        return
      }

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null
        )
        return
      }

      const { filename, pdfBuffer } = await this.service.gerarRequerimento(
        processId,
        userId
      )

      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      res.setHeader("X-Process-Id", String(processId))

      res.status(200).send(pdfBuffer)
      return
    } catch (error) {
      console.error("Erro ao gerar requerimento:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

  public enviarProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth

      if (!token) {
        HttpResponse.unauthorized(res)
        return
      }

      const payload = jwt.verify(token, String(process.env.JWT_ACCESS_SECRET)) as any
      const userId = Number(payload?.sub)
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res)
        return
      }

      const processId = Number(req.params.id)
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null
        )
        return
      }

      const result = await this.service.enviarParaAvaliacao(processId, userId)

      return HttpResponse.ok(
        res,
        "Processo enviado para avaliação da CPPD com sucesso",
        result
      )
    } catch (error) {
      console.error("Erro ao enviar processo para avaliação:", error)

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null
        )
        return
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details
        )
        return
      }

      HttpResponse.internalError(res)
      return
    }
  }

}
