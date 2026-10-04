import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import {
  AcceptanceStatus,
  CommissionStatus,
  ProcessStatus,
  ProcessTypeCategory,
  SpecialCommissionMemberOrigin,
  SpecialCommissionMemberRole,
  SpecialCommissionType
} from "@prisma/client"
import { SpecialCommissionRepository } from "../../../src/repository/specialCommissionRepository"
import { SpecialCommissionService } from "../../../src/service/specialCommissionService"

describe("SpecialCommissionService", () => {
  let repository: jest.Mocked<SpecialCommissionRepository>
  let service: SpecialCommissionService

  const process = {
    idProcess: 12,
    status: ProcessStatus.SUBMITTED,
    type: "PROGRESSAO",
    campus: "Campus Alegrete",
    cidadeUF: "Alegrete/RS",
    submittedAt: new Date(),
    updatedAt: new Date(),
    user: { name: "Docente", docente: { siape: "123" } },
    processTypeConfig: {
      code: "RSC",
      name: "RSC",
      category: ProcessTypeCategory.RSC,
      requiresCommittee: true
    }
  }

  const commission = {
    idSpecialCommission: 9,
    processId: process.idProcess,
    type: SpecialCommissionType.RSC,
    status: CommissionStatus.DRAFT,
    ordinance: null,
    ordinanceDate: null,
    members: []
  }

  const acceptedRscMembers = () => [
    {
      idSpecialCommissionMember: 1,
      acceptanceStatus: AcceptanceStatus.ACCEPTED,
      role: SpecialCommissionMemberRole.PRESIDENT,
      origin: SpecialCommissionMemberOrigin.INTERNAL,
      person: { name: "Avaliador interno", email: "interno@exemplo.com" },
      individualEvaluations: []
    },
    ...[2, 3, 4].map(id => ({
      idSpecialCommissionMember: id,
      acceptanceStatus: AcceptanceStatus.ACCEPTED,
      role: SpecialCommissionMemberRole.MEMBER,
      origin: SpecialCommissionMemberOrigin.EXTERNAL,
      person: { name: `Avaliador externo ${id}`, email: `externo${id}@exemplo.com` },
      individualEvaluations: []
    }))
  ]

  beforeEach(() => {
    repository = {
      findProcess: jest.fn(),
      findCurrentByProcess: jest.fn(),
      create: jest.fn(),
      updateDetails: jest.fn(),
      findExternalEvaluatorByEmail: jest.fn(),
      findActiveMember: jest.fn(),
      addExternalMember: jest.fn(),
      removeMember: jest.fn(),
      findMember: jest.fn(),
      respondToInvitation: jest.fn(),
      updateStatus: jest.fn(),
      finalizeDecision: jest.fn(),
      listAssignmentsForUser: jest.fn()
    } as any
    service = new SpecialCommissionService(repository)
    repository.findProcess.mockResolvedValue(process as any)
    repository.findCurrentByProcess.mockResolvedValue(commission as any)
  })

  test("rejeita comissão em tipo de processo não configurado para comissão", async () => {
    repository.findProcess.mockResolvedValue({
      ...process,
      processTypeConfig: { ...process.processTypeConfig, requiresCommittee: false }
    } as any)

    await expect(service.getForProcess(process.idProcess)).rejects.toThrow(
      "Este tipo de processo não utiliza comissão especial"
    )
  })

  test("localiza avaliador pelo e-mail e cria a associação com avaliação individual", async () => {
    repository.findExternalEvaluatorByEmail.mockResolvedValue({
      idUser: 30,
      personId: 44,
      person: { idPerson: 44 },
      externalEvaluator: { idExternalEvaluator: 3 }
    } as any)
    repository.findActiveMember.mockResolvedValue(null)

    await service.addExternalMember(process.idProcess, 2, {
      email: " Avaliador@EXEMPLO.COM ",
      role: SpecialCommissionMemberRole.PRIMARY
    })

    expect(repository.findExternalEvaluatorByEmail).toHaveBeenCalledWith("avaliador@exemplo.com")
    expect(repository.addExternalMember).toHaveBeenCalledWith(
      expect.objectContaining({
        processId: process.idProcess,
        specialCommissionId: commission.idSpecialCommission,
        personId: 44,
        commissionType: SpecialCommissionType.RSC,
        role: SpecialCommissionMemberRole.PRIMARY,
        changedById: 2
      })
    )
  })

  test("não permite o mesmo avaliador duas vezes na comissão", async () => {
    repository.findExternalEvaluatorByEmail.mockResolvedValue({
      personId: 44,
      person: { idPerson: 44 }
    } as any)
    repository.findActiveMember.mockResolvedValue({ idSpecialCommissionMember: 5 } as any)

    await expect(service.addExternalMember(process.idProcess, 2, { email: "avaliador@exemplo.com" })).rejects.toThrow(
      "Este avaliador já pertence à comissão"
    )
    expect(repository.addExternalMember).not.toHaveBeenCalled()
  })

  test("exige portaria e aceite de todos para ativar", async () => {
    await expect(service.updateStatus(process.idProcess, 2, { status: CommissionStatus.ACTIVE })).rejects.toThrow(
      "Informe a portaria"
    )

    repository.findCurrentByProcess.mockResolvedValue({
      ...commission,
      ordinance: "Portaria 10/2026",
      ordinanceDate: new Date(),
      members: acceptedRscMembers().map((member, index) =>
        index === 3 ? { ...member, acceptanceStatus: AcceptanceStatus.PENDING } : member
      )
    } as any)

    await expect(service.updateStatus(process.idProcess, 2, { status: CommissionStatus.ACTIVE })).rejects.toThrow(
      "Todos os membros precisam aceitar"
    )
  })

  test("exige um membro interno e três externos para ativar comissão RSC", async () => {
    repository.findCurrentByProcess.mockResolvedValue({
      ...commission,
      ordinance: "Portaria 10/2026",
      ordinanceDate: new Date(),
      members: [acceptedRscMembers()[0]]
    } as any)

    await expect(
      service.updateStatus(process.idProcess, 2, { status: CommissionStatus.ACTIVE })
    ).rejects.toThrow("um membro interno e três externos")
    expect(repository.updateStatus).not.toHaveBeenCalled()
  })

  test("ativa a comissão quando documentação e aceites estão completos", async () => {
    repository.findCurrentByProcess.mockResolvedValue({
      ...commission,
      ordinance: "Portaria 10/2026",
      ordinanceDate: new Date(),
      members: acceptedRscMembers()
    } as any)

    await service.updateStatus(process.idProcess, 2, { status: CommissionStatus.ACTIVE })

    expect(repository.updateStatus).toHaveBeenCalledWith(expect.objectContaining({
      commissionId: commission.idSpecialCommission,
      processId: process.idProcess,
      status: CommissionStatus.ACTIVE,
      changedById: 2
    }))
  })

  test("conclui comissão ativa somente após todos os pareceres", async () => {
    repository.findCurrentByProcess.mockResolvedValue({
      ...commission,
      status: CommissionStatus.ACTIVE,
      ordinance: "Portaria 10/2026",
      ordinanceDate: new Date(),
      members: [
        {
          idSpecialCommissionMember: 5,
          acceptanceStatus: AcceptanceStatus.ACCEPTED,
          acceptedAt: new Date(),
          role: SpecialCommissionMemberRole.MEMBER,
          origin: "EXTERNAL",
          sortOrder: 0,
          person: { name: "Avaliador", email: "avaliador@exemplo.com" },
          individualEvaluations: [{ status: "DRAFT", result: null }]
        }
      ]
    } as any)

    await expect(
      service.updateStatus(process.idProcess, 2, { status: CommissionStatus.COMPLETED })
    ).rejects.toThrow("Todos os membros precisam enviar")

    repository.findCurrentByProcess.mockResolvedValue({
      ...commission,
      status: CommissionStatus.ACTIVE,
      ordinance: "Portaria 10/2026",
      ordinanceDate: new Date(),
      members: [
        {
          idSpecialCommissionMember: 5,
          acceptanceStatus: AcceptanceStatus.ACCEPTED,
          acceptedAt: new Date(),
          role: SpecialCommissionMemberRole.MEMBER,
          origin: "EXTERNAL",
          sortOrder: 0,
          person: { name: "Avaliador", email: "avaliador@exemplo.com" },
          individualEvaluations: [{
            status: "SUBMITTED",
            result: "DEFERRED",
            recognizedPoints: 65,
            opinionText: "Parecer",
            submittedAt: new Date()
          }]
        }
      ]
    } as any)

    await service.updateStatus(process.idProcess, 2, { status: CommissionStatus.COMPLETED })
    expect(repository.updateStatus).toHaveBeenCalledWith(expect.objectContaining({
      commissionId: commission.idSpecialCommission,
      processId: process.idProcess,
      status: CommissionStatus.COMPLETED,
      changedById: 2
    }))
  })

  test("somente o usuário vinculado à pessoa pode responder ao convite", async () => {
    repository.findMember.mockResolvedValue({
      acceptanceStatus: AcceptanceStatus.PENDING,
      person: { users: [{ idUser: 77 }] },
      specialCommission: { status: CommissionStatus.DRAFT }
    } as any)

    await expect(service.respond(88, 5, { response: AcceptanceStatus.ACCEPTED })).rejects.toThrow(
      "Convite de comissão não encontrado"
    )
    expect(repository.respondToInvitation).not.toHaveBeenCalled()
  })

  test("registra a resposta do avaliador e recarrega suas atribuições", async () => {
    repository.findMember.mockResolvedValue({
      acceptanceStatus: AcceptanceStatus.PENDING,
      person: { users: [{ idUser: 77 }] },
      specialCommission: { status: CommissionStatus.DRAFT }
    } as any)
    repository.listAssignmentsForUser.mockResolvedValue([])

    await expect(
      service.respond(77, 5, {
        response: AcceptanceStatus.ACCEPTED,
        absenceOfConflictDeclared: true
      })
    ).resolves.toEqual([])
    expect(repository.respondToInvitation).toHaveBeenCalledWith({
      memberId: 5,
      userId: 77,
      response: AcceptanceStatus.ACCEPTED,
      absenceOfConflictDeclared: true,
      reason: null
    })
  })

  test("impede aceite sem declaração de ausência de conflito", async () => {
    repository.findMember.mockResolvedValue({
      acceptanceStatus: AcceptanceStatus.PENDING,
      person: { users: [{ idUser: 77 }] },
      specialCommission: { status: CommissionStatus.DRAFT }
    } as any)

    await expect(service.respond(77, 5, { response: AcceptanceStatus.ACCEPTED })).rejects.toThrow(
      "Declare a ausência de conflito"
    )
    expect(repository.respondToInvitation).not.toHaveBeenCalled()
  })

  test("registra decisão da CPPD com a média das avaliações concluídas", async () => {
    repository.findProcess.mockResolvedValue({ ...process, status: ProcessStatus.UNDER_REVIEW } as any)
    repository.findCurrentByProcess.mockResolvedValue({
      ...commission,
      status: CommissionStatus.COMPLETED,
      members: [
        {
          person: { name: "Avaliador 1", email: "um@exemplo.com" },
          individualEvaluations: [{ status: "SUBMITTED", recognizedPoints: 70, result: "DEFERRED" }]
        },
        {
          person: { name: "Avaliador 2", email: "dois@exemplo.com" },
          individualEvaluations: [{ status: "SUBMITTED", recognizedPoints: 60, result: "DEFERRED" }]
        }
      ]
    } as any)

    await service.finalizeDecision(process.idProcess, 2, {
      decision: "APPROVED",
      opinionText: " Parecer consolidado favorável. "
    })

    expect(repository.finalizeDecision).toHaveBeenCalledWith({
      processId: process.idProcess,
      decision: "APPROVED",
      opinionText: "Parecer consolidado favorável.",
      finalPoints: "65.00",
      changedById: 2
    })
  })

  test("impede decisão antes da conclusão da comissão", async () => {
    repository.findProcess.mockResolvedValue({ ...process, status: ProcessStatus.UNDER_REVIEW } as any)

    await expect(
      service.finalizeDecision(process.idProcess, 2, {
        decision: "REJECTED",
        opinionText: "Parecer consolidado."
      })
    ).rejects.toThrow("Conclua a comissão especial")
    expect(repository.finalizeDecision).not.toHaveBeenCalled()
  })

  test("impede concessão da Classe Titular antes de 24 meses completos em C4", async () => {
    const procedureGet = jest.fn<() => Promise<any>>()
    procedureGet.mockResolvedValue({ stage: "COMPLETED", currentOutcome: "APPROVED" })
    const fullProfessorProcedure = { get: procedureGet }
    service = new SpecialCommissionService(repository, fullProfessorProcedure as any)
    repository.findProcess.mockResolvedValue({
      ...process,
      status: ProcessStatus.UNDER_REVIEW,
      user: {
        ...process.user,
        docente: {
          siape: "123",
          classLevel: "C4",
          start_interstice: new Date(Date.now() - 23 * 30 * 24 * 60 * 60 * 1000)
        }
      },
      processTypeConfig: {
        ...process.processTypeConfig,
        code: "FULL_PROFESSOR",
        category: ProcessTypeCategory.FULL_PROFESSOR
      }
    } as any)
    repository.findCurrentByProcess.mockResolvedValue({
      ...commission,
      status: CommissionStatus.COMPLETED,
      members: [{
        individualEvaluations: [{ status: "SUBMITTED", result: "APPROVED", recognizedPoints: 120 }]
      }]
    } as any)

    await expect(
      service.finalizeDecision(process.idProcess, 2, {
        decision: "APPROVED",
        opinionText: "Parecer favorável"
      })
    ).rejects.toThrow("24 meses completos em C4")
    expect(repository.finalizeDecision).not.toHaveBeenCalled()
  })
})
