import { NextResponse } from "next/server"

export function durationSeconds(value: string) {
  const match = String(value).match(/^(\d+)\s*([smhd])?$/i)
  if (!match) return 0
  return Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2]?.toLowerCase() || "s"] || 1)
}

export function setSessionCookies(response: NextResponse, session: {
  accessToken: string; refreshToken: string; expiresIn: string; refreshExpiresIn: string
}) {
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" }
  response.cookies.set("accessToken", session.accessToken, { ...options, maxAge: durationSeconds(session.expiresIn) })
  response.cookies.set("refreshToken", session.refreshToken, { ...options, maxAge: durationSeconds(session.refreshExpiresIn) })
}
