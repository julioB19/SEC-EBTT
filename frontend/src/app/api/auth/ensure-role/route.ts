import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const backend = process.env.BACKEND_URL!

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

type SelectRoleResponse = {
  accessToken: string
  expiresIn: string
  refreshToken: string
  refreshExpiresIn: string
}

const roles: Role[] = ["DOCENTE", "CPPD_MEMBER", "CPPD_CENTRAL", "ADMIN", "EXTERNAL_EVALUATOR"]

function parseDurationToSeconds(input: string) {
  const match = String(input).trim().toLowerCase().match(/^(\d+)\s*([smhd])?$/)
  if (!match) return 0

  const value = Number.parseInt(match[1], 10)
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * multipliers[(match[2] ?? "s") as keyof typeof multipliers]
}

function safeNextPath(req: NextRequest, role: Role) {
  const requested = req.nextUrl.searchParams.get("next")
  if (requested?.startsWith("/") && !requested.startsWith("//")) return requested
  if (role === "DOCENTE") return "/docente"
  if (role === "CPPD_MEMBER" || role === "CPPD_CENTRAL") return "/cppd"
  if (role === "EXTERNAL_EVALUATOR") return "/avaliador"
  return "/admin"
}

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role") as Role | null
  if (!role || !roles.includes(role)) {
    return NextResponse.redirect(new URL("/forbidden", req.url))
  }

  const jar = await cookies()
  const refreshToken = jar.get("refreshToken")?.value
  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const response = await fetch(`${backend}/select-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken, role }),
    cache: "no-store"
  })

  if (!response.ok) {
    return NextResponse.redirect(new URL("/forbidden", req.url))
  }

  const json = await response.json()
  const data = json?.data as SelectRoleResponse
  const redirect = NextResponse.redirect(new URL(safeNextPath(req, role), req.url))

  redirect.cookies.set("accessToken", data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: parseDurationToSeconds(data.expiresIn)
  })
  redirect.cookies.set("refreshToken", data.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: parseDurationToSeconds(data.refreshExpiresIn)
  })

  return redirect
}
