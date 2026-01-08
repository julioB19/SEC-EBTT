import { NextResponse } from "next/server"

const backend = process.env.BACKEND_URL!

type LoginResponse = {
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

export async function POST(req: Request) {
  const body = await req.json()

  const r = await fetch(`${backend}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  const json = await r.json()
  if (!r.ok) {
    return NextResponse.json(json, { status: r.status })
  }

  const data = json?.data as LoginResponse
  const res = NextResponse.json(data, { status: 200 })

  res.cookies.set("accessToken", data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, //produção: true
    path: "/",
    maxAge: parseDurationToSeconds(data.expiresIn)
  })

  res.cookies.set("refreshToken", data.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, //produção: true
    path: "/",
    maxAge: parseDurationToSeconds(data.refreshExpiresIn)
  })

  return res
}
