import { RequestHandler } from "express";
import { RoleName } from "@prisma/client";
import {
  ProcessoService,
  BusinessRuleError,
  NotFoundError,
} from "../service/processoService";
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse";
import { getCppdAccessScope } from "../middleware/cppdAccessMiddleware";

export class CppdProcessoController {
  constructor(private readonly service: ProcessoService) {}

  private getAuthFromRequest(
    req: any,
  ): { userId: number; selectedRole: RoleName | null } | null {
    const payload = req.user as any;
    if (!payload) return null;

    const userId = Number(payload.sub);
    if (!userId || Number.isNaN(userId)) return null;

    const selectedRole = (payload.selectedRole as RoleName) ?? null;
    return { userId, selectedRole };
  }

  private ensureCppdMember(req: any, res: any): { userId: number } | null {
    const auth = this.getAuthFromRequest(req);
    if (!auth) {
      HttpResponse.unauthorized(res);
      return null;
    }

    if (
      auth.selectedRole !== RoleName.CPPD_MEMBER &&
      auth.selectedRole !== RoleName.CPPD_CENTRAL
    ) {
      HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        "Access allowed only for CPPD members",
        null,
      );
      return null;
    }

    return { userId: auth.userId };
  }

  public listar: RequestHandler = async (req, res) => {
    try {
      const auth = this.ensureCppdMember(req, res);
      if (!auth) return;

      const viewRaw = String(req.query.view ?? "pending").toLowerCase();
      const view = viewRaw === "evaluated" ? "evaluated" : "pending";

      const scope = getCppdAccessScope(req);
      if (!scope) return HttpResponse.unauthorized(res);
      const list = await this.service.listarProcessosCppd(
        view,
        scope.isCentral ? null : scope.campusIds,
      );
      return HttpResponse.ok(
        res,
        "Lista de processos da CPPD recuperada com sucesso",
        list,
      );
    } catch (error) {
      console.error("Erro ao listar processos CPPD:", error);
      HttpResponse.internalError(res);
    }
  };

  public obter: RequestHandler = async (req, res) => {
    try {
      const auth = this.ensureCppdMember(req, res);
      if (!auth) return;

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

      const result = await this.service.obterProcessoCppd(processId);
      return HttpResponse.ok(
        res,
        "Processo da CPPD recuperado com sucesso",
        result,
      );
    } catch (error) {
      console.error("Erro ao obter processo CPPD:", error);

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
    }
  };

  public finalizarAnaliseDocumental: RequestHandler = async (req, res) => {
    try {
      const auth = this.ensureCppdMember(req, res);
      if (!auth) return;

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

      const result = await this.service.finalizarAnaliseDocumentalCppd(
        processId,
        auth.userId,
        req.body,
      );
      return HttpResponse.ok(
        res,
        "Análise documental concluída com sucesso",
        result,
      );
    } catch (error) {
      console.error("Erro ao concluir análise documental:", error);

      if (
        error instanceof NotFoundError ||
        error instanceof BusinessRuleError
      ) {
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
    }
  };

  public obterDetalhesAvaliacao: RequestHandler = async (req, res) => {
    try {
      const auth = this.ensureCppdMember(req, res);
      if (!auth) return;

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

      const data = await this.service.obterDetalhesAvaliacaoCppd(processId);

      return HttpResponse.ok(
        res,
        "Detalhes da avaliação recuperados com sucesso",
        data,
      );
    } catch (error) {
      console.error("Erro ao obter detalhes da avaliação:", error);
      HttpResponse.internalError(res);
    }
  };
}
