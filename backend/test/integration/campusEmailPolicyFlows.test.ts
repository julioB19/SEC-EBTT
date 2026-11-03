import type { Server } from "http"
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"

describe("API HTTP e MySQL — política institucional por campus", () => {
  let server: Server | undefined, baseUrl: string, admin: string, local: string, santaMaria: number, frederico: number
  const runId = String(Date.now())
  async function request(path: string, body?: unknown, token?: string, method = "POST") {
    const response = await fetch(baseUrl + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}) })
    return { status: response.status, body: await response.json() as any }
  }
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL ?? "mysql://root:root123@localhost:3306/TCC_TEST"
    if (!new URL(url).pathname.toUpperCase().includes("TEST")) throw new Error("Use somente banco de teste")
    process.env.DATABASE_URL = url
    process.env.JWT_ACCESS_SECRET = "integration-access-secret"
    process.env.JWT_REFRESH_SECRET = "integration-refresh-secret"
    process.env.JWT_ACCESS_EXPIRATION = "1h"; process.env.JWT_REFRESH_EXPIRATION = "7d"
    const app = (await import("../../src/app")).default
    await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()) })
    const address = server!.address(); if (!address || typeof address === "string") throw new Error("Servidor de teste indisponível")
    baseUrl = `http://127.0.0.1:${address.port}`
    const rootLogin = await request("/login", { cpf: "81188057006", password: "Admin@123456" }); expect(rootLogin.status).toBe(200); admin = rootLogin.body.data.accessToken
    const memberLogin = await request("/login", { cpf: "51756662070", password: "Cppd@123456" }); expect(memberLogin.status).toBe(200)
    local = memberLogin.body.data.needsProfileSelection ? (await request("/select-role", { refreshToken: memberLogin.body.data.refreshToken, role: "CPPD_MEMBER" })).body.data.accessToken : memberLogin.body.data.accessToken
    const campuses = (await request("/access/campus-policy/campuses", undefined, admin, "GET")).body.data
    santaMaria = campuses.find((campus: any) => campus.acronym === "SM").idCampus
    frederico = campuses.find((campus: any) => campus.acronym === "FW").idCampus
  })
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    await (await import("../../src/infra/prismaClient")).prisma.$disconnect()
  })
  it("CPPD local só configura seus campi; cadastro e Google respeitam o campus selecionado", async () => {
    const accessible = await request("/access/campus-policy/campuses", undefined, local, "GET")
    expect(accessible.status).toBe(200)
    expect(accessible.body.data.map((campus: any) => campus.idCampus)).toContain(santaMaria)
    expect(accessible.body.data.map((campus: any) => campus.idCampus)).not.toContain(frederico)
    const denied = await request(`/access/campus-policy/${frederico}/domains`, { domain: "aceito-campus.edu.br" }, local)
    expect(denied.status).toBe(403)
    const rule = await request(`/access/campus-policy/${santaMaria}/domains`, { domain: "aceito-campus.edu.br", includeSubdomains: true }, local)
    expect(rule.status).toBe(200)
    const digits = String(100000000 + Number(runId.slice(-8)))
    const digit = (text: string) => { const r = [...text].reduce((sum, value, i) => sum + Number(value) * (text.length + 1 - i), 0) * 10 % 11; return r === 10 ? 0 : r }
    const first = digit(digits), cpf = `${digits}${first}${digit(digits + first)}`
    const email = `docente.${runId}@aluno.aceito-campus.edu.br`
    const body = { name: "Docente Política Campus", email, cpf, phone: "55999994444", password: "Campus@123456", docenteProfile: { campusId: frederico, siape: runId.slice(-7), classLevel: "B1", startInterstice: "2025-01-01", educationLevel: "Graduação" } }
    expect((await request("/register/docente", body)).status).toBe(400)
    body.docenteProfile.campusId = santaMaria
    const created = await request("/register/docente", body); expect(created.status).toBe(201)
    const { prisma } = await import("../../src/infra/prismaClient")
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { docente: true } })
    expect(user.campusId).toBe(santaMaria); expect(user.docente?.campusId).toBe(santaMaria)
    expect((await request("/auth/google/start", { email, campusId: frederico })).status).toBe(403)
    expect((await request("/auth/google/start", { email, campusId: santaMaria })).status).toBe(200)
    expect((await request(`/access/campus-policy/${santaMaria}/domains/${rule.body.data.id}`, { active: false }, local)).status).toBe(200)
    expect((await request("/auth/google/start", { email, campusId: santaMaria })).status).toBe(403)
    expect((await request("/login", { cpf, password: body.password })).status).toBe(200)
  })
})
