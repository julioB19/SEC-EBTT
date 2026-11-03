import type { Server } from "http"
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "mysql://root:root123@localhost:3306/TCC_TEST"

describe("API HTTP - administração da CPPD", () => {
  let server: Server
  let baseUrl: string
  let adminToken: string

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL
    const { prisma: fixtureDb } = await import("../../src/infra/prismaClient")
    const fixtureCampus = await fixtureDb.campus.findFirstOrThrow({ where: { acronym: "SM" } })
    await fixtureDb.campusEmailDomain.upsert({
      where: { campusId_domain: { campusId: fixtureCampus.idCampus, domain: "iffar.edu.br" } },
      create: { campusId: fixtureCampus.idCampus, domain: "iffar.edu.br", includeSubdomains: true },
      update: { active: true, includeSubdomains: true }
    })
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
    // Os cadastros internos devem selecionar o campus, como no formulário real.
    if (path === "/users" && options.method === "POST" && options.body) {
      const { prisma } = await import("../../src/infra/prismaClient")
      const campus = await prisma.campus.findFirstOrThrow({ where: { acronym: "SM" } })
      options = { ...options, body: { campusId: campus.idCampus, ...(options.body as Record<string, unknown>) } }
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const data: any = await response.json()
    return { status: response.status, data }
  }

  it("mantém campus, comissão local e seus membros", async () => {
    const runId = `${Date.now()}`.slice(-8)
    const acronym = `IT${runId.slice(-5)}`
    const memberCpf = validCpf(Number(runId) + 801)

    const memberUser = await request("/users", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Membro CPPD Gestão Integração",
        email: `membro.cppd.gestao.${runId}@iffar.edu.br`,
        cpf: memberCpf,
        password: "Integration@123456",
        roles: ["CPPD_MEMBER"],
      },
    })
    expect(memberUser.status).toBe(201)
    const memberUserId = memberUser.data.data.idUser as number

    const campus = await request("/management/campuses", {
      method: "POST",
      token: adminToken,
      body: {
        name: `Campus Integração ${runId}`,
        acronym,
        cppdEmail: `cppd.${runId}@iffar.edu.br`,
        active: true,
      },
    })
    expect(campus.status).toBe(201)
    const campusId = campus.data.data.idCampus as number
    expect(campus.data.data).toMatchObject({ acronym, active: true })

    const duplicateCampus = await request("/management/campuses", {
      method: "POST",
      token: adminToken,
      body: { name: "Campus duplicado", acronym, active: true },
    })
    expect(duplicateCampus.status).toBe(400)
    expect(duplicateCampus.data.status).toBe("EXISTING_RESOURCE")

    const campuses = await request("/management/campuses", { token: adminToken })
    expect(campuses.status).toBe(200)
    expect(campuses.data.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ idCampus: campusId, acronym })]),
    )

    const invalidDates = await request("/management/commissions", {
      method: "POST",
      token: adminToken,
      body: {
        campusId,
        ordinance: "PORTARIA-INVÁLIDA",
        mandateStart: "2026-12-31",
        mandateEnd: "2026-01-01",
      },
    })
    expect(invalidDates.status).toBe(400)
    expect(invalidDates.data.message).toMatch(/início do mandato/i)

    const commission = await request("/management/commissions", {
      method: "POST",
      token: adminToken,
      body: {
        campusId,
        ordinance: `PORTARIA-CPPD-${runId}`,
        mandateStart: "2026-01-01",
        mandateEnd: "2027-12-31",
        validityStart: "2026-02-01",
        validityEnd: "2027-11-30",
      },
    })
    expect(commission.status).toBe(201)
    const commissionId = commission.data.data.idCppdCommission as number
    expect(commission.data.data).toMatchObject({
      campusId,
      ordinance: `PORTARIA-CPPD-${runId}`,
      members: [],
    })

    const commissions = await request(`/management/commissions?campusId=${campusId}`, {
      token: adminToken,
    })
    expect(commissions.status).toBe(200)
    expect(commissions.data.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ idCppdCommission: commissionId })]),
    )

    const commissionUpdated = await request(`/management/commissions/${commissionId}`, {
      method: "PATCH",
      token: adminToken,
      body: {
        ordinance: `PORTARIA-CPPD-ATUALIZADA-${runId}`,
        mandateEnd: "2028-12-31",
        validityEnd: "2028-11-30",
      },
    })
    expect(commissionUpdated.status).toBe(200)
    expect(commissionUpdated.data.data).toMatchObject({
      idCppdCommission: commissionId,
      ordinance: `PORTARIA-CPPD-ATUALIZADA-${runId}`,
    })

    const candidates = await request("/management/candidates", { token: adminToken })
    expect(candidates.status).toBe(200)
    const person = candidates.data.data.find(
      (candidate: any) => candidate.users.some((user: any) => user.idUser === memberUserId),
    )
    expect(person).toBeDefined()
    const personId = person.idPerson as number

    const memberAdded = await request(`/management/commissions/${commissionId}/members`, {
      method: "POST",
      token: adminToken,
      body: {
        personId,
        function: "PRESIDENT",
        membershipType: "PRIMARY",
        active: true,
      },
    })
    expect(memberAdded.status).toBe(201)
    expect(memberAdded.data.data.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ personId, function: "PRESIDENT", membershipType: "PRIMARY" }),
      ]),
    )

    const memberUpdated = await request(
      `/management/commissions/${commissionId}/members/${personId}`,
      {
        method: "PATCH",
        token: adminToken,
        body: { function: "MEMBER", membershipType: "SUBSTITUTE", active: false },
      },
    )
    expect(memberUpdated.status).toBe(200)
    expect(memberUpdated.data.data.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ personId, function: "MEMBER", membershipType: "SUBSTITUTE", active: false }),
      ]),
    )

    const memberRemoved = await request(
      `/management/commissions/${commissionId}/members/${personId}`,
      { method: "DELETE", token: adminToken },
    )
    expect(memberRemoved.status).toBe(200)
    expect(memberRemoved.data.data.members).toEqual([])

    const missingMember = await request(
      `/management/commissions/${commissionId}/members/${personId}`,
      { method: "DELETE", token: adminToken },
    )
    expect(missingMember.status).toBe(404)
    expect(missingMember.data.message).toMatch(/membro/i)

    const campusUpdated = await request(`/management/campuses/${campusId}`, {
      method: "PATCH",
      token: adminToken,
      body: {
        name: `Campus Integração Atualizado ${runId}`,
        cppdEmail: `cppd.atualizada.${runId}@iffar.edu.br`,
        active: false,
      },
    })
    expect(campusUpdated.status).toBe(200)
    expect(campusUpdated.data.data).toMatchObject({ idCampus: campusId, active: false })

    const inactiveCampusCommission = await request("/management/commissions", {
      method: "POST",
      token: adminToken,
      body: { campusId, ordinance: "PORTARIA-INATIVA" },
    })
    expect(inactiveCampusCommission.status).toBe(400)
    expect(inactiveCampusCommission.data.message).toMatch(/campus.*inativo/i)

    const userDeleted = await request(`/users/${memberUserId}`, {
      method: "DELETE",
      token: adminToken,
    })
    expect(userDeleted.status).toBe(200)
  }, 60000)

  function validCpf(seed: number) {
    const base = String(100000000 + (Math.abs(seed) % 899999999)).slice(0, 9)
    const calculateDigit = (digits: string, factor: number) => {
      const total = digits
        .split("")
        .reduce((sum, digit) => sum + Number(digit) * factor--, 0)
      const remainder = (total * 10) % 11
      return remainder === 10 ? 0 : remainder
    }
    const first = calculateDigit(base, 10)
    const second = calculateDigit(`${base}${first}`, 11)
    return `${base}${first}${second}`
  }
})
