import { emailMatchesDomain } from "../../../src/service/campusEmailPolicyService"
import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { RoleName } from "@prisma/client"
import { AccessService } from "../../../src/service/accessService"
import { GoogleIdentityService } from "../../../src/service/googleIdentityService"
import { activeRoles } from "../../../src/util/accessPolicy"
import { hashCpf, readProtectedCpf } from "../../../src/util/cpfProtection"
import { accessDatabase } from "../../support/accessDatabase"

const admin = { id: 1, role: RoleName.ADMIN }
const cppd = { id: 2, role: RoleName.CPPD_MEMBER, campusIds: [1] }
const external = { name: "Avaliador Externo", email: "avaliador@outra.edu.br", roles: [RoleName.EXTERNAL_EVALUATOR], institutionalExternal: true }
const profile = { name: "Avaliador Externo", cpf: "52998224725", siape: "1234567", evaluationCity: "Santa Maria",
  qualification: "Doutorado", institution: "Outra instituição", workUnit: "Campus sede" }

describe("Acesso autorizado e primeiro acesso", () => {
  let db: ReturnType<typeof accessDatabase>
  let service: AccessService
  let messages: { to: string; text: string }[]
  let googleIdentity: { subject: string; email: string; domain?: string }
  let verify: jest.Mock<(credential: string, nonce: string) => Promise<typeof googleIdentity>>
  beforeEach(async () => {
    process.env.GOOGLE_LOGIN_ENABLED = "true"
    process.env.GOOGLE_CLIENT_ID = "test-client"
    process.env.APP_URL = "https://sec.example.com"
    process.env.JWT_ACCESS_SECRET = "test-access-secret"
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret"
    process.env.JWT_ACCESS_EXPIRATION = "1h"
    process.env.JWT_REFRESH_EXPIRATION = "7d"
    db = accessDatabase(); messages = []
    await db.campus.create({ data: { idCampus: 1, name: "Campus de teste" } })
    await db.campusEmailDomain.create({ data: { campusId: 1, domain: "iffar.edu.br", includeSubdomains: true } })
    for (const name of Object.values(RoleName)) await db.role.create({ data: { name } })
    googleIdentity = { subject: "google-external", email: external.email }
    verify = jest.fn(async () => googleIdentity)
    const google: GoogleIdentityService = { verify }
    service = new AccessService(db, google, async mail => { messages.push({ to: mail.to, text: mail.text ?? "" }) })
  })
  async function invited(body = external) {
    const result = await service.invite(cppd, { ...body, campusId: 1 })
    const raw = messages.at(-1)!.text.match(/#convite=([a-f0-9]{64})/)![1]
    return { id: result.id, raw }
  }
  async function registration() {
    const invitation = await invited()
    const attempt = await service.start({ invitationToken: invitation.raw }, "test-client")
    await service.completeGoogle(attempt.secret, "credential")
    return { ...invitation, attempt }
  }

  test("compara domínio e subdomínios usando a regra configurada", () => {
    expect(emailMatchesDomain("pessoa@aluno.iffar.edu.br", "iffar.edu.br", true)).toBe(true)
    expect(emailMatchesDomain("pessoa@iffar.edu.br.outro.com", "iffar.edu.br", true)).toBe(false)
  })
  test("convite aceita e-mail aluno.iffar.edu.br sem confirmação de instituição externa", async () => {
    await expect(service.invite(cppd, { campusId: 1, ...external, email: "avaliador@aluno.iffar.edu.br", institutionalExternal: false })).resolves.toMatchObject({ delivered: true })
  })
  test.each(["iffar.edu.br", "aluno.iffar.edu.br"])("Google aceita conta institucional com domínio confirmado %s", async domain => {
    const email = "avaliador@aluno.iffar.edu.br"
    const invitation = await service.invite(admin, { campusId: 1, name: "Avaliador interno", email, roles: [RoleName.DOCENTE] })
    expect(invitation.delivered).toBe(true)
    const attempt = await service.start({ email }, "test-client")
    googleIdentity = { email, subject: "institutional-sub", domain }
    await expect(service.completeGoogle(attempt.secret, "credential")).resolves.toMatchObject({ googleVerified: true })
  })
  test("CPPD não concede administrador nem combina perfis para burlar a restrição", async () => {
    await expect(service.invite(cppd, { campusId: 1, ...external, roles: [RoleName.ADMIN] })).rejects.toMatchObject({ status: 403 })
    await expect(service.invite(cppd, { campusId: 1, ...external, roles: [RoleName.EXTERNAL_EVALUATOR, RoleName.DOCENTE] })).rejects.toMatchObject({ status: 403 })
  })
  test("externo depende de confirmação institucional e não usa provedor pessoal", async () => {
    await expect(service.invite(cppd, { campusId: 1, ...external, institutionalExternal: false })).rejects.toThrow("confirme")
    await expect(service.invite(cppd, { campusId: 1, ...external, email: "externo@gmail.com" })).rejects.toThrow("institucional")
  })
  test("e-mail sem autorização é bloqueado antes de chamar Google", async () => {
    await expect(service.start({ email: "nao@iffar.edu.br" }, "test-client")).rejects.toMatchObject({ status: 403 })
    expect(verify).not.toHaveBeenCalled()
  })
  test("falha de entrega preserva convite e permite reenvio sem revelar o link", async () => {
    const failed = new AccessService(db, { verify }, async () => { throw new Error("SMTP") })
    expect(await failed.invite(cppd, { ...external, campusId: 1 })).toMatchObject({ delivered: false })
    const list = await service.invitations(cppd)
    expect(list[0].deliveryError).toBeTruthy()
    expect(list[0]).not.toHaveProperty("tokenHash")
    expect(await service.resend(cppd, list[0].id)).toMatchObject({ delivered: true })
  })
  test("convite só pode confirmar uma caixa de e-mail uma vez", async () => {
    const invitation = await invited()
    expect(await service.start({ invitationToken: invitation.raw }, "test-client")).toMatchObject({ emailVerified: true })
    await expect(service.start({ invitationToken: invitation.raw }, "test-client")).rejects.toThrow("inválido")
  })
  test("reenviar invalida link anterior e tentativa já iniciada", async () => {
    const invitation = await invited()
    const attempt = await service.start({ invitationToken: invitation.raw }, "test-client")
    await service.resend(cppd, invitation.id)
    await expect(service.status(attempt.secret)).rejects.toMatchObject({ status: 401 })
    await expect(service.start({ invitationToken: invitation.raw }, "test-client")).rejects.toThrow()
  })
  test("cancelamento entre pré-checagem e Google impede continuar", async () => {
    const invitation = await invited()
    const attempt = await service.start({ email: external.email }, "test-client")
    await service.cancel(cppd, invitation.id)
    await expect(service.completeGoogle(attempt.secret, "credential")).rejects.toMatchObject({ status: 403 })
    expect(verify).not.toHaveBeenCalled()
  })
  test("convite e tentativa expirados são recusados", async () => {
    const invitation = await invited()
    const attempt = await service.start({ email: external.email }, "test-client")
    await db.accessAttempt.updateMany({ where: { email: external.email }, data: { expiresAt: new Date(0) } })
    await expect(service.status(attempt.secret)).rejects.toMatchObject({ status: 401 })
    await db.accessInvitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(0) } })
    await expect(service.start({ invitationToken: invitation.raw }, "test-client")).rejects.toThrow("expirado")
  })
  test("conta Google diferente não cria identidade nem usuário", async () => {
    const invitation = await invited()
    const attempt = await service.start({ invitationToken: invitation.raw }, "test-client")
    googleIdentity.email = "outra@outra.edu.br"
    await expect(service.completeGoogle(attempt.secret, "credential")).rejects.toMatchObject({ status: 403 })
    expect(await db.googleIdentity.findMany()).toHaveLength(0)
    expect(await db.user.findMany()).toHaveLength(0)
  })
  test("conta Google sem domínio organizacional também exige confirmação da caixa de e-mail", async () => {
    await db.user.create({ data: { email: "interno@iffar.edu.br", roles: [] } })
    // Perfis são armazenados em seus vínculos, como no banco real.
    const user = await db.user.findUnique({ where: { email: "interno@iffar.edu.br" } })
    const role = await db.role.findUnique({ where: { name: RoleName.ADMIN } })
    await db.userRole.create({ data: { userId: user.idUser, roleId: role.idRole } })
    const attempt = await service.start({ email: user.email }, "test-client")
    googleIdentity = { email: user.email, subject: "internal-sub" }
    await expect(service.completeGoogle(attempt.secret, "credential")).resolves.toMatchObject({ stage: "VERIFY_EMAIL" })
  })
  test("externo conclui, corrige dados, aguarda CPPD e só depois recebe perfil", async () => {
    const { id, attempt } = await registration()
    expect(await service.status(attempt.secret)).toMatchObject({ stage: "REGISTER", emailVerified: true })
    const completed = await service.completeRegistration(attempt.secret, profile)
    expect(completed).toHaveProperty("secret")
    const monitor = (completed as { secret: string }).secret
    const user = await db.user.findUnique({ where: { email: external.email } })
    expect(user.cpf).toBeNull()
    expect(user.cpfHash).toBe(hashCpf(profile.cpf))
    expect(readProtectedCpf(user)).toBe(profile.cpf)
    expect(activeRoles(user)).toEqual([])
    expect(user.externalEvaluator.active).toBe(false)
    expect(await service.status(monitor)).toMatchObject({ stage: "REVIEW" })
    await service.updatePending(monitor, { ...profile, name: "Nome corrigido", workUnit: "Lotação corrigida" })
    expect(await service.reviewDetails(cppd, id)).toMatchObject({ name: "Nome corrigido", workUnit: "Lotação corrigida" })
    await service.approve(cppd, id)
    expect(activeRoles(await db.user.findUnique({ where: { email: external.email } }))).toEqual([RoleName.EXTERNAL_EVALUATOR])
    expect(await service.status(monitor)).toMatchObject({ stage: "AUTHENTICATED", session: { selectedRole: RoleName.EXTERNAL_EVALUATOR } })
    await expect(service.status(monitor)).rejects.toMatchObject({ status: 401 })
  })
  test("duas conclusões simultâneas geram um usuário e um vínculo", async () => {
    const { attempt } = await registration()
    const result = await Promise.allSettled([service.completeRegistration(attempt.secret, profile), service.completeRegistration(attempt.secret, profile)])
    expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1)
    expect(await db.user.findMany()).toHaveLength(1)
    expect(await db.googleIdentity.findMany()).toHaveLength(1)
  })
  test("conta existente é preservada e a primeira vinculação exige confirmação por código", async () => {
    const user = await db.user.create({ data: { email: "admin@iffar.edu.br", name: "Admin atual", cpf: profile.cpf, passwordHash: "senha-existente" } })
    const role = await db.role.findUnique({ where: { name: RoleName.ADMIN } })
    await db.userRole.create({ data: { userId: user.idUser, roleId: role.idRole } })
    googleIdentity = { email: user.email, subject: "admin-google", domain: "iffar.edu.br" }
    const attempt = await service.start({ email: user.email }, "test-client")
    expect(await service.completeGoogle(attempt.secret, "credential")).toMatchObject({ stage: "VERIFY_EMAIL" })
    expect(await db.googleIdentity.findMany()).toHaveLength(0)
    await service.sendCode(attempt.secret)
    const code = messages.at(-1)!.text.match(/código é (\d{6})/)![1]
    expect(await service.verifyEmail(attempt.secret, code)).toMatchObject({ stage: "AUTHENTICATED" })
    expect(await db.user.findMany()).toHaveLength(1)
    expect(await db.user.findUnique({ where: { email: user.email } })).toMatchObject({ idUser: user.idUser, passwordHash: "senha-existente" })
    const second = await service.start({ email: user.email }, "test-client")
    expect(await service.completeGoogle(second.secret, "credential")).toMatchObject({ stage: "AUTHENTICATED" })
    expect(messages).toHaveLength(1)
  })
  test("a conta Google não substitui vínculo existente com outro identificador", async () => {
    const { id, attempt } = await registration()
    await service.completeRegistration(attempt.secret, profile); await service.approve(cppd, id)
    googleIdentity.subject = "another-sub"
    const second = await service.start({ email: external.email }, "test-client")
    await expect(service.completeGoogle(second.secret, "credential")).rejects.toMatchObject({ status: 409 })
  })
  test("externo volta pelo Google enquanto aguarda revisão, sem exigir domínio IFFar", async () => {
    const { attempt } = await registration()
    await service.completeRegistration(attempt.secret, profile)
    const later = await service.start({ email: external.email }, "test-client")
    const result = await service.completeGoogle(later.secret, "credential")
    expect(result).toMatchObject({ stage: "REVIEW" })
    expect(result).toHaveProperty("secret")
  })
  test("confirmar e-mail não entrega sessão de acompanhamento antes da senha ou do Google", async () => {
    const { attempt } = await registration()
    await service.completeRegistration(attempt.secret, { ...profile, password: "Senha@12345" })
    const later = await service.start({ email: external.email }, "test-client")
    await service.sendCode(later.secret)
    const code = messages.at(-1)!.text.match(/código é (\d{6})/)![1]
    expect(await service.verifyEmail(later.secret, code)).toMatchObject({ stage: "READY" })
    await expect(service.updatePending(later.secret, profile)).rejects.toMatchObject({ status: 403 })
    expect(await service.passwordAccess(later.secret, "Senha@12345")).toMatchObject({ stage: "REVIEW" })
  })
  test("limita erros de código, mesmo solicitando novo código", async () => {
    await invited()
    const attempt = await service.start({ email: external.email }, "test-client")
    await service.sendCode(attempt.secret)
    const actual = messages.at(-1)!.text.match(/código é (\d{6})/)![1]
    const wrong = actual === "000000" ? "000001" : "000000"
    for (let i = 0; i < 5; i++) await expect(service.verifyEmail(attempt.secret, wrong)).rejects.toThrow("Código inválido")
    await expect(service.verifyEmail(attempt.secret, actual)).rejects.toMatchObject({ status: 429 })
  })
  test("convite pode ser concluído sem Google, definindo senha", async () => {
    const invitation = await invited()
    const attempt = await service.start({ invitationToken: invitation.raw }, "test-client")
    expect(await service.completeRegistration(attempt.secret, { ...profile, password: "Senha@12345" })).toMatchObject({ stage: "REVIEW" })
    const user = await db.user.findUnique({ where: { email: external.email } })
    expect(user.passwordHash).toMatch(/^\$2/)
    expect(await db.googleIdentity.findMany()).toHaveLength(0)
  })
  test("usuário bloqueado é impedido mesmo com conta Google vinculada", async () => {
    const { id, attempt } = await registration()
    await service.completeRegistration(attempt.secret, profile); await service.approve(cppd, id)
    await db.user.update({ where: { email: external.email }, data: { active: false } })
    await expect(service.start({ email: external.email }, "test-client")).rejects.toMatchObject({ status: 403 })
  })
  test("cadastro não termina sem CPF válido nem dados profissionais", async () => {
    const { attempt } = await registration()
    await expect(service.completeRegistration(attempt.secret, { ...profile, cpf: "11111111111" })).rejects.toThrow("CPF inválido")
    await expect(service.completeRegistration(attempt.secret, { name: profile.name, cpf: profile.cpf })).rejects.toThrow("Preencha")
    expect(await db.user.findMany()).toHaveLength(0)
  })
  test("tentativas são vinculadas ao segredo e respeitam limites de pré-checagem", async () => {
    await invited()
    await expect(service.status("wrong-secret")).rejects.toMatchObject({ status: 401 })
    for (let i = 0; i < 10; i++) await service.start({ email: external.email }, "test-client")
    await expect(service.start({ email: external.email }, "test-client")).rejects.toMatchObject({ status: 429 })
  })
  test("admin convida outros perfis e contas novas internas recebem apenas os autorizados", async () => {
    const invitation = await service.invite(admin, { campusId: 1, name: "Nova CPPD", email: "nova@iffar.edu.br", roles: [RoleName.CPPD_CENTRAL] })
    const raw = messages.at(-1)!.text.match(/#convite=([a-f0-9]{64})/)![1]
    const attempt = await service.start({ invitationToken: raw }, "test-client")
    googleIdentity = { subject: "new-cppd", email: "nova@iffar.edu.br", domain: "iffar.edu.br" }
    await service.completeGoogle(attempt.secret, "credential")
    expect(await service.completeRegistration(attempt.secret, { name: "Nova CPPD", cpf: profile.cpf })).toMatchObject({ stage: "AUTHENTICATED", session: { roles: [RoleName.CPPD_CENTRAL] } })
    expect(await db.accessInvitation.findUnique({ where: { id: invitation.id } })).toMatchObject({ status: "ACCEPTED" })
  })
})
