import { NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromCookies } from "@/lib/serverAuth"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json({ status: "error", message: "BACKEND_URL não configurada", data: null }, { status: 500 })
  }
  const token = await getAccessTokenFromCookies()
  if (!token) {
    return NextResponse.json({ status: "error", message: "Não autenticado", data: null }, { status: 401 })
  }
  const { id } = await context.params
  try {
    const response = await fetch(`${backendUrl.replace(/\/+$/, "")}/processes/${id}/gecc/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: await req.formData(),
      cache: "no-store"
    })
    const body = await response.json().catch(() => ({ status: "error", message: "Resposta inesperada do backend", data: null }))
    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error("GECC document upload proxy failed:", error)
    return NextResponse.json({ status: "error", message: "Erro interno", data: null }, { status: 500 })
  }
}
