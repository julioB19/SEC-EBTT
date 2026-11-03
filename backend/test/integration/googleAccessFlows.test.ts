import type { Server } from "http"
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { sendMail } from "../../src/util/mailer"
import { GoogleIdentityService } from "../../src/service/googleIdentityService"

jest.mock("../../src/util/mailer", () => ({ sendMail: jest.fn() }))

describe("API HTTP e MySQL — acesso Google autorizado", () => {
  let server: Server | undefined
  let baseUrl: string
  let campusId: number
  let adminToken: string
  const runId = `${Date.now()}`
  const email = `avaliador.google.${runId}@outra.edu.br`
  async function request(path: string, body?: unknown, token?: string, method = "POST") {
    const response = await fetch(`${baseUrl}${path}`, { method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}) })
    return { status: response.status, body: await response.json() as any }
  }
  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? "mysql://root:root123@localhost:3306/TCC_TEST"
    if (!new URL(databaseUrl).pathname.toUpperCase().includes("TEST")) throw new Error("Use um banco exclusivo de testes")
    process.env.DATABASE_URL = databaseUrl
    process.env.GOOGLE_LOGIN_ENABLED = "true"
    process.env.GOOGLE_CLIENT_ID = "integration-web-client"
    process.env.APP_URL = "https://sec.example.com"
    process.env.JWT_ACCESS_SECRET = "integration-access-secret"
    process.env.JWT_REFRESH_SECRET = "integration-refresh-secret"
    process.env.JWT_ACCESS_EXPIRATION = "1h"
    process.env.JWT_REFRESH_EXPIRATION = "7d"
    jest.mocked(sendMail).mockResolvedValue(undefined)
    jest.spyOn(GoogleIdentityService.prototype, "verify").mockResolvedValue({ subject: `google-${runId}`, email })
    const app = (await import("../../src/app")).default
    await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()) })
    const address = server!.address()
    if (!address || typeof address === "string") throw new Error("Servidor de teste indisponível")
    baseUrl = `http://127.0.0.1:${address.port}`
    const login = await request("/login", { cpf: "81188057006", password: "Admin@123456" })
    expect(login.status).toBe(200)
    adminToken = login.body.data.accessToken
    const campuses = await request("/access/campus-policy/campuses", undefined, adminToken, "GET")
    campusId = campuses.body.data[0].idCampus
  })
  beforeEach(() => {
    // resetMocks limpa as implementações depois de beforeAll.
    jest.mocked(sendMail).mockResolvedValue(undefined)
    jest.mocked(GoogleIdentityService.prototype.verify).mockResolvedValue({ subject: `google-${runId}`, email })
  })
  afterAll(async () => {
    jest.restoreAllMocks()
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    const { prisma } = await import("../../src/infra/prismaClient")
    await prisma.$disconnect()
  })
  it("percorre convite, Google, cadastro protegido, aprovação e acesso restrito às atribuições", async () => {
    const invited = await request("/access/invitations", { name: "Avaliador Integração Google", email, campusId,
      roles: ["EXTERNAL_EVALUATOR"], institutionalExternal: true }, adminToken)
    expect(invited.status).toBe(200)
    const raw = jest.mocked(sendMail).mock.calls.at(-1)![0].text!.match(/#convite=([a-f0-9]{64})/)![1]
    const started = await request("/auth/google/start", { invitationToken: raw })
    expect(started.status).toBe(200)
    const attemptSecret = started.body.data.secret
    const verified = await request("/auth/google/complete", { attemptSecret, credential: "synthetic-google-identity" })
    expect(verified.body.data).toMatchObject({ stage: "REGISTER", googleVerified: true })
    const cpfBase = String(100000000 + Number(runId.slice(-8)))
    const digit = (value: string) => { const sum = [...value].reduce((total, n, i) => total + Number(n) * (value.length + 1 - i), 0); const remainder = (sum * 10) % 11; return remainder === 10 ? 0 : remainder }
    const first = digit(cpfBase)
    const cpf = `${cpfBase}${first}${digit(`${cpfBase}${first}`)}`
    const profile = { name: "Avaliador Integração Google", cpf, siape: "9876543", evaluationCity: "Santa Maria",
      qualification: "Doutorado", institution: "Instituição externa", workUnit: "Campus sede" }
    const completed = await request("/auth/access/complete", { attemptSecret, profile })
    expect(completed.body.data.stage).toBe("REVIEW")
    const monitor = completed.body.data.secret
    expect((await request("/external-evaluator/assignments", undefined, monitor, "GET")).status).toBe(401)
    const { prisma } = await import("../../src/infra/prismaClient")
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { roles: true, externalEvaluator: true } })
    expect(user.cpf).toBeNull()
    expect(user.cpfEncrypted).toBeTruthy()
    expect(user.passwordHash).toBeNull()
    expect(user.roles).toHaveLength(0)
    expect(user.externalEvaluator?.active).toBe(false)
    const again = await request("/auth/access/complete", { attemptSecret, profile })
    expect(again.status).toBe(401)
    expect((await request(`/access/invitations/${invited.body.data.id}/approve`, {}, adminToken)).status).toBe(200)
    const session = await request("/auth/access/status", { attemptSecret: monitor })
    expect(session.body.data).toMatchObject({ stage: "AUTHENTICATED", session: { roles: ["EXTERNAL_EVALUATOR"] } })
    expect((await request("/external-evaluator/assignments", undefined, session.body.data.session.accessToken, "GET")).status).toBe(200)
    expect((await request("/access/invitations", undefined, session.body.data.session.accessToken, "GET")).status).toBe(403)
  })
})
