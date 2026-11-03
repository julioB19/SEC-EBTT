import { CampusEmailPolicyService, CampusActor } from "./campusEmailPolicyService"
import { protectCpf, readProtectedCpf } from "../util/cpfProtection"
import { randomBytes, randomInt, createHash } from "crypto"
import bcrypt from "bcryptjs"
import { AccessInvitation, AccessAttempt, Prisma, RoleName, PersonType } from "@prisma/client"
import { prisma } from "../infra/prismaClient"
import { AccessError, activeRoles, invitationRoles, normalizedEmail } from "../util/accessPolicy"
import { sendMail } from "../util/mailer"
import { GoogleIdentityService } from "./googleIdentityService"
import { UserService } from "./userService"
import { UserRepository } from "../repository/userRepository"
import { AccessCompletion, completionSchema } from "../validator/accessValidator"

const MINUTE = 60_000
const sessionInclude = { roles: { include: { role: true } }, externalEvaluator: true, docente: true, person: true } as const
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const token = () => randomBytes(32).toString("hex")
type Actor = CampusActor
type Attempt = AccessAttempt & { invitation: AccessInvitation | null }
type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
const externalOnly = (roles: RoleName[]) => roles.length === 1 && roles[0] === RoleName.EXTERNAL_EVALUATOR
const html = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

export class AccessService {
  constructor(private readonly db = prisma, private readonly google = new GoogleIdentityService(),
    private readonly mail = sendMail) {}

  private get emailPolicy() { return new CampusEmailPolicyService(this.db) }

  private async limit(key: string, maximum: number) {
    const now = new Date()
    const hashed = digest(key)
    await this.db.accessRateLimit.upsert({ where: { key: hashed },
      create: { key: hashed, count: 0, expiresAt: new Date(now.getTime() + 10 * MINUTE) }, update: {} })
    await this.db.accessRateLimit.updateMany({ where: { key: hashed, expiresAt: { lte: now } },
      data: { count: 0, expiresAt: new Date(now.getTime() + 10 * MINUTE) } })
    const result = await this.db.accessRateLimit.updateMany({ where: { key: hashed, count: { lt: maximum } },
      data: { count: { increment: 1 } } })
    if (!result.count) throw new AccessError("Muitas tentativas. Aguarde dez minutos para tentar novamente", 429)
  }

  private canManage(actor: Actor, roles: RoleName[]) {
    if (actor.role !== RoleName.ADMIN && !([RoleName.CPPD_MEMBER, RoleName.CPPD_CENTRAL].includes(actor.role as "CPPD_MEMBER" | "CPPD_CENTRAL") && externalOnly(roles))) {
      throw new AccessError("Você não pode conceder os perfis deste convite", 403)
    }
  }

  async invitations(actor: Actor) {
    this.canManage(actor, [RoleName.EXTERNAL_EVALUATOR])
    const rows = await this.db.accessInvitation.findMany({
      where: { ...(actor.role === RoleName.CPPD_MEMBER ? { campusId: { in: actor.campusIds ?? [] } } : {}), ...(actor.role === RoleName.ADMIN ? {} : { roles: { equals: [RoleName.EXTERNAL_EVALUATOR] } }) },
      orderBy: { createdAt: "desc" }, take: 200,
      select: { id: true, email: true, name: true, roles: true, institutionalExternal: true, campusId: true, campus: { select: { name: true } },
        status: true, expiresAt: true, deliveredAt: true, deliveryError: true, userId: true, createdById: true, reviewedAt: true }
    })
    return rows
  }

  async invite(actor: Actor, body: { name?: unknown; email?: unknown; roles?: unknown; institutionalExternal?: unknown; campusId?: unknown }) {
    const roles = invitationRoles(body.roles)
    this.canManage(actor, roles)
    const campus = await this.emailPolicy.campus(body.campusId)
    this.emailPolicy.assertAccess(actor, campus.idCampus)
    const email = normalizedEmail(body.email)
    const institutional = await this.emailPolicy.accepts(email, campus.idCampus)
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name || name.length > 120) throw new AccessError("Informe o nome, com até 120 caracteres")
    if (!institutional && (!externalOnly(roles) || body.institutionalExternal !== true)) {
      throw new AccessError("O e-mail não é aceito pelo campus. Para avaliador de outra instituição, confirme o vínculo institucional")
    }
    // A confirmação administrativa não deve autorizar provedores pessoais conhecidos.
    if (!institutional && /^(gmail\.com|googlemail\.com|hotmail\.com|outlook\.com|live\.com|yahoo\.(com|com\.br)|icloud\.com|proton\.(me|com)|aol\.com|uol\.com\.br|bol\.com\.br)$/.test(email.split("@")[1])) {
      throw new AccessError("Informe um e-mail institucional, em vez de um provedor pessoal")
    }
    const existingUser = await this.db.user.findUnique({ where: { email } })
    if (existingUser && !existingUser.active) throw new AccessError("O usuário está bloqueado; regularize seu cadastro antes de convidar", 409)
    const previous = await this.db.accessInvitation.findUnique({ where: { email } })
    if (previous && previous.status !== "CANCELLED") throw new AccessError("Este e-mail já possui convite. Use reenviar ou consulte sua situação", 409)
    const raw = token()
    const data = { name, roles, campusId: campus.idCampus, institutionalExternal: externalOnly(roles) && body.institutionalExternal === true,
      status: "PENDING" as const, tokenHash: digest(raw), expiresAt: new Date(Date.now() + 7 * 24 * 60 * MINUTE),
      createdById: actor.id, userId: existingUser?.idUser ?? null, reviewedAt: null, reviewedById: null, deletedDate: null }
    let invitation: AccessInvitation
    try {
      invitation = previous ? await this.db.accessInvitation.update({ where: { id: previous.id }, data }) :
        await this.db.accessInvitation.create({ data: { ...data, email } })
    } catch (error) { this.conflict(error) }
    return this.deliver(invitation!, raw)
  }

  private async deliver(invitation: AccessInvitation, raw: string) {
    const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || "").replace(/\/+$/, "")
    try {
      if (!/^https?:\/\//.test(appUrl)) throw new Error("Endereço do sistema ausente")
      // Fragmentos não são enviados nos pedidos HTTP nem no cabeçalho Referer.
      const link = `${appUrl}/acesso#convite=${raw}`
      await this.mail({ to: invitation.email, subject: "Convite para acessar o SEC-EBTT",
        text: `Olá, ${invitation.name}. Conclua seu acesso em ${link}. Use ${invitation.email}. O convite vale por sete dias.`,
        html: `<p>Olá, ${html(invitation.name)}.</p><p>Você foi convidado(a) para o SEC-EBTT.</p><p><a href="${html(link)}">Concluir meu acesso</a></p><p>Use ${html(invitation.email)}. O convite vale por sete dias.</p>` })
      await this.db.accessInvitation.updateMany({ where: { id: invitation.id, tokenHash: digest(raw) },
        data: { deliveredAt: new Date(), deliveryError: null } })
      return { id: invitation.id, delivered: true }
    } catch {
      await this.db.accessInvitation.updateMany({ where: { id: invitation.id, tokenHash: digest(raw) },
        data: { deliveryError: "Não foi possível enviar o e-mail. Confira a configuração e tente reenviar." } })
      return { id: invitation.id, delivered: false }
    }
  }

  async resend(actor: Actor, id: string) {
    const invitation = await this.db.accessInvitation.findUnique({ where: { id } })
    if (!invitation) throw new AccessError("Convite não encontrado", 404)
    this.canManage(actor, invitationRoles(invitation.roles))
    if (invitation.campusId) this.emailPolicy.assertAccess(actor, invitation.campusId)
    else if (actor.role === RoleName.CPPD_MEMBER) throw new AccessError("Convite sem campus; solicite ajuste à administração", 403)
    if (invitation.status !== "PENDING") throw new AccessError("Somente convites pendentes podem ser reenviados", 409)
    await this.limit(`invite:${id}`, 5)
    const raw = token()
    const result = await this.db.accessInvitation.updateMany({ where: { id, status: "PENDING", updatedAt: invitation.updatedAt },
      data: { tokenHash: digest(raw), expiresAt: new Date(Date.now() + 7 * 24 * 60 * MINUTE), deliveredAt: null, deliveryError: null } })
    if (!result.count) throw new AccessError("O convite mudou. Atualize a lista", 409)
    await this.db.accessAttempt.updateMany({ where: { invitationId: id, consumedAt: null }, data: { consumedAt: new Date() } })
    return this.deliver(invitation, raw)
  }

  async cancel(actor: Actor, id: string) {
    const invitation = await this.db.accessInvitation.findUnique({ where: { id } })
    if (!invitation) throw new AccessError("Convite não encontrado", 404)
    this.canManage(actor, invitationRoles(invitation.roles))
    if (invitation.campusId) this.emailPolicy.assertAccess(actor, invitation.campusId)
    else if (actor.role === RoleName.CPPD_MEMBER) throw new AccessError("Convite sem campus; solicite ajuste à administração", 403)
    const result = await this.db.accessInvitation.updateMany({ where: { id, status: "PENDING" },
      data: { status: "CANCELLED", tokenHash: null } })
    if (!result.count) throw new AccessError("Somente convites pendentes podem ser cancelados", 409)
    return { cancelled: true }
  }

  private async eligibility(email: string, requestedCampus?: unknown) {
    const user = await this.db.user.findUnique({ where: { email }, include: sessionInclude })
    let invitation = await this.db.accessInvitation.findUnique({ where: { email } })
    const campus = await this.emailPolicy.resolveCampus(email, requestedCampus ?? invitation?.campusId ?? user?.campusId ?? user?.docente?.campusId)
    if (invitation?.campusId && invitation.campusId !== campus.idCampus) invitation = null
    const institutional = await this.emailPolicy.accepts(email, campus.idCampus)
    if (user && (!user.active || user.deletedDate)) throw new AccessError("Acesso indisponível. Procure a administração", 403)
    const validInvitation = invitation && invitation.status !== "CANCELLED" &&
      (invitation.status !== "PENDING" || invitation.expiresAt > new Date()) ? invitation : null
    const roles = user ? activeRoles(user) : []
    if (!user && !validInvitation) throw new AccessError("E-mail sem autorização vigente. Procure a CPPD ou a administração", 403)
    if (!institutional) {
      const approvedExternal = validInvitation?.institutionalExternal && externalOnly(invitationRoles(validInvitation.roles))
      if (!approvedExternal || roles.some(role => role !== RoleName.EXTERNAL_EVALUATOR)) {
        throw new AccessError("O e-mail não é aceito pelo campus selecionado", 403)
      }
    }
    if (user && (!roles.length || (user.externalEvaluator && !user.externalEvaluator.active && roles.length === 1 && roles[0] === RoleName.EXTERNAL_EVALUATOR)) && !validInvitation) throw new AccessError("Conta sem perfil habilitado", 403)
    return { user, invitation: validInvitation, campus }
  }

  async start(body: { email?: unknown; invitationToken?: unknown; campusId?: unknown }, ip: string) {
    await this.limit(`ip:${ip}`, 100)
    let invitation: AccessInvitation | null = null
    if (typeof body.invitationToken === "string" && /^[a-f0-9]{64}$/.test(body.invitationToken)) {
      invitation = await this.db.accessInvitation.findUnique({ where: { tokenHash: digest(body.invitationToken) } })
      if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
        throw new AccessError("Convite inválido ou expirado. Solicite um novo envio", 403)
      }
    } else if (body.invitationToken) throw new AccessError("Convite inválido", 403)
    const email = normalizedEmail(invitation?.email ?? body.email)
    await this.limit(`start:${email}`, 10)
    const eligible = await this.eligibility(email, invitation?.campusId ?? body.campusId)
    const secret = token()
    const nonce = token()
    await this.db.$transaction(async tx => {
      if (invitation) {
        const claimed = await tx.accessInvitation.updateMany({
          where: { id: invitation.id, status: "PENDING", tokenHash: invitation.tokenHash, expiresAt: { gt: new Date() } },
          data: { tokenHash: null }
        })
        if (!claimed.count) throw new AccessError("Convite já utilizado. Inicie pelo e-mail ou solicite reenvio", 409)
      }
      await tx.accessAttempt.create({ data: { email, secretHash: digest(secret), nonce, campusId: eligible.campus.idCampus,
        userId: eligible.user?.idUser, invitationId: eligible.invitation?.id,
        emailVerifiedAt: invitation ? new Date() : null, expiresAt: new Date(Date.now() + 10 * MINUTE) } })
    })
    return { secret, email, nonce, campusId: eligible.campus.idCampus, campusName: eligible.campus.name, googleEnabled: process.env.GOOGLE_LOGIN_ENABLED === "true" && !!process.env.GOOGLE_CLIENT_ID,
      clientId: process.env.GOOGLE_CLIENT_ID || null, emailVerified: !!invitation }
  }

  private async attempt(secret: string): Promise<Attempt> {
    if (!/^[a-f0-9]{64}$/.test(secret)) throw new AccessError("Inicie novamente o acesso", 401)
    const attempt = await this.db.accessAttempt.findUnique({ where: { secretHash: digest(secret) }, include: { invitation: true } })
    if (!attempt || attempt.consumedAt || attempt.expiresAt <= new Date()) throw new AccessError("Seu acesso expirou. Inicie novamente", 401)
    const eligible = await this.eligibility(attempt.email, attempt.campusId)
    if (attempt.invitationId && (!eligible.invitation || eligible.invitation.id !== attempt.invitationId)) {
      throw new AccessError("O convite não está mais disponível", 403)
    }
    return attempt
  }

  async sendCode(secret: string) {
    const attempt = await this.attempt(secret)
    await this.limit(`code:${attempt.email}`, 5)
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
    const now = new Date()
    const result = await this.db.accessAttempt.updateMany({ where: { id: attempt.id, consumedAt: null,
      OR: [{ codeSentAt: null }, { codeSentAt: { lt: new Date(Date.now() - MINUTE) } }] },
      data: { codeHash: digest(`${attempt.nonce}:${code}`), codeSentAt: now } })
    if (!result.count) throw new AccessError("Aguarde um minuto antes de solicitar outro código", 429)
    try {
      await this.mail({ to: attempt.email, subject: "Confirme seu acesso ao SEC-EBTT",
        text: `Seu código é ${code}. Ele expira com a tentativa de acesso, em até dez minutos.`,
        html: `<p>Seu código de confirmação é <strong>${code}</strong>.</p><p>Ele expira com a tentativa de acesso, em até dez minutos.</p>` })
    } catch { throw new AccessError("Não foi possível enviar o código. Tente novamente em um minuto", 503) }
    return { sent: true }
  }

  async verifyEmail(secret: string, code: unknown) {
    const attempt = await this.attempt(secret)
    if (attempt.emailVerifiedAt) return this.status(secret)
    if (!attempt.codeHash || typeof code !== "string" || !/^\d{6}$/.test(code)) throw new AccessError("Informe o código de seis dígitos")
    const claim = await this.db.accessAttempt.updateMany({ where: { id: attempt.id, consumedAt: null, codeAttempts: { lt: 5 } },
      data: { codeAttempts: { increment: 1 } } })
    if (!claim.count) throw new AccessError("Limite de tentativas atingido. Inicie novamente", 429)
    if (digest(`${attempt.nonce}:${code}`) !== attempt.codeHash) throw new AccessError("Código inválido")
    const verified = await this.db.accessAttempt.updateMany({ where: { id: attempt.id, codeHash: attempt.codeHash, consumedAt: null },
      data: { emailVerifiedAt: new Date(), codeHash: null } })
    if (!verified.count) throw new AccessError("Código já utilizado ou substituído", 409)
    return this.advance(secret)
  }

  async completeGoogle(secret: string, credential: unknown) {
    const attempt = await this.attempt(secret)
    if (attempt.purpose !== "LOGIN" || attempt.googleSubject) throw new AccessError("Inicie uma nova tentativa de entrada pelo Google", 409)
    if (typeof credential !== "string" || credential.length > 16000) throw new AccessError("Resposta Google inválida")
    const identity = await this.google.verify(credential, attempt.nonce)
    if (identity.email !== attempt.email) throw new AccessError(`Escolha a conta ${attempt.email} para continuar`, 403)
    const { user } = await this.eligibility(attempt.email, attempt.campusId)
    // O domínio de e-mail é validado pela política do campus; o domínio primário Google pode ser um alias diferente.
    // A primeira vinculação também exige a confirmação da caixa de e-mail.
    const linked = await this.db.googleIdentity.findUnique({ where: { provider_subject: { provider: "GOOGLE", subject: identity.subject } } })
    const ownLink = user ? await this.db.googleIdentity.findUnique({ where: { provider_userId: { provider: "GOOGLE", userId: user.idUser } } }) : null
    if ((linked && linked.userId !== user?.idUser) || (ownLink && ownLink.subject !== identity.subject)) {
      throw new AccessError("Esta conta possui outro vínculo Google. Procure a administração", 409)
    }
    const saved = await this.db.accessAttempt.updateMany({ where: { id: attempt.id, consumedAt: null, googleSubject: null },
      data: { googleSubject: identity.subject, googleEmail: identity.email,
        ...(linked?.email === identity.email ? { emailVerifiedAt: new Date() } : {}) } })
    if (!saved.count) throw new AccessError("Tentativa já utilizada", 409)
    return this.advance(secret)
  }

  private async claim(tx: Transaction, attempt: Attempt) {
    const result = await tx.accessAttempt.updateMany({ where: { id: attempt.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() } })
    if (!result.count) throw new AccessError("Tentativa já concluída ou expirada", 409)
    if (attempt.invitationId) {
      const invitation = await tx.accessInvitation.findUnique({ where: { id: attempt.invitationId } })
      if (!invitation || invitation.status === "CANCELLED" ||
        (invitation.status === "PENDING" && invitation.expiresAt <= new Date())) throw new AccessError("Convite indisponível", 403)
    }
  }

  private async link(tx: Transaction, attempt: Attempt, userId: number) {
    if (!attempt.googleSubject) return
    const own = await tx.googleIdentity.findUnique({ where: { provider_userId: { provider: "GOOGLE", userId } } })
    if (own && own.subject !== attempt.googleSubject) throw new AccessError("A conta já possui outro vínculo Google", 409)
    await tx.googleIdentity.upsert({ where: { provider_subject: { provider: "GOOGLE", subject: attempt.googleSubject } },
      create: { subject: attempt.googleSubject, userId, email: attempt.email },
      update: { email: attempt.email } })
    const linked = await tx.googleIdentity.findUnique({ where: { provider_subject: { provider: "GOOGLE", subject: attempt.googleSubject } } })
    if (linked?.userId !== userId) throw new AccessError("Esta conta Google já está vinculada a outro usuário", 409)
  }

  private async session(userId: number) {
    const user = await this.db.user.findUnique({ where: { idUser: userId }, include: sessionInclude })
    if (!user || !activeRoles(user).length) throw new AccessError("Conta sem perfil habilitado", 403)
    return { stage: "AUTHENTICATED", session: new UserService(new UserRepository()).issueSession(user) }
  }

  private async advance(secret: string) {
    const attempt = await this.attempt(secret)
    if (!attempt.emailVerifiedAt || !attempt.googleSubject) return this.status(secret)
    const { user, invitation } = await this.eligibility(attempt.email, attempt.campusId)
    if (invitation?.status === "PENDING") return this.status(secret)
    if (invitation?.status === "REVIEW") return this.monitor(attempt, user!.idUser)
    if (!user) throw new AccessError("Conclua seu cadastro antes de entrar", 403)
    try {
      await this.db.$transaction(async tx => { await this.claim(tx, attempt); await this.link(tx, attempt, user.idUser) },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) { this.conflict(error) }
    return this.session(user.idUser)
  }

  async status(secret: string) {
    const attempt = await this.attempt(secret)
    const { user, invitation } = await this.eligibility(attempt.email, attempt.campusId)
    if (attempt.purpose === "REVIEW" && invitation?.status === "ACCEPTED" && user) {
      await this.db.$transaction(async tx => { await this.claim(tx, attempt) })
      return this.session(user.idUser)
    }
    return { stage: attempt.emailVerifiedAt && attempt.purpose === "REVIEW" ? "REVIEW" :
      !attempt.emailVerifiedAt ? "VERIFY_EMAIL" : invitation?.status === "PENDING" ? "REGISTER" : "READY",
      email: attempt.email, campusId: attempt.campusId, emailVerified: !!attempt.emailVerifiedAt, googleVerified: !!attempt.googleSubject,
      nonce: attempt.nonce, clientId: process.env.GOOGLE_CLIENT_ID || null,
      googleEnabled: process.env.GOOGLE_LOGIN_ENABLED === "true" && !!process.env.GOOGLE_CLIENT_ID,
      name: user?.name ?? invitation?.name ?? "", roles: invitation ? invitationRoles(invitation.roles) : user ? activeRoles(user) : [],
      // Dados profissionais e CPF só são expostos após confirmação da caixa de e-mail.
      profile: attempt.emailVerifiedAt ? { cpf: user ? readProtectedCpf(user) ?? "" : "", ...(user?.externalEvaluator ? { siape: user.externalEvaluator.siape ?? "", evaluationCity: user.externalEvaluator.evaluationCity ?? "", qualification: user.externalEvaluator.title ?? "", institution: user.externalEvaluator.institution ?? "", workUnit: user.externalEvaluator.workUnit ?? "" } : {}),
        docenteProfile: user?.docente ? { siape: user.docente.siape, classLevel: user.docente.classLevel,
          startInterstice: user.docente.start_interstice.toISOString().slice(0, 10), educationLevel: user.docente.educationLevel } : undefined } : undefined }
  }

  private async monitor(attempt: Attempt, userId: number) {
    const secret = token()
    await this.db.$transaction(async tx => {
      await this.claim(tx, attempt)
      await tx.accessAttempt.create({ data: { secretHash: digest(secret), nonce: token(), email: attempt.email,
        invitationId: attempt.invitationId, campusId: attempt.campusId, userId, purpose: "REVIEW", emailVerifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * MINUTE) } })
    })
    return { stage: "REVIEW", secret }
  }

  async completeRegistration(secret: string, body: unknown) {
    const attempt = await this.attempt(secret)
    if (!attempt.emailVerifiedAt || attempt.purpose !== "LOGIN") throw new AccessError("Confirme seu e-mail antes de continuar", 403)
    const { error, value } = completionSchema.validate(body)
    if (error) throw new AccessError(error.details.map(detail => detail.message).join("; "))
    const data = value as AccessCompletion
    const { user, invitation } = await this.eligibility(attempt.email, attempt.campusId)
    if (!invitation || invitation.status !== "PENDING") throw new AccessError("Convite já concluído ou indisponível", 409)
    if (!attempt.googleSubject && !data.password) throw new AccessError("Defina uma senha ou confirme sua conta Google")
    if (user && readProtectedCpf(user) && data.cpf !== readProtectedCpf(user)) throw new AccessError("CPF diferente do cadastro existente. Procure a administração", 409)
    const roles = invitationRoles(invitation.roles)
    const external = externalOnly(roles)
    if (external && [data.siape, data.evaluationCity, data.qualification, data.institution, data.workUnit].some(field => !field)) {
      throw new AccessError("Preencha SIAPE, cidade da avaliação, titulação, instituição e lotação")
    }
    if (roles.includes(RoleName.DOCENTE) && !user?.docente && !data.docenteProfile) throw new AccessError("Preencha os dados funcionais do docente")
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined
    let userId: number
    try {
      userId = await this.db.$transaction(async tx => {
        await this.claim(tx, attempt)
        const changed = await tx.accessInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } },
          data: { status: external ? "REVIEW" : "ACCEPTED", tokenHash: null } })
        if (!changed.count) throw new AccessError("Convite já concluído ou cancelado", 409)
        const account = user ? await tx.user.findUnique({ where: { idUser: user.idUser } }) :
          await this.createAccount(tx, data, attempt.email, passwordHash, external, roles, attempt.campusId)
        if (!account?.active || account.deletedDate) throw new AccessError("Conta bloqueada", 403)
        if (user && !readProtectedCpf(user)) {
          const protectedCpf = protectCpf(data.cpf)
          const person = await this.personForAccount(tx, data, attempt.email, external, roles)
          await tx.user.update({ where: { idUser: user.idUser }, data: { cpf: null, cpfEncrypted: protectedCpf.cpfEncrypted,
            cpfHash: protectedCpf.cpfHash, personId: person.idPerson } })
        }
        if (user && passwordHash) await tx.user.update({ where: { idUser: user.idUser }, data: { passwordHash } })
        if (!external) for (const role of roles) {
          const record = await tx.role.findUniqueOrThrow({ where: { name: role } })
          if (record.deletedDate) throw new AccessError("Perfil indisponível", 403)
          await tx.userRole.upsert({ where: { userId_roleId: { userId: account.idUser, roleId: record.idRole } },
            create: { userId: account.idUser, roleId: record.idRole }, update: { deletedDate: null } })
        }
        if (data.docenteProfile && roles.includes(RoleName.DOCENTE) && !user?.docente) {
          const { startInterstice, ...profile } = data.docenteProfile
          await tx.docenteProfile.create({ data: { ...profile, campusId: attempt.campusId, start_interstice: new Date(startInterstice), userId: account.idUser } })
        }
        if (external) await tx.externalEvaluatorProfile.upsert({ where: { userId: account.idUser },
          create: { userId: account.idUser, siape: data.siape!, evaluationCity: data.evaluationCity!,
            title: data.qualification!, institution: data.institution!, workUnit: data.workUnit!, active: false },
          update: { siape: data.siape!, evaluationCity: data.evaluationCity!, title: data.qualification!,
            institution: data.institution!, workUnit: data.workUnit!, active: false, deletedDate: null } })
        await this.link(tx, attempt, account.idUser)
        await tx.accessInvitation.update({ where: { id: invitation.id }, data: { userId: account.idUser } })
        return account.idUser
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) { this.conflict(error) }
    if (external) {
      // A tentativa anterior foi consumida na mesma transação do cadastro.
      const secret = token()
      await this.db.accessAttempt.create({ data: { secretHash: digest(secret), nonce: token(), email: attempt.email,
        invitationId: invitation.id, campusId: attempt.campusId, userId: userId!, purpose: "REVIEW", emailVerifiedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * MINUTE) } })
      return { stage: "REVIEW", secret }
    }
    return this.session(userId!)
  }

  async passwordAccess(secret: string, password: unknown) {
    const attempt = await this.attempt(secret)
    await this.limit(`password:${attempt.email}`, 10)
    if (!attempt.emailVerifiedAt) throw new AccessError("Confirme o e-mail antes de continuar", 403)
    if (typeof password !== "string" || password.length > 100) throw new AccessError("Informe sua senha")
    const { user, invitation } = await this.eligibility(attempt.email, attempt.campusId)
    if (!user?.passwordHash || !await bcrypt.compare(password, user.passwordHash)) throw new AccessError("Senha inválida", 401)
    if (invitation?.status === "REVIEW") return this.monitor(attempt, user.idUser)
    if (invitation?.status === "PENDING") throw new AccessError("Conclua o cadastro do convite antes de continuar", 409)
    await this.db.$transaction(async tx => { await this.claim(tx, attempt) })
    return this.session(user.idUser)
  }

  async updatePending(secret: string, body: unknown) {
    const attempt = await this.attempt(secret)
    if (!attempt.emailVerifiedAt || attempt.purpose !== "REVIEW" || attempt.invitation?.status !== "REVIEW" || !attempt.userId) {
      throw new AccessError("Cadastro não está aguardando revisão", 403)
    }
    const { error, value } = completionSchema.validate(body)
    if (error) throw new AccessError("Confira os dados informados")
    const data = value as AccessCompletion
    if ([data.siape, data.evaluationCity, data.qualification, data.institution, data.workUnit].some(field => !field)) throw new AccessError("Preencha todos os dados profissionais")
    await this.db.$transaction(async tx => {
      // Bloqueia a mesma linha que a aprovação, evitando edição concorrente após a revisão.
      const pending = await tx.accessInvitation.updateMany({ where: { id: attempt.invitationId!, status: "REVIEW" }, data: { updatedAt: new Date() } })
      if (!pending.count) throw new AccessError("O cadastro já foi revisado. Atualize a situação", 409)
      const user = await tx.user.findUniqueOrThrow({ where: { idUser: attempt.userId! } })
      if (readProtectedCpf(user) !== data.cpf) throw new AccessError("Solicite à administração a correção do CPF", 409)
      await tx.user.update({ where: { idUser: user.idUser }, data: { name: data.name } })
      if (user.personId) await tx.person.update({ where: { idPerson: user.personId }, data: { name: data.name } })
      await tx.externalEvaluatorProfile.update({ where: { userId: attempt.userId! }, data: {
        siape: data.siape, evaluationCity: data.evaluationCity, title: data.qualification,
        institution: data.institution, workUnit: data.workUnit
      } })
    })
    return this.status(secret)
  }

  async approve(actor: Actor, id: string) {
    this.canManage(actor, [RoleName.EXTERNAL_EVALUATOR])
    await this.db.$transaction(async tx => {
      const invitation = await tx.accessInvitation.findUnique({ where: { id } })
      if (invitation?.campusId) this.emailPolicy.assertAccess(actor, invitation.campusId)
      else if (actor.role === RoleName.CPPD_MEMBER) throw new AccessError("Convite sem campus", 403)
      if (!invitation || invitation.status !== "REVIEW" || !invitation.userId || !externalOnly(invitationRoles(invitation.roles))) throw new AccessError("Cadastro não está aguardando revisão", 409)
      const updated = await tx.accessInvitation.updateMany({ where: { id, status: "REVIEW" },
        data: { status: "ACCEPTED", reviewedById: actor.id, reviewedAt: new Date() } })
      if (!updated.count) throw new AccessError("Cadastro já revisado", 409)
      const user = await tx.user.findUnique({ where: { idUser: invitation.userId }, include: { externalEvaluator: true } })
      const evaluator = user?.externalEvaluator
      if (!user?.active || user.deletedDate || !evaluator || evaluator.deletedDate || !evaluator.siape ||
        !evaluator.evaluationCity || !evaluator.title || !evaluator.institution || !evaluator.workUnit) throw new AccessError("Confira o cadastro e os dados profissionais antes de aprovar")
      const role = await tx.role.findUniqueOrThrow({ where: { name: RoleName.EXTERNAL_EVALUATOR } })
      if (role.deletedDate) throw new AccessError("Perfil indisponível", 403)
      await tx.externalEvaluatorProfile.update({ where: { idExternalEvaluator: evaluator.idExternalEvaluator }, data: { active: true } })
      await tx.userRole.upsert({ where: { userId_roleId: { userId: user.idUser, roleId: role.idRole } },
        create: { userId: user.idUser, roleId: role.idRole }, update: { deletedDate: null } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { approved: true }
  }

  async reviewDetails(actor: Actor, id: string) {
    const invitation = await this.db.accessInvitation.findUnique({ where: { id } })
    if (!invitation) throw new AccessError("Convite não encontrado", 404)
    this.canManage(actor, invitationRoles(invitation.roles))
    if (invitation.campusId) this.emailPolicy.assertAccess(actor, invitation.campusId)
    else if (actor.role === RoleName.CPPD_MEMBER) throw new AccessError("Convite sem campus; solicite ajuste à administração", 403)
    if (!invitation.userId) return null
    const user = await this.db.user.findUnique({ where: { idUser: invitation.userId }, include: { externalEvaluator: true } })
    if (!user?.externalEvaluator) return null
    return { name: user.name, email: user.email, ...user.externalEvaluator, qualification: user.externalEvaluator.title }
  }

  private async createAccount(tx: Transaction, data: AccessCompletion, email: string, passwordHash: string | undefined, external: boolean, roles: RoleName[], campusId: number | null) {
    const protectedCpf = protectCpf(data.cpf)
    const person = await this.personForAccount(tx, data, email, external, roles)
    return tx.user.create({ data: { name: data.name, email, campusId, cpf: null, cpfEncrypted: protectedCpf.cpfEncrypted,
      cpfHash: protectedCpf.cpfHash, personId: person.idPerson, passwordHash: passwordHash ?? null } })
  }

  private async personForAccount(tx: Transaction, data: AccessCompletion, email: string, external: boolean, roles: RoleName[]) {
    const protectedCpf = protectCpf(data.cpf)
    const existingPerson = await tx.person.findUnique({ where: { email } })
    if (existingPerson && (!existingPerson.active || (existingPerson.cpfHash && existingPerson.cpfHash !== protectedCpf.cpfHash))) {
      throw new AccessError("Dados incompatíveis com a pessoa já cadastrada. Procure a administração", 409)
    }
    return tx.person.upsert({ where: { email },
      update: { name: data.name, cpfEncrypted: protectedCpf.cpfEncrypted, cpfHash: protectedCpf.cpfHash },
      create: { name: data.name, email, cpfEncrypted: protectedCpf.cpfEncrypted, cpfHash: protectedCpf.cpfHash,
        type: external ? PersonType.EXTERNAL_EVALUATOR : roles.includes(RoleName.DOCENTE) ? PersonType.TEACHER : roles.some(role => role === RoleName.CPPD_MEMBER || role === RoleName.CPPD_CENTRAL) ? PersonType.CPPD_MEMBER : PersonType.OTHER }
    })
  }

  private conflict(error: unknown): never {
    if (error instanceof AccessError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      throw new AccessError("Cadastro ou tentativa já utilizado. Atualize a situação; se o CPF já existir, procure a administração", 409)
    }
    throw error
  }
}
