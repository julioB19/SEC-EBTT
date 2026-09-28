import { NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromCookies } from "@/lib/serverAuth"

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; evidenceFileId: string }> }
) {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json({ status: "error", message: "BACKEND_URL não configurada", data: null }, { status: 500 })
  }
  const token = await getAccessTokenFromCookies()
  if (!token) {
    return NextResponse.json({ status: "error", message: "Não autenticado", data: null }, { status: 401 })
  }
  const { id, evidenceFileId } = await context.params
  try {
    const response = await fetch(
      `${backendUrl.replace(/\/+$/, "")}/processes/${id}/gecc/documents/${evidenceFileId}/content`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    )
    if (!response.ok) {
      const body = await response.json().catch(() => ({ status: "error", message: "Documento indisponível", data: null }))
      return NextResponse.json(body, { status: response.status })
    }
    const headers = new Headers()
    for (const name of ["content-type", "content-disposition"]) {
      const value = response.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new NextResponse(response.body, { status: response.status, headers })
  } catch (error) {
    console.error("GECC document content proxy failed:", error)
    return NextResponse.json({ status: "error", message: "Documento indisponível", data: null }, { status: 500 })
  }
}
