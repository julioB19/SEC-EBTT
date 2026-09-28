import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { RoleName } from "@prisma/client"
import { CppdAccessRepository } from "../../../src/repository/cppdAccessRepository"
import { CppdAccessService } from "../../../src/service/cppdAccessService"

describe("CppdAccessService", () => {
  let repository: jest.Mocked<CppdAccessRepository>
  let service: CppdAccessService

  beforeEach(() => {
    repository = {
      findActiveCampusIdsForUser: jest.fn(),
      hasProcessInCampuses: jest.fn(),
      hasTeacherInCampuses: jest.fn()
    } as any
    service = new CppdAccessService(repository)
  })

  test("libera acesso institucional para a CPPD Central", async () => {
    const scope = await service.resolveScope(7, RoleName.CPPD_CENTRAL)

    expect(scope).toEqual({
      userId: 7,
      selectedRole: RoleName.CPPD_CENTRAL,
      isCentral: true,
      campusIds: []
    })
    expect(repository.findActiveCampusIdsForUser).not.toHaveBeenCalled()
  })

  test("limita o membro local aos campi vinculados à comissão ativa", async () => {
    repository.findActiveCampusIdsForUser.mockResolvedValue([2, 5])

    const scope = await service.resolveScope(9, RoleName.CPPD_MEMBER)

    expect(scope.isCentral).toBe(false)
    expect(scope.campusIds).toEqual([2, 5])
  })

  test("bloqueia membro local sem vínculo ativo com comissão", async () => {
    repository.findActiveCampusIdsForUser.mockResolvedValue([])

    await expect(service.resolveScope(9, RoleName.CPPD_MEMBER)).rejects.toThrow(
      "não possui vínculo ativo"
    )
  })

  test("bloqueia processo de outro campus", async () => {
    repository.hasProcessInCampuses.mockResolvedValue(false)

    await expect(
      service.assertProcessAccess(
        { userId: 9, selectedRole: RoleName.CPPD_MEMBER, isCentral: false, campusIds: [2] },
        44
      )
    ).rejects.toThrow("não pertence ao campus")
  })

  test("bloqueia docente de outro campus", async () => {
    repository.hasTeacherInCampuses.mockResolvedValue(false)

    await expect(
      service.assertTeacherAccess(
        { userId: 9, selectedRole: RoleName.CPPD_MEMBER, isCentral: false, campusIds: [2] },
        30
      )
    ).rejects.toThrow("não pertence ao campus")
  })

  test("CPPD Central não consulta campus para processo ou docente", async () => {
    const scope = {
      userId: 7,
      selectedRole: RoleName.CPPD_CENTRAL,
      isCentral: true,
      campusIds: []
    }

    await service.assertProcessAccess(scope, 44)
    await service.assertTeacherAccess(scope, 30)

    expect(repository.hasProcessInCampuses).not.toHaveBeenCalled()
    expect(repository.hasTeacherInCampuses).not.toHaveBeenCalled()
  })
})
