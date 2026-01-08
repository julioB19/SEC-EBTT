import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const ME_PATH = process.env.BACKEND_ME_PATH || ""

export async function GET() {
  const cookieStore = await cookies()
  const access = cookieStore.get("accessToken")?.value || ""
  const url = backend && ME_PATH ? `${backend}${ME_PATH}` : ""
  if (!backend || !ME_PATH) return NextResponse.json({ hasAccessCookie: !!access, backendUrl: backend, mePath: ME_PATH, url, note: "missing_env" }, { status: 500 })
  if (!access) return NextResponse.json({ hasAccessCookie: false, backendUrl: backend, mePath: ME_PATH, url, note: "missing_access_cookie" }, { status: 401 })
  const r = await fetch(url, { headers: { Authorization: `Bearer ${access}` }, cache: "no-store" })
  const text = await r.text().catch(() => "")
  return NextResponse.json({ hasAccessCookie: true, backendUrl: backend, mePath: ME_PATH, url, meStatus: r.status, meBody: text })
}
