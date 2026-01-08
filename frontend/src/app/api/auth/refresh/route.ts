import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const backend = process.env.BACKEND_URL!

type RefreshResponse = {
  accessToken: string
  expiresIn: string
  refreshToken: string
  refreshExpiresIn: string
  roles: string[]
  selectedRole: string | null
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
    case "s": return n
    case "m": return n * 60
    case "h": return n * 3600
    case "d": return n * 86400
    default: return n
  }
}

export async function POST() {
  const jar = await cookies()
  const refreshToken = jar.get("refreshToken")?.value
  if (!refreshToken) {
    return NextResponse.json({ message: "missing refresh token" }, { status: 401 })
  }

  const r = await fetch(`${backend}/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  })

  const json = await r.json()
  if (!r.ok) {
    return NextResponse.json(json, { status: r.status })
  }

  const data = json?.data as RefreshResponse
  const res = NextResponse.json(data, { status: 200 })

  res.cookies.set("accessToken", data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: parseDurationToSeconds(data.expiresIn)
  })

  res.cookies.set("refreshToken", data.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: parseDurationToSeconds(data.refreshExpiresIn)
  })

  return res
}
