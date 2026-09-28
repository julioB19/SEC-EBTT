import { NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromCookies } from "@/lib/serverAuth"

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ memberId: string; evidenceFileId: string }> }
) {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json(
      { status: "error", message: "BACKEND_URL não configurada", data: null },
      { status: 500 }
    )
  }

  const token = await getAccessTokenFromCookies()
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "Não autenticado", data: null },
      { status: 401 }
    )
  }

  const { memberId, evidenceFileId } = await context.params
  try {
    const response = await fetch(
      `${backendUrl.replace(/\/+$/, "")}/external-evaluator/assignments/${memberId}/evidences/${evidenceFileId}/content`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    )
    if (!response.ok) {
      const body = await response.json().catch(() => ({
        status: "error",
        message: "Não foi possível abrir o documento.",
        data: null
      }))
      return NextResponse.json(body, { status: response.status })
    }

    const headers = new Headers()
    const contentType = response.headers.get("content-type")
    const contentDisposition = response.headers.get("content-disposition")
    if (contentType) headers.set("content-type", contentType)
    if (contentDisposition) headers.set("content-disposition", contentDisposition)
    return new NextResponse(response.body, { status: response.status, headers })
  } catch (error) {
    console.error("External evaluator evidence proxy failed:", error)
    return NextResponse.json(
      { status: "error", message: "Não foi possível abrir o documento.", data: null },
      { status: 500 }
    )
  }
}
