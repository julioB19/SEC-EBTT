import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

const backend = process.env.BACKEND_URL || ""
const ME_PATH = "/users/me"

type AccessTokenResult =
  | { ok: true; token: string; usedKey: string }
  | { ok: false; cookieKeys: string[] }

async function getAccessTokenFromCookies(): Promise<AccessTokenResult> {
  const jar = await cookies()

  const candidates = [
    "accessToken",
    "access_token",
    "token",
    "jwt",
    "access"
  ]

  for (const key of candidates) {
    const v = jar.get(key)?.value
    if (v && String(v).trim()) {
      return { ok: true, token: String(v).trim(), usedKey: key }
    }
  }

  const cookieKeys = jar.getAll().map(c => c.name)
  return { ok: false, cookieKeys }
}

export async function GET() {
  if (!backend) {
    return NextResponse.json({ message: "BACKEND_URL não configurada" }, { status: 500 })
  }

  const auth = await getAccessTokenFromCookies()
  if (!auth.ok) {
    return NextResponse.json(
      {
        message: "Usuário não autenticado",
        cookieKeys: auth.cookieKeys
      },
      { status: 401 }
    )
  }

  try {
    const r = await fetch(`${backend}${ME_PATH}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.token}`
      },
      cache: "no-store"
    })

    const text = await r.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }

    if (json && typeof json === "object") {
      json._debug = {
        usedCookieKey: auth.usedKey,
        backendUrl: backend,
        path: ME_PATH
      }
    }

    return NextResponse.json(json, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      { message: "Erro ao conectar com o servidor", error: e?.message ?? "unknown" },
      { status: 502 }
    )
  }
}

export async function PUT(req: NextRequest) {
  if (!backend) {
    return NextResponse.json({ message: "BACKEND_URL não configurada" }, { status: 500 })
  }

  const auth = await getAccessTokenFromCookies()
  if (!auth.ok) {
    return NextResponse.json(
      {
        message: "Usuário não autenticado",
        cookieKeys: auth.cookieKeys
      },
      { status: 401 }
    )
  }

  const body = await req.text()

  try {
    const r = await fetch(`${backend}${ME_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": req.headers.get("content-type") ?? "application/json"
      },
      body,
      cache: "no-store"
    })

    const text = await r.text()
    const contentType = r.headers.get("content-type") ?? "application/json"

    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": contentType }
    })
  } catch (e: any) {
    return NextResponse.json(
      { message: "Erro ao conectar com o servidor", error: e?.message ?? "unknown" },
      { status: 502 }
    )
  }
}
