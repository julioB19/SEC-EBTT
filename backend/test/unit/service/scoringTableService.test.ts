import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { ScoringTableService } from "../../../src/service/scoringTableService"
import { ScoringTableRepository } from "../../../src/repository/scoringTableRepository"
import { BusinessRuleError } from "../../../src/service/processoService"

describe("ScoringTableService", () => {
  let repo: jest.Mocked<ScoringTableRepository>
  let service: ScoringTableService
  const table = { idScoringTable: 1, name: "Tabela", status: "DRAFT", startsOn: null, endsOn: null }

  beforeEach(() => {
    repo = {
      createTable: jest.fn(), findVigente: jest.fn(), findByIdWithStructure: jest.fn(),
      findManyAdmin: jest.fn(), findById: jest.fn(), updateTable: jest.fn(),
      countProcessesByTableId: jest.fn(), softDeleteTable: jest.fn(), findNodeById: jest.fn(),
      createNode: jest.fn()
    } as any
    service = new ScoringTableService(repo)
  })

  test("cria tabela convertendo datas", async () => {
    repo.createTable.mockResolvedValue({ ...table, startsOn: new Date("2025-01-01"), endsOn: null } as any)
    const result = await service.criarTabelaPontuacao({ name: "Tabela", startsOn: "2025-01-01", endsOn: null })
    expect(repo.createTable).toHaveBeenCalledWith({
      name: "Tabela", startsOn: new Date("2025-01-01"), endsOn: null
    })
    expect(result.idScoringTable).toBe(1)
  })

  test("rejeita vigência invertida", async () => {
    await expect(service.criarTabelaPontuacao({
      name: "X", startsOn: "2025-02-01", endsOn: "2025-01-01"
    })).rejects.toBeInstanceOf(BusinessRuleError)
    expect(repo.createTable).not.toHaveBeenCalled()
  })

  test("não reativa tabela inativa", async () => {
    repo.findById.mockResolvedValue({ ...table, status: "INACTIVE" } as any)
    await expect(service.atualizarTabelaAdmin(1, { status: "ACTIVE" } as any))
      .rejects.toThrow("Tabela inativada não pode ser reativada")
  })

  test("exclusão exige rascunho sem processos", async () => {
    repo.findById.mockResolvedValue(table as any)
    repo.countProcessesByTableId.mockResolvedValue(2)
    await expect(service.excluirTabelaRascunhoAdmin(1)).rejects.toThrow("existem processos vinculados")
    repo.countProcessesByTableId.mockResolvedValue(0)
    repo.softDeleteTable.mockResolvedValue({ ...table, deletedDate: new Date() } as any)
    await expect(service.excluirTabelaRascunhoAdmin(1)).resolves.toEqual({
      idScoringTable: 1, deletedDate: expect.any(Date)
    })
  })

  test("inativa tabela ativa e encerra vigência", async () => {
    const now = new Date("2025-06-01")
    repo.findById.mockResolvedValue({ ...table, status: "ACTIVE", endsOn: null } as any)
    repo.countProcessesByTableId.mockResolvedValue(1)
    repo.updateTable.mockResolvedValue({ ...table, status: "INACTIVE", endsOn: now } as any)
    await service.inativarTabelaAdmin(1, now)
    expect(repo.updateTable).toHaveBeenCalledWith(1, { status: "INACTIVE", endsOn: now })
  })

  test("criação de bloco valida rascunho, pai e fórmula", async () => {
    repo.findById.mockResolvedValue(table as any)
    await expect(service.criarBloco(1, { name: "B", code: "B", hasFormula: true } as any))
      .rejects.toThrow("formulaExpression")
    repo.findNodeById.mockResolvedValue({ scoringTableId: 2 } as any)
    await expect(service.criarBloco(1, { name: "B", code: "B", parentId: 9 } as any))
      .rejects.toThrow("mesma tabela")
  })
})
