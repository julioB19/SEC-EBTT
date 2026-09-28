import { ProcessConfigurationError } from "../exception/process-configuration-error";
import { ProcessConfigurationService } from "../service/processConfigurationService";
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse";

export class ProcessConfigurationController {
  constructor(private readonly service = new ProcessConfigurationService()) {}

  listProcessTypes = async (_req: any, res: any) => {
    try {
      return HttpResponse.ok(
        res,
        "Tipos de processo recuperados",
        await this.service.listProcessTypes(),
      );
    } catch (error) {
      return this.handleError(res, error);
    }
  };

  createProcessType = async (req: any, res: any) => {
    try {
      return HttpResponse.created(
        res,
        "Tipo de processo criado",
        await this.service.createProcessType(req.body),
      );
    } catch (error) {
      return this.handleError(res, error);
    }
  };

  createVersion = async (req: any, res: any) => {
    try {
      return HttpResponse.created(
        res,
        "Nova versão criada",
        await this.service.createVersion(
          Number(req.params.processTypeId),
          req.body,
        ),
      );
    } catch (error) {
      return this.handleError(res, error);
    }
  };

  updateStatus = async (req: any, res: any) => {
    try {
      return HttpResponse.ok(
        res,
        "Status atualizado",
        await this.service.updateStatus(
          Number(req.params.processTypeId),
          req.body.active,
        ),
      );
    } catch (error) {
      return this.handleError(res, error);
    }
  };

  private handleError(res: any, error: unknown) {
    if (error instanceof ProcessConfigurationError) {
      if (error.kind === "NOT_FOUND") {
        return HttpResponse.notFound(
          res,
          StatusCodeDescription.RESOURCE_NOT_FOUND,
          error.message,
          null,
        );
      }
      const status =
        error.kind === "CONFLICT"
          ? StatusCodeDescription.EXISTING_RESOURCE
          : StatusCodeDescription.INVALID_INPUT;
      return HttpResponse.badRequest(res, status, error.message, null);
    }
    if ((error as any)?.code === "P2002") {
      return HttpResponse.badRequest(
        res,
        StatusCodeDescription.EXISTING_RESOURCE,
        "Já existe um registro com estes dados",
        null,
      );
    }
    console.error("Falha na configuração dos tipos de processo:", error);
    return HttpResponse.internalError(res);
  }
}
