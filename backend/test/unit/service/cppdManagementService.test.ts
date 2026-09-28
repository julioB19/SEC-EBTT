import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import {
  CommissionMembershipType,
  CppdMemberFunction
} from "@prisma/client"
import { CppdManagementRepository } from "../../../src/repository/cppdManagementRepository"
import { CppdManagementService } from "../../../src/service/cppdManagementService"

describe("CppdManagementService", () => {
  let repository: jest.Mocked<CppdManagementRepository>
  let service: CppdManagementService

  const campus = { idCampus: 2, name: "Campus Teste", acronym: "CT", active: true }
  const commission = {
    idCppdCommission: 8,
    campusId: 2,
    ordinance: "Portaria 1",
    mandateStart: null,
    mandateEnd: null,
    validityStart: null,
    validityEnd: null,
    campus,
    members: []
  }

  beforeEach(() => {
    repository = {
      listCampuses: jest.fn(),
      findCampus: jest.fn(),
      createCampus: jest.fn(),
      updateCampus: jest.fn(),
      listCommissions: jest.fn(),
      findCommission: jest.fn(),
      createCommission: jest.fn(),
      updateCommission: jest.fn(),
      listMemberCandidates: jest.fn(),
      findMemberCandidate: jest.fn(),
      upsertMember: jest.fn(),
      updateMember: jest.fn(),
      findMember: jest.fn(),
      removeMember: jest.fn()
    } as any
    service = new CppdManagementService(repository)
  })

  test("normaliza sigla e e-mail ao criar campus", async () => {
    await service.createCampus({
      name: " Campus Novo ",
      acronym: " cn ",
      cppdEmail: " CPPD@IF.EDU.BR "
    })

    expect(repository.createCampus).toHaveBeenCalledWith({
      name: "Campus Novo",
      acronym: "CN",
      cppdEmail: "cppd@if.edu.br",
      active: true
    })
  })

  test("rejeita comissão com vigência invertida", async () => {
    repository.findCampus.mockResolvedValue(campus as any)

    await expect(
      service.createCommission({
        campusId: 2,
        validityStart: new Date("2026-12-01"),
        validityEnd: new Date("2026-01-01")
      })
    ).rejects.toThrow("início da vigência")
    expect(repository.createCommission).not.toHaveBeenCalled()
  })

  test("rejeita criação de comissão em campus inativo", async () => {
    repository.findCampus.mockResolvedValue({ ...campus, active: false } as any)

    await expect(service.createCommission({ campusId: 2 })).rejects.toThrow("campus selecionado está inativo")
  })

  test("vincula membro local e devolve a comissão atualizada", async () => {
    repository.findCommission.mockResolvedValue(commission as any)
    repository.findMemberCandidate.mockResolvedValue({ idPerson: 4 } as any)

    const result = await service.addMember(8, { personId: 4 })

    expect(repository.upsertMember).toHaveBeenCalledWith({
      commissionId: 8,
      personId: 4,
      function: CppdMemberFunction.MEMBER,
      membershipType: CommissionMembershipType.PRIMARY,
      active: true
    })
    expect(result).toEqual(commission)
  })

  test("impede vínculo de pessoa sem perfil local da CPPD", async () => {
    repository.findCommission.mockResolvedValue(commission as any)
    repository.findMemberCandidate.mockResolvedValue(null)

    await expect(service.addMember(8, { personId: 99 })).rejects.toThrow("não possui um usuário ativo")
    expect(repository.upsertMember).not.toHaveBeenCalled()
  })
})
