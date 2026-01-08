import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

function getBackendUrl() {
  const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!url) throw new Error("BACKEND_URL não configurada")
  return url.replace(/\/+$/, "")
}

async function getAccessToken() {
  const jar = await cookies()
  return jar.get("accessToken")?.value ?? null
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getAccessToken()
    if (!token) {
      return NextResponse.json({ status: "error", message: "Não autenticado", data: null }, { status: 401 })
    }

    const { id } = await context.params
    const backendUrl = getBackendUrl()

    const res = await fetch(`${backendUrl}/cppd/processos/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    })

    const body = await res.json().catch(() => null)
    return NextResponse.json(body, { status: res.status })
  } catch (err) {
    console.error("Erro proxy /api/cppd/processos/[id]:", err)
    return NextResponse.json({ status: "error", message: "Erro interno", data: null }, { status: 500 })
  }
}
