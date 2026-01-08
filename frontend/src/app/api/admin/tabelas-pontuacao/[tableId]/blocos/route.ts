import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const BASE = "/admin/tabelas-pontuacao"

export async function POST(req: Request, context: { params: Promise<{ tableId: string }> }) {
  if (!backend) {
    return NextResponse.json(
      { status: "error", message: "BACKEND_URL não configurada", data: null },
      { status: 500 }
    )
  }

  const { tableId } = await context.params

  const cookieStore = await cookies()
  const accessFromCookie = cookieStore.get("accessToken")?.value

  const authHeader = req.headers.get("authorization") ?? ""
  const accessFromHeader = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""

  const access = accessFromCookie || accessFromHeader

  if (!access) {
    return NextResponse.json(
      { status: "error", message: "Não autenticado", data: null },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => null)

  const r = await fetch(`${backend}${BASE}/${tableId}/blocos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`
    },
    body: JSON.stringify(body),
    cache: "no-store"
  })

  const text = await r.text().catch(() => "")
  const json = text
    ? (() => {
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      })()
    : null

  if (!r.ok) {
    return NextResponse.json(
      {
        status: "error",
        message: json?.message ?? `Erro no backend (${r.status})`,
        data: json?.data ?? null,
        details: json?.details ?? (text || null)
      },
      { status: r.status }
    )
  }

  return NextResponse.json(
    json ?? { status: "success", message: "OK", data: null },
    { status: r.status }
  )
}
