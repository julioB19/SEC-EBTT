import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const backend = process.env.BACKEND_URL!

type Role = "DOCENTE" | "CPPD_MEMBER" | "CPPD_CENTRAL" | "ADMIN" | "EXTERNAL_EVALUATOR"

type SelectRoleResponse = {
  accessToken: string
  expiresIn: string
  refreshToken: string
  refreshExpiresIn: string
  roles: Role[]
  selectedRole: Role | null
  needsProfileSelection: boolean
  firstAccess: boolean
}

function parseDurationToSeconds(input: string) {
  const v = String(input).trim().toLowerCase()
  const m = v.match(/^(\d+)\s*([smhd])?$/)
  if (!m) return 0
  const n = parseInt(m[1], 10)
  const u = m[2] ?? "s"
  switch (u) {
    case "s":
      return n
    case "m":
      return n * 60
    case "h":
      return n * 3600
    case "d":
      return n * 86400
    default:
      return n
  }
}

export async function POST(req: Request) {
  const { role } = (await req.json()) as { role: Role }

  const jar = await cookies()
  const refreshToken = jar.get("refreshToken")?.value

  if (!refreshToken) {
    return NextResponse.json({ message: "missing refresh token" }, { status: 401 })
  }

  const r = await fetch(`${backend}/select-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken, role })
  })

  const json = await r.json().catch(() => ({}) as any)
  if (!r.ok) {
    return NextResponse.json(json, { status: r.status })
  }

  const data = json?.data as SelectRoleResponse
  const res = NextResponse.json(data, { status: 200 })

  res.cookies.set("accessToken", data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // produção: true
    path: "/",
    maxAge: parseDurationToSeconds(data.expiresIn)
  })

  res.cookies.set("refreshToken", data.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // produção: true
    path: "/",
    maxAge: parseDurationToSeconds(data.refreshExpiresIn)
  })

  return res
}
