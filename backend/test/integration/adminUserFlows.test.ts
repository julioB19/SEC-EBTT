import type { Server } from "http"
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "mysql://root:root123@localhost:3306/TCC_TEST"

describe("API HTTP - cadastro e manutenção de usuários", () => {
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

    adminToken = (await login("81188057006", "Admin@123456")).accessToken
    cppdToken = (await login("58315013610", "CppdCentral@123456")).accessToken
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

  async function login(cpf: string, password: string) {
    const response = await request("/login", { method: "POST", body: { cpf, password } })
    expect(response.status).toBe(200)
    return response.data.data
  }

  it("permite ao docente registrar-se e ao administrador removê-lo", async () => {
    const runId = `${Date.now()}`.slice(-8)
    const cpf = validCpf(Number(runId) + 601)
    const body = {
      name: "Docente Cadastro Público",
      email: `cadastro.publico.${runId}@example.com`,
      cpf,
      phone: "55999994444",
      city: "Jaguari",
      uf: "RS",
      password: "Integration@123456",
      docenteProfile: {
        siape: `86${runId.slice(-5)}601`,
        classLevel: "B1",
        startInterstice: "2025-01-01",
        educationLevel: "Graduação",
        assignment: "Campus Jaguari",
      },
    }
    const registered = await request("/register/docente", { method: "POST", body })
    expect(registered.status).toBe(201)
    expect(registered.data.data).toMatchObject({
      name: body.name,
      email: body.email,
      roles: ["DOCENTE"],
    })
    const userId = registered.data.data.idUser as number

    const duplicate = await request("/register/docente", { method: "POST", body })
    expect(duplicate.status).toBe(400)
    expect(duplicate.data.status).toBe("USER_EXISTS")

    const removed = await request(`/users/${userId}`, {
      method: "DELETE",
      token: adminToken,
    })
    expect(removed.status).toBe(200)
    expect(removed.data.data).toMatchObject({ idUser: userId, active: false })
  })

  it("percorre consulta e edições próprias, da CPPD e do administrador", async () => {
    const runId = `${Date.now()}`.slice(-8)
    const cpf = validCpf(Number(runId) + 701)
    const password = "Integration@123456"
    const email = `usuario.gerenciado.${runId}@example.com`
    const created = await request("/users", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Docente Gerenciado Integração",
        email,
        cpf,
        password,
        phone: "55999995555",
        city: "Santa Maria",
        uf: "RS",
        roles: ["DOCENTE"],
        docenteProfile: {
          siape: `87${runId.slice(-5)}701`,
          classLevel: "B1",
          startInterstice: "2025-01-01",
          educationLevel: "Graduação",
          improvement: "Curso inicial",
          assignment: "Campus Santa Maria",
          department: "Ensino",
        },
      },
    })
    expect(created.status).toBe(201)
    const userId = created.data.data.idUser as number

    const activeUsers = await request("/users/active", { token: adminToken })
    expect(activeUsers.status).toBe(200)
    expect(activeUsers.data.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ idUser: userId, email })]),
    )

    const byId = await request(`/users/${userId}`, { token: adminToken })
    expect(byId.status).toBe(200)
    expect(byId.data.data).toMatchObject({
      idUser: userId,
      docenteProfile: { classLevel: "B1", educationLevel: "Graduação" },
    })

    const adminUpdated = await request(`/users/${userId}`, {
      method: "PUT",
      token: adminToken,
      body: {
        name: "Docente Gerenciado Atualizado",
        phone: "55999996666",
        city: "São Borja",
        uf: "RS",
        docenteProfile: {
          improvement: "Aperfeiçoamento atualizado",
          specialization: "Especialização em Ensino",
          mastersDegree: "Mestrado em Educação",
          doctorate: null,
          assignment: "Campus São Borja",
          department: "Pesquisa",
          division: "Núcleo acadêmico",
          role: "Docente",
          immediateSupervisor: "Coordenação",
        },
      },
    })
    expect(adminUpdated.status).toBe(200)
    expect(adminUpdated.data.data).toMatchObject({
      name: "Docente Gerenciado Atualizado",
      city: "São Borja",
      docenteProfile: {
        specialization: "Especialização em Ensino",
        mastersDegree: "Mestrado em Educação",
      },
    })

    const teacherLogin = await login(cpf, password)
    const ownEmail = `perfil.proprio.${runId}@example.com`
    const ownUpdated = await request("/users/me", {
      method: "PUT",
      token: teacherLogin.accessToken,
      body: {
        name: "Docente Editou o Próprio Perfil",
        email: ownEmail,
        phone: "55999997777",
        city: "Alegrete",
        uf: "RS",
        docenteProfile: {
          educationLevel: "Mestrado",
          assignment: "Campus Alegrete",
        },
      },
    })
    expect(ownUpdated.status).toBe(200)
    expect(ownUpdated.data.data).toMatchObject({
      email: ownEmail,
      docenteProfile: { educationLevel: "Mestrado", assignment: "Campus Alegrete" },
    })

    const docentes = await request("/docentes", { token: cppdToken })
    expect(docentes.status).toBe(200)
    expect(docentes.data.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ idUser: userId })]),
    )

    const cppdView = await request(`/docentes/${userId}/cppd`, { token: cppdToken })
    expect(cppdView.status).toBe(200)
    expect(cppdView.data.data.idUser).toBe(userId)

    const cppdEmail = `perfil.cppd.${runId}@example.com`
    const cpfUpdated = validCpf(Number(runId) + 702)
    const cppdUpdated = await request(`/docentes/${userId}/cppd`, {
      method: "PUT",
      token: cppdToken,
      body: {
        email: cppdEmail,
        cpf: cpfUpdated,
        siape: `88${runId.slice(-5)}702`,
      },
    })
    expect(cppdUpdated.status).toBe(200)
    expect(cppdUpdated.data.data).toMatchObject({
      email: cppdEmail,
      cpf: cpfUpdated,
      docenteProfile: { siape: `88${runId.slice(-5)}702` },
    })

    const rolesUpdated = await request(`/users/${userId}/roles`, {
      method: "PATCH",
      token: adminToken,
      body: { roles: ["DOCENTE", "EXTERNAL_EVALUATOR"] },
    })
    expect(rolesUpdated.status).toBe(200)
    expect(rolesUpdated.data.data.roles).toEqual(
      expect.arrayContaining(["DOCENTE", "EXTERNAL_EVALUATOR"]),
    )
    expect(rolesUpdated.data.data.externalEvaluatorProfile).toMatchObject({ active: true })

    const adminDocenteUpdated = await request(`/docentes/${userId}/admin`, {
      method: "PUT",
      token: adminToken,
      body: {
        active: true,
        externalEvaluatorProfile: {
          title: "Doutor",
          institution: "Instituição Atualizada",
        },
        docenteProfile: {
          classLevel: "B2",
          startInterstice: "2026-01-01",
        },
      },
    })
    expect(adminDocenteUpdated.status).toBe(200)
    expect(adminDocenteUpdated.data.data).toMatchObject({
      docenteProfile: { classLevel: "B2" },
      externalEvaluatorProfile: { title: "Doutor", institution: "Instituição Atualizada" },
    })

    const multiRoleLogin = await login(cpfUpdated, password)
    expect(multiRoleLogin.needsProfileSelection).toBe(true)
    const selected = await request("/select-role", {
      method: "POST",
      body: { refreshToken: multiRoleLogin.refreshToken, role: "DOCENTE" },
    })
    expect(selected.status).toBe(200)
    expect(selected.data.data.selectedRole).toBe("DOCENTE")

    const refreshed = await request("/refresh-token", {
      method: "POST",
      body: { refreshToken: selected.data.data.refreshToken },
    })
    expect(refreshed.status).toBe(200)
    expect(refreshed.data.data.selectedRole).toBe("DOCENTE")

    const loggedOut = await request("/logout", {
      method: "POST",
      token: refreshed.data.data.accessToken,
      body: { refreshToken: refreshed.data.data.refreshToken },
    })
    expect(loggedOut.status).toBe(200)
    expect(loggedOut.data.data).toEqual({ revokedAccess: true, revokedRefresh: true })

    const revokedAccess = await request("/users/me", { token: refreshed.data.data.accessToken })
    expect(revokedAccess.status).toBe(401)
    const revokedRefresh = await request("/refresh-token", {
      method: "POST",
      body: { refreshToken: refreshed.data.data.refreshToken },
    })
    expect(revokedRefresh.status).toBe(400)

    const deleted = await request(`/docentes/${userId}`, {
      method: "DELETE",
      token: adminToken,
    })
    expect(deleted.status).toBe(200)
    expect(deleted.data.data).toMatchObject({ idUser: userId, active: false })

    const missing = await request(`/users/${userId}`, { token: adminToken })
    expect(missing.status).toBe(404)
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
