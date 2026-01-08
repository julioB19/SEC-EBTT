import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

type Role = "DOCENTE" | "CPPD_MEMBER" | "ADMIN"

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(
      base64.length + (4 - (base64.length % 4)) % 4,
      "="
    )
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = "/login"
  return NextResponse.redirect(url)
}

function redirectToForbidden(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = "/forbidden"
  return NextResponse.redirect(url)
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const accessToken = req.cookies.get("accessToken")?.value
  if (!accessToken) return redirectToLogin(req)

  const payload = decodeJwtPayload(accessToken)
  if (!payload) return redirectToLogin(req)

  const roles: Role[] = Array.isArray(payload.roles) ? payload.roles : []
  const selectedRole: Role | null = payload.selectedRole ?? null

  const hasRole = (role: Role) => roles.includes(role)

  if (pathname.startsWith("/docente")) {
    if (!hasRole("DOCENTE")) return redirectToForbidden(req)
    if (selectedRole && selectedRole !== "DOCENTE") return redirectToForbidden(req)
  }

  if (pathname.startsWith("/cppd")) {
    if (!hasRole("CPPD_MEMBER")) return redirectToForbidden(req)
    if (selectedRole && selectedRole !== "CPPD_MEMBER") return redirectToForbidden(req)
  }

  if (pathname.startsWith("/admin")) {
    if (!hasRole("ADMIN")) return redirectToForbidden(req)
    if (selectedRole && selectedRole !== "ADMIN") return redirectToForbidden(req)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/docente/:path*",
    "/cppd/:path*",
    "/forbidden/:path*",
    "/dashboard/:path*"
  ]
}
