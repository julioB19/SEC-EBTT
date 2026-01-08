import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

function getBackendUrl() {
  const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!url) throw new Error("BACKEND_URL não configurada")
  return url.replace(/\/+$/, "")
}

async function getAccessToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
  if (authHeader) return authHeader.replace(/^bearer[:=]?\s+/i, "").trim()

  const jar = await cookies()
  return jar.get("accessToken")?.value ?? null
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const processId = Number(id)

    if (!Number.isFinite(processId) || processId <= 0) {
      return NextResponse.json(
        { status: "error", message: "Invalid process id", data: null },
        { status: 400 }
      )
    }

    const token = await getAccessToken(req)
    if (!token) {
      return NextResponse.json(
        { status: "error", message: "Não autenticado", data: null },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))

    const backendUrl = getBackendUrl()
    const res = await fetch(`${backendUrl}/processes/${processId}/evaluation/evaluators`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body ?? {})
    })

    const raw = await res.text().catch(() => "")
    let data: any = null

    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    return NextResponse.json(
      data ?? { status: "error", message: "Resposta inválida/vazia do backend", data: null, details: raw || null },
      { status: res.status }
    )
  } catch (err) {
    console.error("Erro proxy evaluators:", err)
    return NextResponse.json(
      { status: "error", message: "Erro interno ao definir avaliadores", data: null },
      { status: 500 }
    )
  }
}
