import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import {
  BusinessRuleError,
  NotFoundError,
  ProcessoService,
} from "../service/processoService";
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse";
import { ProcessStatus } from "@prisma/client";
import {
  AberturaProcessoDto,
  UpdateProcessoDto,
  UserPatchDto,
} from "../type/dto/processoDto";
import { upload } from "../infra/upload";
import fs from "fs";
import path from "path";

export class ProcessoController {
  constructor(private readonly service: ProcessoService) {}

  public listarTiposProcesso: RequestHandler = async (_req, res, _next) => {
    try {
      const list = await this.service.listarTiposProcesso();

      return HttpResponse.ok(
        res,
        "Tipos de processo recuperados com sucesso",
        list,
      );
    } catch (error) {
      console.error("Erro ao listar tipos de processo:", error);
      HttpResponse.internalError(res);
      return;
    }
  };

  public abrirProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

      if (!token) {
        HttpResponse.unauthorized(res);
        return;
      }

      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      const userId = Number(payload?.sub);
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res);
        return;
      }

      const body: any = req.body;
      const patchUsuario = (body?.patchUsuario ?? null) as UserPatchDto | null;
      const processoRaw = body?.processo;

      if (!processoRaw || typeof processoRaw !== "object") {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          '"processo" é obrigatório',
          null,
        );
        return;
      }

      const tipoRaw = processoRaw.processTypeCode ?? processoRaw.tipo;
      const processTypeIdRaw = processoRaw.processTypeId;
      const processTypeId =
        processTypeIdRaw !== undefined && processTypeIdRaw !== null
          ? Number(processTypeIdRaw)
          : undefined;

      if (
        (tipoRaw === undefined || String(tipoRaw).trim().length === 0) &&
        processTypeId === undefined
      ) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          '"processo.tipo", "processo.processTypeCode" ou "processo.processTypeId" é obrigatório',
          null,
        );
        return;
      }

      if (
        processTypeId !== undefined &&
        (!Number.isInteger(processTypeId) || processTypeId <= 0)
      ) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          '"processo.processTypeId" inválido',
          null,
        );
        return;
      }

      const dto: AberturaProcessoDto = {
        tipo: tipoRaw !== undefined ? String(tipoRaw) : "",
        processTypeCode:
          processoRaw.processTypeCode !== undefined
            ? String(processoRaw.processTypeCode)
            : undefined,
        processTypeId,
        campus: processoRaw.campus,
        cidadeUF: processoRaw.cidadeUF,
        externalNumber: processoRaw.externalNumber,
        dataEmissaoISO: processoRaw.dataEmissaoISO,
        intersticioInicioISO: processoRaw.intersticioInicioISO,
        intersticioFimISO: processoRaw.intersticioFimISO,
        classeOrigem: processoRaw.classeOrigem,
        nivelOrigem: processoRaw.nivelOrigem,
        classeDestino: processoRaw.classeDestino,
        nivelDestino: processoRaw.nivelDestino,
        rscDetails:
          processoRaw.rscDetails && typeof processoRaw.rscDetails === "object"
            ? {
                targetLevel: processoRaw.rscDetails.targetLevel,
                careerEntryDateISO:
                  processoRaw.rscDetails.careerEntryDateISO,
                previousRscGrantedAtISO:
                  processoRaw.rscDetails.previousRscGrantedAtISO,
                activityPeriodStartISO:
                  processoRaw.rscDetails.activityPeriodStartISO,
                activityPeriodEndISO:
                  processoRaw.rscDetails.activityPeriodEndISO,
                truthDeclarationAccepted:
                  processoRaw.rscDetails.truthDeclarationAccepted,
              }
            : undefined,
        fullProfessorDetails:
          processoRaw.fullProfessorDetails &&
          typeof processoRaw.fullProfessorDetails === "object"
            ? {
                evaluationMode: processoRaw.fullProfessorDetails.evaluationMode,
                doctorateDegreeId:
                  processoRaw.fullProfessorDetails.doctorateDegreeId !==
                    undefined &&
                  processoRaw.fullProfessorDetails.doctorateDegreeId !== null
                    ? Number(processoRaw.fullProfessorDetails.doctorateDegreeId)
                    : null,
                finalReferenceDateISO:
                  processoRaw.fullProfessorDetails.finalReferenceDateISO,
              }
            : undefined,
      };

      const result = await this.service.abrirComAtualizacao(
        userId,
        patchUsuario,
        dto,
      );

      return HttpResponse.created(res, "Processo aberto com sucesso", result);
    } catch (error) {
      console.error("Erro ao abrir processo:", error);

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null;

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details,
        );
        return;
      }

      HttpResponse.internalError(res);
      return;
    }
  };

  public listarProcessos: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

      if (!token) {
        HttpResponse.unauthorized(res);
        return;
      }

      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      const userId = Number(payload?.sub);
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res);
        return;
      }

      const statusQuery = req.query.status;
      let statuses: ProcessStatus[] | undefined = undefined;

      if (statusQuery) {
        const rawValues: string[] = Array.isArray(statusQuery)
          ? statusQuery.flatMap((s) => String(s).split(","))
          : String(statusQuery).split(",");

        const cleaned = rawValues
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length > 0);

        const validStatuses = Object.values(ProcessStatus);

        const parsed = cleaned.filter((s) =>
          validStatuses.includes(s as ProcessStatus),
        ) as ProcessStatus[];

        if (parsed.length) {
          statuses = parsed;
        }
      }

      const list = await this.service.listarProcessos(userId, statuses);

      return HttpResponse.ok(
        res,
        "Lista de processos recuperada com sucesso",
        list,
      );
    } catch (error) {
      console.error("Erro ao listar processos:", error);
      HttpResponse.internalError(res);
      return;
    }
  };

  public obterProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

      if (!token) {
        HttpResponse.unauthorized(res);
        return;
      }

      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      const userId = Number(payload?.sub);
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res);
        return;
      }

      const processId = Number(req.params.id);
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null,
        );
        return;
      }

      const result = await this.service.obterProcessoPorId(processId, userId);

      return HttpResponse.ok(res, "Processo recuperado com sucesso", result);
    } catch (error) {
      console.error("Erro ao obter processo:", error);

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null,
        );
        return;
      }

      HttpResponse.internalError(res);
      return;
    }
  };

  public editarProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

      if (!token) {
        HttpResponse.unauthorized(res);
        return;
      }

      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      const userId = Number(payload?.sub);
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res);
        return;
      }

      const processId = Number(req.params.id);
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null,
        );
        return;
      }

      const body: any = req.body;
      const processoRaw = body?.processo;

      if (!processoRaw || typeof processoRaw !== "object") {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          '"processo" é obrigatório para edição',
          null,
        );
        return;
      }

      const dto: UpdateProcessoDto = {
        campus: processoRaw.campus,
        cidadeUF: processoRaw.cidadeUF,
        externalNumber: processoRaw.externalNumber,
        intersticioInicioISO: processoRaw.intersticioInicioISO,
        intersticioFimISO: processoRaw.intersticioFimISO,
        classeOrigem: processoRaw.classeOrigem,
        nivelOrigem: processoRaw.nivelOrigem,
        classeDestino: processoRaw.classeDestino,
        nivelDestino: processoRaw.nivelDestino,
        rscDetails:
          processoRaw.rscDetails && typeof processoRaw.rscDetails === "object"
            ? {
                targetLevel: processoRaw.rscDetails.targetLevel,
                careerEntryDateISO:
                  processoRaw.rscDetails.careerEntryDateISO,
                previousRscGrantedAtISO:
                  processoRaw.rscDetails.previousRscGrantedAtISO,
                activityPeriodStartISO:
                  processoRaw.rscDetails.activityPeriodStartISO,
                activityPeriodEndISO:
                  processoRaw.rscDetails.activityPeriodEndISO,
                truthDeclarationAccepted:
                  processoRaw.rscDetails.truthDeclarationAccepted,
              }
            : undefined,
        fullProfessorDetails:
          processoRaw.fullProfessorDetails &&
          typeof processoRaw.fullProfessorDetails === "object"
            ? {
                evaluationMode: processoRaw.fullProfessorDetails.evaluationMode,
                finalReferenceDateISO:
                  processoRaw.fullProfessorDetails.finalReferenceDateISO,
              }
            : undefined,
      };

      const result = await this.service.editarProcesso(processId, userId, dto);

      return HttpResponse.ok(res, "Processo atualizado com sucesso", result);
    } catch (error) {
      console.error("Erro ao editar processo:", error);

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null,
        );
        return;
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null;

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details,
        );
        return;
      }

      HttpResponse.internalError(res);
      return;
    }
  };

  public excluirProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

      if (!token) {
        HttpResponse.unauthorized(res);
        return;
      }

      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      const userId = Number(payload?.sub);
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res);
        return;
      }

      const processId = Number(req.params.id);
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null,
        );
        return;
      }

      const result = await this.service.excluirProcesso(processId, userId);

      return HttpResponse.ok(res, "Processo excluído com sucesso", result);
    } catch (error) {
      console.error("Erro ao excluir processo:", error);

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null,
        );
        return;
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null;

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details,
        );
        return;
      }

      HttpResponse.internalError(res);
      return;
    }
  };

  public gerarRequerimento: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

      if (!token) {
        HttpResponse.unauthorized(res);
        return;
      }

      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      const userId = Number(payload?.sub);
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res);
        return;
      }

      const processId = Number(req.params.id);
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null,
        );
        return;
      }

      const { filename, pdfBuffer } = await this.service.gerarRequerimento(
        processId,
        userId,
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("X-Process-Id", String(processId));

      res.status(200).send(pdfBuffer);
      return;
    } catch (error) {
      console.error("Erro ao gerar requerimento:", error);

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null,
        );
        return;
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null;

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details,
        );
        return;
      }

      HttpResponse.internalError(res);
      return;
    }
  };

  public enviarProcesso: RequestHandler = async (req, res, _next) => {
    try {
      const auth = req.header("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

      if (!token) {
        HttpResponse.unauthorized(res);
        return;
      }

      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      const userId = Number(payload?.sub);
      if (!userId || Number.isNaN(userId)) {
        HttpResponse.unauthorized(res);
        return;
      }

      const processId = Number(req.params.id);
      if (!processId || Number.isNaN(processId)) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de processo inválido",
          null,
        );
        return;
      }

      const result = await this.service.enviarParaAvaliacao(processId, userId);

      return HttpResponse.ok(
        res,
        "Processo enviado para avaliação da CPPD com sucesso",
        result,
      );
    } catch (error) {
      console.error("Erro ao enviar processo para avaliação:", error);

      if (error instanceof NotFoundError) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          null,
        );
        return;
      }

      if (error instanceof BusinessRuleError) {
        const details = (error as any).details ?? null;

        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          details,
        );
        return;
      }

      HttpResponse.internalError(res);
      return;
    }
  };

  private async deleteStoredFile(fileUrl: string | null | undefined) {
    if (!fileUrl?.startsWith("/uploads/")) return;

    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const relativePath = decodeURIComponent(fileUrl)
      .replace(/^\/+/, "")
      .replace(/\//g, path.sep);
    const filePath = path.resolve(process.cwd(), relativePath);
    if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) return;

    await fs.promises.unlink(filePath).catch(() => undefined);
  }

  public anexarDocumentoEspecifico: RequestHandler = (req, res, _next) => {
    const auth = req.header("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

    let userId = 0;
    try {
      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      userId = Number(payload?.sub);
    } catch {
      HttpResponse.unauthorized(res);
      return;
    }

    const processId = Number(req.params.id);
    if (!userId || !processId || Number.isNaN(processId)) {
      HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        "Parâmetro de processo inválido",
        null,
      );
      return;
    }

    upload.single("file")(req, res, async (uploadError) => {
      if (uploadError) {
        const error = uploadError as any;
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "O arquivo excede o tamanho máximo permitido de 5MB."
            : error.message || "Não foi possível receber o arquivo";
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          message,
          null,
        );
        return;
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Arquivo é obrigatório",
          null,
        );
        return;
      }

      try {
        const result = await this.service.anexarDocumentoEspecifico({
          processId,
          userId,
          kind: req.params.kind,
          originalName: file.originalname,
          storedName: file.filename,
          webUrl: `/uploads/${userId}/${processId}/${file.filename}`,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          course: req.body?.course,
          institution: req.body?.institution,
          conclusionDateISO: req.body?.conclusionDate,
        });

        return HttpResponse.ok(res, "Documento anexado com sucesso", result);
      } catch (error) {
        await fs.promises.unlink(file.path).catch(() => undefined);

        if (
          error instanceof NotFoundError ||
          error instanceof BusinessRuleError
        ) {
          HttpResponse.badRequest(
            res,
            StatusCodeDescription.INVALID_INPUT,
            error.message,
            (error as BusinessRuleError).details ?? null,
          );
          return;
        }

        console.error("Erro ao anexar documento do processo:", error);
        HttpResponse.internalError(res);
        return;
      }
    });
  };

  public anexarDocumentoConfigurado: RequestHandler = (req, res, _next) => {
    const auth = req.header("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

    let userId = 0;
    try {
      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      userId = Number(payload?.sub);
    } catch {
      HttpResponse.unauthorized(res);
      return;
    }

    const processId = Number(req.params.id);
    if (!userId || !processId || Number.isNaN(processId)) {
      HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        "Parâmetro de processo inválido",
        null,
      );
      return;
    }

    upload.single("file")(req, res, async (uploadError) => {
      if (uploadError) {
        const error = uploadError as any;
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "O arquivo excede o limite técnico de 100 MB."
            : error.message || "Não foi possível receber o arquivo";
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          message,
          null,
        );
        return;
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Arquivo é obrigatório",
          null,
        );
        return;
      }

      try {
        const result = await this.service.anexarDocumentoConfigurado({
          processId,
          userId,
          requirementCode: req.params.requirementCode,
          originalName: file.originalname,
          storedName: file.filename,
          webUrl: `/uploads/${userId}/${processId}/${file.filename}`,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });

        await this.deleteStoredFile(result.replacedFileUrl);
        return HttpResponse.ok(
          res,
          "Documento anexado com sucesso",
          result.process,
        );
      } catch (error) {
        await fs.promises.unlink(file.path).catch(() => undefined);

        if (
          error instanceof NotFoundError ||
          error instanceof BusinessRuleError
        ) {
          HttpResponse.badRequest(
            res,
            StatusCodeDescription.INVALID_INPUT,
            error.message,
            (error as BusinessRuleError).details ?? null,
          );
          return;
        }

        console.error("Erro ao anexar documento configurado:", error);
        HttpResponse.internalError(res);
        return;
      }
    });
  };

  public removerDocumentoConfigurado: RequestHandler = async (
    req,
    res,
    _next,
  ) => {
    try {
      const auth = req.header("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
      if (!token) {
        HttpResponse.unauthorized(res);
        return;
      }

      const payload = jwt.verify(
        token,
        String(process.env.JWT_ACCESS_SECRET),
      ) as any;
      const userId = Number(payload?.sub);
      const processId = Number(req.params.id);
      const documentId = Number(req.params.documentId);
      if (
        !userId ||
        !processId ||
        !documentId ||
        Number.isNaN(processId) ||
        Number.isNaN(documentId)
      ) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          "Parâmetro de documento inválido",
          null,
        );
        return;
      }

      const result = await this.service.removerDocumentoConfigurado(
        processId,
        userId,
        documentId,
      );
      await this.deleteStoredFile(result.removedFileUrl);
      return HttpResponse.ok(
        res,
        "Documento removido com sucesso",
        result.process,
      );
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof BusinessRuleError
      ) {
        HttpResponse.badRequest(
          res,
          StatusCodeDescription.INVALID_INPUT,
          error.message,
          (error as BusinessRuleError).details ?? null,
        );
        return;
      }

      console.error("Erro ao remover documento configurado:", error);
      HttpResponse.internalError(res);
      return;
    }
  };
}
