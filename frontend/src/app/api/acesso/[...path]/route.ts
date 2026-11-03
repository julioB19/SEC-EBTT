import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { setSessionCookies } from "@/lib/sessionCookies"

const publicRoutes: Record<string, string> = {
  start: "/auth/google/start", google: "/auth/google/complete", "send-code": "/auth/access/send-code",
  "verify-email": "/auth/access/verify-email", status: "/auth/access/status", complete: "/auth/access/complete",
  password: "/auth/access/password", "update-pending": "/auth/access/update-pending", config: "/auth/access/config", campuses: "/auth/access/campuses"
}
const attemptCookie = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/api/acesso" }

async function proxy(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path
  const action = parts.join("/")
  const policy = parts[0] === "campus-policy" && (action === "campus-policy/campuses" || (/^\d+$/.test(parts[1] || "") && parts[2] === "domains" && (parts.length === 3 || (parts.length === 4 && /^[a-z0-9]+$/.test(parts[3])))))
  const management = policy || parts[0] === "invitations" &&
    (parts.length === 1 || (parts.length === 3 && /^[a-z0-9]+$/.test(parts[1]) && ["resend", "cancel", "approve", "review"].includes(parts[2])))
  if ((!publicRoutes[action] && !management) ||
    (req.method === "GET" && action !== "config" && action !== "campuses" && !policy && !(management && (parts.length === 1 || parts[2] === "review")))) {
    return NextResponse.json({ message: "Operação inválida" }, { status: 404 })
  }
  if (req.method !== "GET" && req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ message: "Origem da solicitação inválida" }, { status: 403 })
  }
  const backend = process.env.BACKEND_URL
  if (!backend) return NextResponse.json({ message: "Servidor não configurado" }, { status: 503 })
  const jar = await cookies()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (management) {
    const access = jar.get("accessToken")?.value
    if (!access) return NextResponse.json({ message: "Entre novamente no sistema" }, { status: 401 })
    headers.Authorization = `Bearer ${access}`
  }
  let body: Record<string, unknown> = {}
  if (req.method !== "GET") {
    try { body = await req.json() } catch { return NextResponse.json({ message: "Solicitação inválida" }, { status: 400 }) }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ message: "Solicitação inválida" }, { status: 400 })
    // A página nunca escolhe nem recebe o segredo da sessão provisória.
    delete body.attemptSecret
    if (!management && action !== "start") body.attemptSecret = jar.get("accessAttempt")?.value || ""
  }
  try {
    const upstream = await fetch(`${backend}${management ? `/access/${action}` : publicRoutes[action]}`, {
      method: req.method, headers, cache: "no-store", body: req.method !== "GET" ? JSON.stringify(body) : undefined
    })
    const json = await upstream.json()
    const data = json.data
    let secret: string | undefined
    let session: (Parameters<typeof setSessionCookies>[1] & { roles: string[]; selectedRole: string | null; needsProfileSelection: boolean }) | undefined
    if (upstream.ok && data) {
      secret = data.secret
      session = data.session
      delete data.secret
      delete data.session
      if (session) {
        data.roles = session.roles
        data.selectedRole = session.selectedRole
        data.needsProfileSelection = session.needsProfileSelection
      }
    }
    const response = NextResponse.json(json, { status: upstream.status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } })
    if (secret) response.cookies.set("accessAttempt", secret, { ...attemptCookie, maxAge: data.stage === "REVIEW" ? 86400 : 600 })
    if (session) {
      setSessionCookies(response, session)
      response.cookies.set("accessAttempt", "", { ...attemptCookie, maxAge: 0 })
    }
    return response
  } catch {
    return NextResponse.json({ message: "O servidor está indisponível. Tente novamente" }, { status: 503 })
  }
}

export const POST = proxy
export const GET = proxy
