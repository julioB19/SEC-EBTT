import { RoleName } from "@prisma/client"
import { CppdAccessDenied } from "../exception/cppd-access-denied"
import { CppdAccessRepository } from "../repository/cppdAccessRepository"
import { CppdAccessScope } from "../type/cppdAccess"

export class CppdAccessService {
  constructor(private readonly repository = new CppdAccessRepository()) {}

  async resolveScope(
    userId: number,
    selectedRole: RoleName | null | undefined,
    at = new Date()
  ): Promise<CppdAccessScope> {
    if (selectedRole === RoleName.CPPD_CENTRAL) {
      return {
        userId,
        selectedRole: RoleName.CPPD_CENTRAL,
        isCentral: true,
        campusIds: []
      }
    }

    if (selectedRole !== RoleName.CPPD_MEMBER) {
      throw new CppdAccessDenied("Selecione um perfil da CPPD para acessar este recurso")
    }

    const campusIds = await this.repository.findActiveCampusIdsForUser(userId, at)
    if (!campusIds.length) {
      throw new CppdAccessDenied(
        "O membro da CPPD não possui vínculo ativo com uma comissão de campus"
      )
    }

    return {
      userId,
      selectedRole: RoleName.CPPD_MEMBER,
      isCentral: false,
      campusIds
    }
  }

  async assertProcessAccess(scope: CppdAccessScope, processId: number): Promise<void> {
    if (scope.isCentral) return
    const allowed = await this.repository.hasProcessInCampuses(processId, scope.campusIds)
    if (!allowed) {
      throw new CppdAccessDenied("Este processo não pertence ao campus do membro da CPPD")
    }
  }

  async assertTeacherAccess(scope: CppdAccessScope, userId: number): Promise<void> {
    if (scope.isCentral) return
    const allowed = await this.repository.hasTeacherInCampuses(userId, scope.campusIds)
    if (!allowed) {
      throw new CppdAccessDenied("Este docente não pertence ao campus do membro da CPPD")
    }
  }
}
