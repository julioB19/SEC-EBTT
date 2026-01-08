import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const ME_PATH = "/me"

async function accessTokenOrError() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) {
    return {
      ok: false as const,
      res: NextResponse.json({ message: "Não autenticado" }, { status: 401 })
    }
  }
  return { ok: true as const, access }
}

export async function GET() {
  if (!backend) {
    return NextResponse.json({ message: "BACKEND_URL não configurada" }, { status: 500 })
  }

  const auth = await accessTokenOrError()
  if (!auth.ok) return auth.res

  try {
    const r = await fetch(`${backend}${ME_PATH}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.access}`
      }
    })

    const text = await r.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
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

  const auth = await accessTokenOrError()
  if (!auth.ok) return auth.res

  const body = await req.text()

  try {
    const r = await fetch(`${backend}${ME_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.access}`,
        "Content-Type": req.headers.get("content-type") ?? "application/json"
      },
      body
    })

    const text = await r.text()
    const contentType = r.headers.get("content-type") ?? "application/json"
    return new NextResponse(text, { status: r.status, headers: { "Content-Type": contentType } })
  } catch (e: any) {
    return NextResponse.json(
      { message: "Erro ao conectar com o servidor", error: e?.message ?? "unknown" },
      { status: 502 }
    )
  }
}
