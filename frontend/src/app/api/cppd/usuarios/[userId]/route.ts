import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

type ApiResponse<T = any> = {
  status: "success" | "error"
  message: string
  data: T | null
  details?: any
}

function normalizeBackendUrl(value: string) {
  const trimmed = String(value || "").trim().replace(/\/+$/g, "")
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

function backendUrlOrError() {
  const raw = process.env.BACKEND_URL
  const backendUrl = raw ? normalizeBackendUrl(raw) : null

  if (!backendUrl) {
    const body: ApiResponse = {
      status: "error",
      message: "BACKEND_URL não configurada ou inválida (use http(s)://...)",
      data: null,
      details: { BACKEND_URL: raw ?? null }
    }
    return { ok: false as const, res: NextResponse.json(body, { status: 500 }) }
  }

  return { ok: true as const, backendUrl }
}

async function accessTokenOrError() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value

  if (!access) {
    const body: ApiResponse = { status: "error", message: "Usuário não autenticado", data: null }
    return { ok: false as const, res: NextResponse.json(body, { status: 401 }) }
  }

  return { ok: true as const, access }
}

async function getUserIdFromCtx(ctx: { params: Promise<{ userId: string }> | { userId: string } }) {
  const p: any = await ctx.params
  const raw = String(p?.userId ?? "").trim()
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function readBackendBody(res: Response) {
  const contentType = res.headers.get("content-type") || ""
  const text = await res.text()

  if (!text) return { parsed: null as any, raw: "" }

  if (contentType.includes("application/json")) {
    const parsed = (() => {
      try {
        return JSON.parse(text)
      } catch {
        return null
      }
    })()
    return { parsed, raw: text }
  }

  const maybeJson = (() => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  })()

  return { parsed: maybeJson, raw: text }
}

async function safeFetch(url: string, init: RequestInit) {
  try {
    const res = await fetch(url, init)
    const body = await readBackendBody(res)
    return { ok: true as const, res, body }
  } catch (e: any) {
    return {
      ok: false as const,
      error: {
        message: e?.message || String(e),
        name: e?.name,
        cause: e?.cause ? String(e.cause) : undefined
      }
    }
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ userId: string }> | { userId: string } }) {
  const b = backendUrlOrError()
  if (!b.ok) return b.res

  const a = await accessTokenOrError()
  if (!a.ok) return a.res

  const userId = await getUserIdFromCtx(ctx)
  if (!userId) {
    const body: ApiResponse = { status: "error", message: "ID inválido", data: null }
    return NextResponse.json(body, { status: 400 })
  }

  const url = `${b.backendUrl}/docentes/${userId}/cppd`

  const r = await safeFetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${a.access}` },
    cache: "no-store"
  })

  if (!r.ok) {
    const body: ApiResponse = {
      status: "error",
      message: "Internal error",
      data: null,
      details: { stage: "fetch", url, ...r.error }
    }
    return NextResponse.json(body, { status: 500 })
  }

  const payloadOut = r.body.parsed ?? r.body.raw ?? null

  if (payloadOut === null) {
    const body: ApiResponse = {
      status: "error",
      message: "Resposta vazia do backend",
      data: null,
      details: { url, backendStatus: r.res.status }
    }
    return NextResponse.json(body, { status: 502 })
  }

  return NextResponse.json(payloadOut, { status: r.res.status })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ userId: string }> | { userId: string } }) {
  const b = backendUrlOrError()
  if (!b.ok) return b.res

  const a = await accessTokenOrError()
  if (!a.ok) return a.res

  const userId = await getUserIdFromCtx(ctx)
  if (!userId) {
    const body: ApiResponse = { status: "error", message: "ID inválido", data: null }
    return NextResponse.json(body, { status: 400 })
  }

  const bodyIn = await req.json().catch(() => null)
  if (!bodyIn || typeof bodyIn !== "object") {
    const body: ApiResponse = { status: "error", message: "Payload inválido", data: null }
    return NextResponse.json(body, { status: 400 })
  }

  const payloadOut = {
    email: bodyIn.email,
    cpf: bodyIn.cpf,
    siape: bodyIn.siape
  }

  const url = `${b.backendUrl}/docentes/${userId}/cppd`

  const r = await safeFetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${a.access}`
    },
    body: JSON.stringify(payloadOut)
  })

  if (!r.ok) {
    const body: ApiResponse = {
      status: "error",
      message: "Internal error",
      data: null,
      details: { stage: "fetch", url, payloadOut, ...r.error }
    }
    return NextResponse.json(body, { status: 500 })
  }

  const payloadFromBackend = r.body.parsed ?? r.body.raw ?? null

  if (payloadFromBackend === null) {
    const body: ApiResponse = {
      status: "error",
      message: "Resposta vazia do backend",
      data: null,
      details: { url, backendStatus: r.res.status }
    }
    return NextResponse.json(body, { status: 502 })
  }

  return NextResponse.json(payloadFromBackend, { status: r.res.status })
}
