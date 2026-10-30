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
  return { ok: true as const, backendUrl: backendUrl.replace(/\/+$/g, "") }
}

async function accessTokenOrError() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) {
    const body: ApiResponse = { status: "error", message: "Não autenticado", data: null }
    return { ok: false as const, res: NextResponse.json(body, { status: 401 }) }
  }
  return { ok: true as const, access }
}

async function getUserId(ctx: { params: Promise<{ userId: string }> }) {
  const p: any = await ctx.params
  const userId = String(p?.userId ?? "").trim()
  return userId
}

function jsonFromText(text: string) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const backend = backendUrlOrError()
  if (!backend.ok) return backend.res

  const auth = await accessTokenOrError()
  if (!auth.ok) return auth.res

  const userId = await getUserId(ctx)
  if (!userId) {
    return NextResponse.json({ status: "error", message: "userId inválido", data: null }, { status: 400 })
  }

  const backendRes = await fetch(`${backend.backendUrl}/users/${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${auth.access}` }
  })

  const text = await backendRes.text()
  const data = jsonFromText(text)
  return new NextResponse(JSON.stringify(data ?? text), {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" }
  })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const backend = backendUrlOrError()
  if (!backend.ok) return backend.res

  const auth = await accessTokenOrError()
  if (!auth.ok) return auth.res

  const userId = await getUserId(ctx)
  if (!userId) {
    return NextResponse.json({ status: "error", message: "userId inválido", data: null }, { status: 400 })
  }

  const body = await req.text()

  const backendRes = await fetch(`${backend.backendUrl}/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${auth.access}`,
      "Content-Type": req.headers.get("content-type") ?? "application/json"
    },
    body
  })

  const contentType = backendRes.headers.get("content-type") ?? "application/json"
  const text = await backendRes.text()
  return new NextResponse(text, { status: backendRes.status, headers: { "Content-Type": contentType } })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const backend = backendUrlOrError()
  if (!backend.ok) return backend.res

  const auth = await accessTokenOrError()
  if (!auth.ok) return auth.res

  const userId = await getUserId(ctx)
  if (!userId) {
    return NextResponse.json({ status: "error", message: "userId inválido", data: null }, { status: 400 })
  }

  const backendRes = await fetch(`${backend.backendUrl}/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${auth.access}` }
  })

  const contentType = backendRes.headers.get("content-type") ?? "application/json"
  const text = await backendRes.text()
  return new NextResponse(text, { status: backendRes.status, headers: { "Content-Type": contentType } })
}
