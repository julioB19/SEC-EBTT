import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { OAuth2Client } from "google-auth-library"
import { GoogleIdentityService } from "../../../src/service/googleIdentityService"

jest.mock("google-auth-library", () => ({ OAuth2Client: jest.fn() }))

describe("Verificação Google no servidor", () => {
  const verifyIdToken = jest.fn<(...args: any[]) => Promise<any>>()
  const service = new GoogleIdentityService()
  const payload = { sub: "stable-google-id", email: "nome@iffar.edu.br", email_verified: true, hd: "iffar.edu.br", nonce: "expected-nonce" }
  beforeEach(() => {
    process.env.GOOGLE_LOGIN_ENABLED = "true"
    process.env.GOOGLE_CLIENT_ID = "our-web-client"
    ;(OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({ verifyIdToken }))
    verifyIdToken.mockResolvedValue({ getPayload: () => payload })
  })
  test("usa a biblioteca oficial com o destinatário configurado e devolve identidade verificada", async () => {
    expect(await service.verify("signed-token", "expected-nonce")).toEqual({ subject: payload.sub, email: payload.email, domain: payload.hd })
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: "signed-token", audience: "our-web-client" })
  })
  test.each(["assinatura inválida", "token expirado", "destinatário diferente", "emissor diferente"])("recusa falha de validação: %s", async reason => {
    verifyIdToken.mockRejectedValue(new Error(reason))
    await expect(service.verify("bad-token", "expected-nonce")).rejects.toMatchObject({ status: 401 })
  })
  test.each([
    { ...payload, email_verified: false }, { ...payload, nonce: "other-nonce" },
    { ...payload, sub: "" }, { ...payload, email: "" }
  ])("recusa identidade sem confirmação ou desafio correspondente", async invalid => {
    verifyIdToken.mockResolvedValue({ getPayload: () => invalid })
    await expect(service.verify("token", "expected-nonce")).rejects.toMatchObject({ status: 401 })
  })
  test("desativar Google mantém o verificador indisponível", async () => {
    process.env.GOOGLE_LOGIN_ENABLED = "false"
    await expect(service.verify("token", "expected-nonce")).rejects.toMatchObject({ status: 503 })
    expect(verifyIdToken).not.toHaveBeenCalled()
  })
})
