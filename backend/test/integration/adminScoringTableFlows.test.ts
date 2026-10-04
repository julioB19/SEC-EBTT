import type { Server } from "http"
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "mysql://root:root123@localhost:3306/TCC_TEST"

describe("API HTTP - administração das tabelas de pontuação", () => {
  let server: Server
  let baseUrl: string
  let adminToken: string
  let cppdToken: string

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL
    process.env.JWT_ACCESS_SECRET = "integration-access-secret"
    process.env.JWT_REFRESH_SECRET = "integration-refresh-secret"
    process.env.JWT_ACCESS_EXPIRATION = "1h"
    process.env.JWT_REFRESH_EXPIRATION = "7d"

    const { default: app } = await import("../../src/app")
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve())
    })
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Servidor HTTP de teste indisponível")
    baseUrl = `http://127.0.0.1:${address.port}`

    const login = await request("/login", {
      method: "POST",
      body: { cpf: "81188057006", password: "Admin@123456" },
    })
    expect(login.status).toBe(200)
    adminToken = login.data.data.accessToken

    const cppdLogin = await request("/login", {
      method: "POST",
      body: { cpf: "58315013610", password: "CppdCentral@123456" },
    })
    expect(cppdLogin.status).toBe(200)
    cppdToken = cppdLogin.data.data.accessToken
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    const { prisma } = await import("../../src/infra/prismaClient")
    await prisma.$disconnect()
  })

  async function request(
    path: string,
    options: { method?: string; token?: string; body?: unknown } = {},
  ) {
    const headers: Record<string, string> = {}
    if (options.token) headers.Authorization = `Bearer ${options.token}`
    if (options.body !== undefined) headers["Content-Type"] = "application/json"
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const data: any = await response.json()
    return { status: response.status, data }
  }

  it("mantém uma tabela em rascunho com hierarquia e itens pela API administrativa", async () => {
    const runId = Date.now()

    const currentTable = await request("/cppd/tabelas-pontuacao/vigente", { token: cppdToken })
    expect(currentTable.status).toBe(200)
    expect(currentTable.data.data.table.status).toBe("ACTIVE")
    expect(Array.isArray(currentTable.data.data.nodes)).toBe(true)
    expect(Array.isArray(currentTable.data.data.items)).toBe(true)

    const invalidFilters = await request("/admin/tabelas-pontuacao?status=UNKNOWN", {
      token: adminToken,
    })
    expect(invalidFilters.status).toBe(400)

    const invalidId = await request("/admin/tabelas-pontuacao/invalida", { token: adminToken })
    expect(invalidId.status).toBe(400)

    const invalidIdentifierRequests = await Promise.all([
      request("/admin/tabelas-pontuacao/invalida", {
        method: "PATCH",
        token: adminToken,
        body: { name: "Não deve atualizar" },
      }),
      request("/admin/tabelas-pontuacao/invalida", { method: "DELETE", token: adminToken }),
      request("/admin/tabelas-pontuacao/invalida/inativar", {
        method: "POST",
        token: adminToken,
      }),
      request("/admin/tabelas-pontuacao/invalida/blocos", {
        method: "POST",
        token: adminToken,
        body: { name: "Bloco inválido" },
      }),
      request("/admin/tabelas-pontuacao/blocos/invalido/pai", {
        method: "PATCH",
        token: adminToken,
        body: { parentId: null },
      }),
      request("/admin/tabelas-pontuacao/blocos/invalido/itens", {
        method: "POST",
        token: adminToken,
        body: { description: "Item inválido", points: 1 },
      }),
      request("/admin/tabelas-pontuacao/invalida/estrutura", { token: adminToken }),
      request("/admin/tabelas-pontuacao/blocos/invalido", {
        method: "PATCH",
        token: adminToken,
        body: { name: "Inválido" },
      }),
      request("/admin/tabelas-pontuacao/itens/invalido", {
        method: "PATCH",
        token: adminToken,
        body: { description: "Inválido" },
      }),
    ])
    expect(invalidIdentifierRequests.every((response) => response.status === 400)).toBe(true)

    const invalidPeriod = await request("/admin/tabelas-pontuacao", {
      method: "POST",
      token: adminToken,
      body: {
        name: `Tabela inválida ${runId}`,
        purpose: "OTHER",
        startsOn: "2026-12-31",
        endsOn: "2026-01-01",
      },
    })
    expect(invalidPeriod.status).toBe(400)
    expect(invalidPeriod.data.message).toMatch(/data final/i)

    const created = await request("/admin/tabelas-pontuacao", {
      method: "POST",
      token: adminToken,
      body: {
        name: `Tabela Integração ${runId}`,
        purpose: "OTHER",
        minRequiredPoints: "80,50",
        startsOn: "2026-01-01",
        endsOn: "2027-12-31",
      },
    })
    expect(created.status).toBe(201)
    expect(created.data.data).toMatchObject({
      name: `Tabela Integração ${runId}`,
      purpose: "OTHER",
      status: "DRAFT",
    })
    const tableId = created.data.data.idScoringTable as number

    const listed = await request(
      "/admin/tabelas-pontuacao?status=DRAFT&startsOnFrom=2025-01-01&startsOnTo=2027-01-01",
      { token: adminToken },
    )
    expect(listed.status).toBe(200)
    expect(listed.data.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ idScoringTable: tableId })]),
    )

    const loaded = await request(`/admin/tabelas-pontuacao/${tableId}`, { token: adminToken })
    expect(loaded.status).toBe(200)
    expect(loaded.data.data).toMatchObject({ table: { idScoringTable: tableId }, nodes: [], items: [] })

    const updated = await request(`/admin/tabelas-pontuacao/${tableId}`, {
      method: "PATCH",
      token: adminToken,
      body: {
        name: `Tabela Integração Atualizada ${runId}`,
        minRequiredPoints: 90,
        startsOn: "2026-02-01",
        endsOn: "2028-01-31",
      },
    })
    expect(updated.status).toBe(200)
    expect(updated.data.data).toMatchObject({
      idScoringTable: tableId,
      name: `Tabela Integração Atualizada ${runId}`,
      status: "DRAFT",
    })

    const root = await request(`/admin/tabelas-pontuacao/${tableId}/blocos`, {
      method: "POST",
      token: adminToken,
      body: {
        name: "Bloco raiz de integração",
        code: "ROOT_INT",
        sortOrder: 1,
        hasFormula: true,
        formulaExpression: "ITEM_A + ITEM_B",
        maxPoints: 100,
      },
    })
    expect(root.status).toBe(201)
    const rootId = root.data.data.idScoringNode as number

    const child = await request(`/admin/tabelas-pontuacao/${tableId}/blocos`, {
      method: "POST",
      token: adminToken,
      body: {
        name: "Bloco filho de integração",
        code: "CHILD_INT",
        sortOrder: 2,
        parentId: rootId,
      },
    })
    expect(child.status).toBe(201)
    const childId = child.data.data.idScoringNode as number

    const selfParent = await request(`/admin/tabelas-pontuacao/blocos/${childId}/pai`, {
      method: "PATCH",
      token: adminToken,
      body: { parentId: childId },
    })
    expect(selfParent.status).toBe(400)
    expect(selfParent.data.message).toMatch(/pai de si mesmo/i)

    const detached = await request(`/admin/tabelas-pontuacao/blocos/${childId}/pai`, {
      method: "PATCH",
      token: adminToken,
      body: { parentId: null },
    })
    expect(detached.status).toBe(200)
    expect(detached.data.data.parentId).toBeNull()

    const item = await request(`/admin/tabelas-pontuacao/blocos/${rootId}/itens`, {
      method: "POST",
      token: adminToken,
      body: {
        description: "Atividade administrativa de integração",
        unit: "atividade",
        points: 5,
        hasMaxPoints: true,
        maxPoints: 20,
        formulaKey: "ITEM_A",
        factor: 1.5,
        weight: 2,
        maxQuantity: 4,
      },
    })
    expect(item.status).toBe(201)
    const itemId = item.data.data.idScoringItem as number

    const invalidItem = await request(`/admin/tabelas-pontuacao/blocos/${rootId}/itens`, {
      method: "POST",
      token: adminToken,
      body: {
        description: "Item sem limite obrigatório",
        points: 1,
        hasMaxPoints: true,
      },
    })
    expect(invalidItem.status).toBe(400)

    const nodeUpdated = await request(`/admin/tabelas-pontuacao/blocos/${childId}`, {
      method: "PATCH",
      token: adminToken,
      body: {
        name: "Bloco filho atualizado",
        code: "CHILD_UPDATED",
        sortOrder: 3,
        parentId: rootId,
        hasFormula: false,
        formulaExpression: null,
        maxPoints: null,
      },
    })
    expect(nodeUpdated.status).toBe(200)
    expect(nodeUpdated.data.data).toMatchObject({
      idScoringNode: childId,
      name: "Bloco filho atualizado",
      parentId: rootId,
    })

    const itemUpdated = await request(`/admin/tabelas-pontuacao/itens/${itemId}`, {
      method: "PATCH",
      token: adminToken,
      body: {
        description: "Atividade administrativa atualizada",
        unit: "registro",
        points: 6,
        hasMaxPoints: true,
        maxPoints: 24,
        formulaKey: "ITEM_B",
        factor: 2,
        weight: 1.5,
        maxQuantity: 4,
      },
    })
    expect(itemUpdated.status).toBe(200)
    expect(itemUpdated.data.data).toMatchObject({
      idScoringItem: itemId,
      description: "Atividade administrativa atualizada",
      formulaKey: "ITEM_B",
    })

    const invalidNodeUpdate = await request(`/admin/tabelas-pontuacao/blocos/${childId}`, {
      method: "PATCH",
      token: adminToken,
      body: { hasFormula: true, formulaExpression: "" },
    })
    expect(invalidNodeUpdate.status).toBe(400)

    const invalidItemUpdate = await request(`/admin/tabelas-pontuacao/itens/${itemId}`, {
      method: "PATCH",
      token: adminToken,
      body: { hasMaxPoints: true, maxPoints: null },
    })
    expect(invalidItemUpdate.status).toBe(400)

    const invalidGraph = await request(`/admin/tabelas-pontuacao/${tableId}/bloco`, {
      method: "POST",
      token: adminToken,
      body: {
        blockName: "Bloco inválido",
        nodes: [
          { draftId: "a", name: "A", code: "DUPLICADO", items: [] },
          { draftId: "b", name: "B", code: "DUPLICADO", items: [] },
        ],
      },
    })
    expect(invalidGraph.status).toBe(400)
    expect(invalidGraph.data.message).toMatch(/código duplicado/i)

    const block = await request(`/admin/tabelas-pontuacao/${tableId}/bloco`, {
      method: "POST",
      token: adminToken,
      body: {
        blockName: "Bloco transacional",
        nodes: [
          {
            draftId: "parent",
            name: "Pai transacional",
            code: "TX_PARENT",
            sortOrder: 10,
            hasFormula: false,
            items: [
              {
                description: "Item transacional",
                unit: "unidade",
                points: "3",
                hasMaxPoints: false,
                formulaKey: "TX_ITEM",
              },
            ],
          },
          {
            draftId: "child",
            name: "Filho transacional",
            code: "TX_CHILD",
            parentDraftId: "parent",
            sortOrder: 11,
            hasFormula: true,
            formulaExpression: "TX_ITEM",
            items: [],
          },
        ],
      },
    })
    expect(block.status).toBe(201)
    expect(block.data.data.nodeMap).toHaveLength(2)

    const structure = await request(`/admin/tabelas-pontuacao/${tableId}/estrutura`, {
      token: adminToken,
    })
    expect(structure.status).toBe(200)
    expect(structure.data.data.table.idScoringTable).toBe(tableId)
    expect(structure.data.data.nodes.length).toBeGreaterThanOrEqual(4)
    expect(structure.data.data.items.length).toBeGreaterThanOrEqual(2)

    const deleted = await request(`/admin/tabelas-pontuacao/${tableId}`, {
      method: "DELETE",
      token: adminToken,
    })
    expect(deleted.status).toBe(200)
    expect(deleted.data.data).toMatchObject({ idScoringTable: tableId })

    const missing = await request(`/admin/tabelas-pontuacao/${tableId}`, { token: adminToken })
    expect(missing.status).toBe(400)
    expect(missing.data.message).toMatch(/não encontrada/i)

    const activeTable = await request("/admin/tabelas-pontuacao", {
      method: "POST",
      token: adminToken,
      body: {
        name: `Tabela ativa sem processos ${runId}`,
        purpose: "OTHER",
        startsOn: "2030-01-01",
        minRequiredPoints: null,
      },
    })
    expect(activeTable.status).toBe(201)
    const activeTableId = activeTable.data.data.idScoringTable as number
    const activated = await request(`/admin/tabelas-pontuacao/${activeTableId}`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "ACTIVE" },
    })
    expect(activated.status).toBe(200)

    const deleteActive = await request(`/admin/tabelas-pontuacao/${activeTableId}`, {
      method: "DELETE",
      token: adminToken,
    })
    expect(deleteActive.status).toBe(400)
    expect(deleteActive.data.message).toMatch(/rascunho/i)

    const inactiveWithoutProcesses = await request(
      `/admin/tabelas-pontuacao/${activeTableId}/inativar`,
      { method: "POST", token: adminToken },
    )
    expect(inactiveWithoutProcesses.status).toBe(400)
    expect(inactiveWithoutProcesses.data.message).toMatch(/não há processos vinculados/i)

    const archived = await request(`/admin/tabelas-pontuacao/${activeTableId}`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "INACTIVE" },
    })
    expect(archived.status).toBe(200)
    expect(archived.data.data.status).toBe("INACTIVE")
  }, 60000)
})
