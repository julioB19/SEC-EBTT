import { CppdManagementError } from "../exception/cppd-management-error"
import { CppdManagementService } from "../service/cppdManagementService"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"

export class CppdManagementController {
  constructor(private readonly service = new CppdManagementService()) {}

  listCampuses = async (_req: any, res: any) => {
    try {
      return HttpResponse.ok(res, "Campi recuperados", await this.service.listCampuses())
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  createCampus = async (req: any, res: any) => {
    try {
      return HttpResponse.created(res, "Campus criado", await this.service.createCampus(req.body))
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  updateCampus = async (req: any, res: any) => {
    try {
      const data = await this.service.updateCampus(Number(req.params.campusId), req.body)
      return HttpResponse.ok(res, "Campus atualizado", data)
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  listCommissions = async (req: any, res: any) => {
    try {
      const campusId = req.query.campusId ? Number(req.query.campusId) : undefined
      const data = await this.service.listCommissions(campusId)
      return HttpResponse.ok(res, "Comissões recuperadas", data)
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  createCommission = async (req: any, res: any) => {
    try {
      const data = await this.service.createCommission(req.body)
      return HttpResponse.created(res, "Comissão criada", data)
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  updateCommission = async (req: any, res: any) => {
    try {
      const data = await this.service.updateCommission(Number(req.params.commissionId), req.body)
      return HttpResponse.ok(res, "Comissão atualizada", data)
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  listMemberCandidates = async (_req: any, res: any) => {
    try {
      const data = await this.service.listMemberCandidates()
      return HttpResponse.ok(res, "Membros disponíveis recuperados", data)
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  addMember = async (req: any, res: any) => {
    try {
      const data = await this.service.addMember(Number(req.params.commissionId), req.body)
      return HttpResponse.created(res, "Membro vinculado", data)
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  updateMember = async (req: any, res: any) => {
    try {
      const data = await this.service.updateMember(
        Number(req.params.commissionId),
        Number(req.params.personId),
        req.body
      )
      return HttpResponse.ok(res, "Vínculo atualizado", data)
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  removeMember = async (req: any, res: any) => {
    try {
      const data = await this.service.removeMember(
        Number(req.params.commissionId),
        Number(req.params.personId)
      )
      return HttpResponse.ok(res, "Membro removido", data)
    } catch (error) {
      return this.handleError(res, error)
    }
  }

  private handleError(res: any, error: unknown) {
    if (error instanceof CppdManagementError) {
      if (error.kind === "NOT_FOUND") {
        return HttpResponse.notFound(res, StatusCodeDescription.RESOURCE_NOT_FOUND, error.message, null)
      }
      return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error.message, null)
    }
    if ((error as any)?.code === "P2002") {
      return HttpResponse.badRequest(
        res,
        StatusCodeDescription.EXISTING_RESOURCE,
        "Já existe um registro com estes dados",
        null
      )
    }
    console.error("Falha na administração da CPPD:", error)
    return HttpResponse.internalError(res)
  }
}
