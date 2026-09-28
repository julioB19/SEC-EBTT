import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { sendMail } from "../util/mailer"
import { PasswordResetRepository } from "../repository/passwordResetRepository"

function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

function intEnv(name: string, fallback: number) {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

function generateNumericCode(len: number) {
  let out = ""
  for (let i = 0; i < len; i++) out += String(Math.floor(Math.random() * 10))
  return out
}

function getAppUrl() {
  const a = String(process.env.APP_URL || "").trim()
  const b = String(process.env.FRONTEND_URL || "").trim()
  const url = a || b
  return url.replace(/\/+$/g, "")
}

type ResetContext = "RESET" | "INVITE"

export class PasswordResetService {
  constructor(private readonly repository: PasswordResetRepository) {}

  private async createResetCode(userId: number, context: ResetContext) {
    const ttlMin =
      context === "INVITE"
        ? intEnv("PASSWORD_INVITE_CODE_TTL_MINUTES", 24 * 60)
        : intEnv("PASSWORD_RESET_CODE_TTL_MINUTES", 15)

    const codeLen = intEnv("PASSWORD_RESET_CODE_LENGTH", 6)

    await this.repository.invalidateActiveCodes(userId, new Date())

    const code = context === "INVITE" ? randomBytes(32).toString("base64url") : generateNumericCode(codeLen)
    const codeHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000)

    await this.repository.createCode(userId, codeHash, expiresAt)

    return { code, ttlMin }
  }

  private async sendResetEmail(input: { to: string; name?: string | null; code: string; ttlMin: number }) {
    const subject = "Código para redefinir sua senha"
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.4">
        <p>Olá${input.name ? `, ${input.name}` : ""}.</p>
        <p>Seu código para redefinir a senha é:</p>
        <p style="font-size: 22px; font-weight: bold; letter-spacing: 3px">${input.code}</p>
        <p>Esse código expira em <b>${input.ttlMin} minutos</b>.</p>
        <p>Se você não solicitou isso, pode ignorar este e-mail.</p>
      </div>
    `

    await sendMail({
      to: input.to,
      subject,
      html,
      text: `Seu código para redefinir a senha é: ${input.code}. Expira em ${input.ttlMin} minutos.`
    })
  }

  private async sendInviteEmail(input: {
    to: string
    name?: string | null
    cpf?: string | null
    code: string
    ttlMin: number
  }) {
    const appUrl = getAppUrl()
    const invitationByEmail = !input.cpf
    const qs = invitationByEmail
      ? `email=${encodeURIComponent(input.to)}&code=${encodeURIComponent(input.code)}`
      : `cpf=${encodeURIComponent(input.cpf!)}&code=${encodeURIComponent(input.code)}`
    const page = invitationByEmail ? "accept-invitation" : "reset-password"
    const link = appUrl ? `${appUrl}/${page}?${qs}` : ""

    const subject = "Acesso ao sistema: defina sua senha"
    const hours = Math.round((input.ttlMin / 60) * 10) / 10

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.4">
        <p>Olá${input.name ? `, ${input.name}` : ""}.</p>
        <p>Você foi convidado(a) para acessar o sistema. Para concluir seu primeiro acesso, defina uma senha.</p>

        ${
          link
            ? `<p><a href="${link}" target="_blank" rel="noopener noreferrer">Clique aqui para definir sua senha</a></p>`
            : `<p>Seu código para definir a senha é:</p>
               <p style="font-size: 22px; font-weight: bold; letter-spacing: 3px">${input.code}</p>`
        }

        <p>Esse link/código expira em <b>${hours} horas</b>.</p>
        <p>Se você não esperava esse convite, pode ignorar este e-mail.</p>
      </div>
    `

    const text = link
      ? `Você foi convidado(a) para acessar o sistema. Defina sua senha em: ${link} (expira em ${hours} horas).`
      : `Você foi convidado(a) para acessar o sistema. Seu código para definir a senha é: ${input.code}. Expira em ${hours} horas.`

    await sendMail({
      to: input.to,
      subject,
      html,
      text
    })
  }

  private async issueCodeForCpf(cpf: string, context: ResetContext): Promise<void> {
    const cleanCpf = onlyDigits(cpf)

    const user = await this.repository.findUserByCpf(cleanCpf)

    if (!user) {
      if (context === "RESET") return
      throw new Error("Usuário não encontrado")
    }

    if (context === "RESET") {
      if (!user || user.deletedDate || !user.active) return
    }

    if (context === "INVITE") {
      if (!user) throw new Error("Usuário não encontrado")
      if (user.deletedDate || !user.active) throw new Error("Usuário inativo")
    }

    if (!user.email) {
      if (context === "RESET") return
      throw new Error("Usuário sem e-mail cadastrado")
    }

    const { code, ttlMin } = await this.createResetCode(user.idUser, context)

    if (context === "RESET") {
      await this.sendResetEmail({
        to: user.email,
        name: user.name,
        code,
        ttlMin
      })
      return
    }

    await this.sendInviteEmail({
      to: user.email,
      name: user.name,
      cpf: user.cpf ?? cleanCpf,
      code,
      ttlMin
    })
  }

  async requestReset(cpf: string): Promise<void> {
    await this.issueCodeForCpf(cpf, "RESET")
  }

  async inviteFirstAccessByCpf(cpf: string): Promise<void> {
    await this.issueCodeForCpf(cpf, "INVITE")
  }

  async inviteFirstAccessByEmail(email: string): Promise<void> {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase()
    const user = await this.repository.findUserByEmail(normalizedEmail)

    if (!user) throw new Error("Usuário não encontrado")
    if (user.deletedDate || !user.active) throw new Error("Usuário inativo")

    const { code, ttlMin } = await this.createResetCode(user.idUser, "INVITE")
    await this.sendInviteEmail({
      to: user.email,
      name: user.name,
      cpf: user.cpf,
      code,
      ttlMin
    })
  }

  async confirmReset(cpf: string, code: string, newPassword: string): Promise<void> {
    const cleanCpf = onlyDigits(cpf)

    const user = await this.repository.findUserByCpf(cleanCpf)

    if (!user || user.deletedDate || !user.active) {
      throw new Error("Código inválido ou expirado")
    }

    const record = await this.repository.findLatestActiveCode(user.idUser, new Date())

    if (!record) throw new Error("Código inválido ou expirado")

    const ok = await bcrypt.compare(String(code || "").trim(), record.codeHash)
    if (!ok) throw new Error("Código inválido ou expirado")

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await this.repository.updatePasswordAndUseCode(user.idUser, passwordHash, record.idPasswordResetCode, new Date())
  }

  async confirmInvitation(email: string, code: string, cpf: string, newPassword: string): Promise<void> {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase()
    const cleanCpf = onlyDigits(cpf)
    const user = await this.repository.findUserByEmail(normalizedEmail)

    if (!user || user.deletedDate || !user.active) {
      throw new Error("Convite inválido ou expirado")
    }
    if (user.cpf && user.cpf !== cleanCpf) {
      throw new Error("O CPF informado não corresponde ao cadastro")
    }

    const record = await this.repository.findLatestActiveCode(user.idUser, new Date())
    if (!record) throw new Error("Convite inválido ou expirado")

    const ok = await bcrypt.compare(String(code || "").trim(), record.codeHash)
    if (!ok) throw new Error("Convite inválido ou expirado")

    const passwordHash = await bcrypt.hash(newPassword, 10)

    try {
      await this.repository.updateCredentialsAndUseCode(
        user.idUser,
        cleanCpf,
        passwordHash,
        record.idPasswordResetCode,
        new Date()
      )
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new Error("Este CPF já está vinculado a outro usuário")
      }
      throw error
    }
  }
}
