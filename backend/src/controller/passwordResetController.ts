import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { PasswordResetService } from "../service/passwordResetService"

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
}
