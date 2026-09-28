import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  return NextResponse.redirect(url)
}

function redirectToForbidden(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = "/forbidden"
  url.search = ""
  return NextResponse.redirect(url)
}

function redirectToEnsureRole(req: NextRequest, role: Role) {
  const url = req.nextUrl.clone()
  const next = `${req.nextUrl.pathname}${req.nextUrl.search || ""}`

  url.pathname = "/api/auth/ensure-role"
  url.search = ""
  url.searchParams.set("role", role)
  url.searchParams.set("next", next)

  return NextResponse.redirect(url)
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/forbidden")) {
    return NextResponse.next()
  }

  const accessToken = req.cookies.get("accessToken")?.value
  if (!accessToken) return redirectToLogin(req)

  const payload = decodeJwtPayload(accessToken)
  if (!payload) return redirectToLogin(req)

  const roles: Role[] = Array.isArray(payload.roles) ? payload.roles : []
  const selectedRole: Role | null = payload.selectedRole ?? null

  const hasRole = (role: Role) => roles.includes(role)

  if (pathname.startsWith("/docente")) {
    if (!hasRole("DOCENTE")) return redirectToForbidden(req)

    if (!selectedRole || selectedRole !== "DOCENTE") {
      return redirectToEnsureRole(req, "DOCENTE")
    }
  }

  if (pathname.startsWith("/cppd")) {
    const cppdRole = hasRole("CPPD_CENTRAL")
      ? "CPPD_CENTRAL"
      : hasRole("CPPD_MEMBER")
        ? "CPPD_MEMBER"
        : null
    if (!cppdRole) return redirectToForbidden(req)

    if (selectedRole !== "CPPD_MEMBER" && selectedRole !== "CPPD_CENTRAL") {
      return redirectToEnsureRole(req, cppdRole)
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!hasRole("ADMIN")) return redirectToForbidden(req)

    if (!selectedRole || selectedRole !== "ADMIN") {
      return redirectToEnsureRole(req, "ADMIN")
    }
  }

  if (pathname.startsWith("/avaliador")) {
    if (!hasRole("EXTERNAL_EVALUATOR")) return redirectToForbidden(req)

    if (!selectedRole || selectedRole !== "EXTERNAL_EVALUATOR") {
      return redirectToEnsureRole(req, "EXTERNAL_EVALUATOR")
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/docente/:path*", "/cppd/:path*", "/dashboard/:path*", "/avaliador/:path*"]
}
