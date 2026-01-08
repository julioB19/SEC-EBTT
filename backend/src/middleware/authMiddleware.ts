import jwt from "jsonwebtoken"
import { HttpResponse, StatusCodeDescription } from "../util/httpResponse"
import { isAccessTokenRevoked } from "../util/tokenBlacklist"

export function authMiddleware(req: any, res: any, next: any) {
  const header: string | undefined = req.headers?.authorization || req.header("Authorization")

  if (!header) {
    return HttpResponse.badRequest(res, StatusCodeDescription.INVALID_INPUT, "'Authorization' header is required", null)
  }

  let token = header.trim()
  token = token.replace(/^bearer[:=]?\s+/i, "")
  if (/^bearer/i.test(token)) {
    const parts = token.split(/\s+/)
    if (parts.length >= 2) token = parts.slice(1).join(" ")
  }
  token = token.replace(/^['"]+|['"]+$/g, "").trim()

  
  const jwtShape = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
  if (!jwtShape.test(token)) {
    console.log("Token no header com formato inválido")
    return HttpResponse.unauthorized(res)
  }

  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret || !secret.length) {
    console.error("JWT_ACCESS_SECRET ausente nas variáveis de ambiente")
    return HttpResponse.internalError(res)
  }

  if (isAccessTokenRevoked(token)) {
    console.log("Access token revogado")
    return HttpResponse.unauthorized(res)
  }

  try {
    const decoded = jwt.verify(token, String(secret))
    ;(req as any).user = decoded
    next()
  } catch (error: any) {
    console.log("JWT verify falhou:", error?.message)
    return HttpResponse.unauthorized(res)
  }
}
