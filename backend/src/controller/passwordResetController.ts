import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { PasswordResetService } from "../service/passwordResetService"
import { RoleName } from "@prisma/client"

export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  async request(req: any, res: any): Promise<void> {
    try {
      const cpf = String(req.body?.cpf || "")
      await this.passwordResetService.requestReset(cpf)

      return HttpResponse.ok(res, "Se o CPF existir, enviaremos um código no e-mail cadastrado.", null)
    } catch (error: any) {
      console.log("Request failed:", error?.message)
      return HttpResponse.internalError(res)
    }
  }

  async invite(req: any, res: any): Promise<void> {
    try {
      const roles: RoleName[] = Array.isArray(req.user?.roles) ? req.user.roles : []
      const canInvite = roles.some(
        role => role === RoleName.ADMIN || role === RoleName.CPPD_MEMBER || role === RoleName.CPPD_CENTRAL
      )
      if (!canInvite) {
        res.status(403).json({
          status: StatusCodeDescription.FORBIDDEN,
          message: "Usuário sem permissão para enviar convites",
          data: null
        })
        return
      }

      const cpf = String(req.body?.cpf || "").trim()
      const email = String(req.body?.email || "").trim()

      if (email) await this.passwordResetService.inviteFirstAccessByEmail(email)
      else await this.passwordResetService.inviteFirstAccessByCpf(cpf)

      return HttpResponse.ok(res, "Link para redefinição de senha enviado para o email cadastrado.", null)
    } catch (error: any) {
      console.log("Request failed:", error?.message)
      return HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        error?.message || "Falha ao convidar",
        null
      )
    }
  }

  async confirm(req: any, res: any): Promise<void> {
    try {
      const cpf = String(req.body?.cpf || "")
      const code = String(req.body?.code || "")
      const newPassword = String(req.body?.newPassword || "")

      await this.passwordResetService.confirmReset(cpf, code, newPassword)

      return HttpResponse.ok(res, "Senha atualizada com sucesso", null)
    } catch (error: any) {
      console.log("Request failed:", error?.message)
      return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, error?.message || "Invalid reset", null)
    }
  }

  async confirmInvitation(req: any, res: any): Promise<void> {
    try {
      const email = String(req.body?.email || "")
      const code = String(req.body?.code || "")
      const cpf = String(req.body?.cpf || "")
      const newPassword = String(req.body?.newPassword || "")

      await this.passwordResetService.confirmInvitation(email, code, cpf, newPassword)

      return HttpResponse.ok(res, "Cadastro concluído com sucesso", null)
    } catch (error: any) {
      console.log("Request failed:", error?.message)
      return HttpResponse.badRequest(
        res,
        StatusCodeDescription.INVALID_INPUT,
        error?.message || "Convite inválido",
        null
      )
    }
  }
}
