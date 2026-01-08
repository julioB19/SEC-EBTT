import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

function backendUrlOrError() {
  const backendUrl = process.env.BACKEND_URL
  if (!backendUrl) {
    const body: ApiResponse = { status: "error", message: "BACKEND_URL não configurada", data: null }
    return { ok: false as const, res: NextResponse.json(body, { status: 500 }) }
  }
  return { ok: true as const, backendUrl }
}

async function accessTokenOrError() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value

  if (!access) {
    const body: ApiResponse = { status: "error", message: "missing access token", data: null }
    return { ok: false as const, res: NextResponse.json(body, { status: 401 }) }
  }

  return { ok: true as const, access }
}

export async function GET(req: NextRequest) {
  const backend = backendUrlOrError()
  if (!backend.ok) return backend.res

  const auth = await accessTokenOrError()
  if (!auth.ok) return auth.res

  const url = new URL(`${backend.backendUrl}/admin/tabelas-pontuacao`)
  req.nextUrl.searchParams.forEach((value, key) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, value)
    }
  })

  const backendRes = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth.access}`
    },
    cache: "no-store"
  })

  const contentType = backendRes.headers.get("content-type") ?? "application/json"
  const text = await backendRes.text()

  return new NextResponse(text, { status: backendRes.status, headers: { "Content-Type": contentType } })
}

export async function POST(req: NextRequest) {
  const backend = backendUrlOrError()
  if (!backend.ok) return backend.res

  const auth = await accessTokenOrError()
  if (!auth.ok) return auth.res

  const bodyText = await req.text().catch(() => "")

  const backendRes = await fetch(`${backend.backendUrl}/admin/tabelas-pontuacao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.access}`
    },
    body: bodyText
  })

  const contentType = backendRes.headers.get("content-type") ?? "application/json"
  const text = await backendRes.text()

  return new NextResponse(text, { status: backendRes.status, headers: { "Content-Type": contentType } })
}
