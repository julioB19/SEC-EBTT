import bcrypt from "bcryptjs"
import { prisma } from "../infra/prismaClient"
import { sendMail } from "../util/mailer"

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
  private async createResetCode(userId: number) {
    const ttlMin = intEnv("PASSWORD_RESET_CODE_TTL_MINUTES", 15)
    const codeLen = intEnv("PASSWORD_RESET_CODE_LENGTH", 6)

    await prisma.passwordResetCode.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    })

    const code = generateNumericCode(codeLen)
    const codeHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000)

    await prisma.passwordResetCode.create({
      data: {
        userId,
        codeHash,
        expiresAt
      }
    })

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

  private async sendInviteEmail(input: { to: string; name?: string | null; cpf: string; code: string; ttlMin: number }) {
    const appUrl = getAppUrl()
    const qs = `cpf=${encodeURIComponent(input.cpf)}&code=${encodeURIComponent(input.code)}`
    const link = appUrl ? `${appUrl}/definir-senha?${qs}` : ""

    const subject = "Acesso ao sistema: defina sua senha"
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

        <p>Esse link/código expira em <b>${input.ttlMin} minutos</b>.</p>
        <p>Se você não esperava esse convite, pode ignorar este e-mail.</p>
      </div>
    `

    const text = link
      ? `Você foi convidado(a) para acessar o sistema. Defina sua senha em: ${link} (expira em ${input.ttlMin} minutos).`
      : `Você foi convidado(a) para acessar o sistema. Seu código para definir a senha é: ${input.code}. Expira em ${input.ttlMin} minutos.`

    await sendMail({
      to: input.to,
      subject,
      html,
      text
    })
  }

  private async issueCodeForCpf(cpf: string, context: ResetContext): Promise<void> {
    const cleanCpf = onlyDigits(cpf)

    const user = await prisma.user.findUnique({
      where: { cpf: cleanCpf },
      select: { idUser: true, email: true, name: true, deletedDate: true, active: true, cpf: true }
    })

    if (context === "RESET") {
      if (!user || user.deletedDate || !user.active) return
    }

    if (context === "INVITE") {
      if (!user) throw new Error("Usuário não encontrado")
      if (user.deletedDate || !user.active) throw new Error("Usuário inativo")
    }

    const { code, ttlMin } = await this.createResetCode(user!.idUser)

    if (context === "RESET") {
      await this.sendResetEmail({ to: user!.email, name: user!.name, code, ttlMin })
      return
    }

    await this.sendInviteEmail({ to: user!.email, name: user!.name, cpf: user!.cpf, code, ttlMin })
  }

  async requestReset(cpf: string): Promise<void> {
    await this.issueCodeForCpf(cpf, "RESET")
  }

  async inviteFirstAccessByCpf(cpf: string): Promise<void> {
    await this.issueCodeForCpf(cpf, "INVITE")
  }

  async confirmReset(cpf: string, code: string, newPassword: string): Promise<void> {
    const cleanCpf = onlyDigits(cpf)

    const user = await prisma.user.findUnique({
      where: { cpf: cleanCpf },
      select: { idUser: true, deletedDate: true, active: true }
    })

    if (!user || user.deletedDate || !user.active) {
      throw new Error("Código inválido ou expirado")
    }

    const record = await prisma.passwordResetCode.findFirst({
      where: {
        userId: user.idUser,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    })

    if (!record) throw new Error("Código inválido ou expirado")

    const ok = await bcrypt.compare(String(code || "").trim(), record.codeHash)
    if (!ok) throw new Error("Código inválido ou expirado")

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: { idUser: user.idUser },
        data: { passwordHash }
      }),
      prisma.passwordResetCode.update({
        where: { idPasswordResetCode: record.idPasswordResetCode },
        data: { usedAt: new Date() }
      })
    ])
  }
}
