import { OAuth2Client } from "google-auth-library"
import { AccessError } from "../util/accessPolicy"

export class GoogleIdentityService {
  async verify(credential: string, nonce: string): Promise<{ subject: string; email: string; domain?: string }> {
    const audience = process.env.GOOGLE_CLIENT_ID
    if (!audience || process.env.GOOGLE_LOGIN_ENABLED !== "true") {
      throw new AccessError("A entrada pelo Google não está disponível", 503)
    }
    try {
      const ticket = await new OAuth2Client(audience).verifyIdToken({ idToken: credential, audience })
      const payload = ticket.getPayload()
      if (!payload?.sub || !payload.email || !payload.email_verified || payload.nonce !== nonce) {
        throw new Error("Identidade ou desafio inválido")
      }
      return { subject: payload.sub, email: payload.email.trim().toLowerCase(), domain: payload.hd }
    } catch {
      throw new AccessError("Não foi possível confirmar a conta Google. Tente novamente", 401)
    }
  }
}
