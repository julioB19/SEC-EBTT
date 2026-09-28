import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_URL || ""

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; kind: string }> }
) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { status: "error", message: "BACKEND_URL não configurada", data: null },
      { status: 500 }
    )
  }

  const accessToken = (await cookies()).get("accessToken")?.value
  if (!accessToken) {
    return NextResponse.json(
      { status: "error", message: "Não autenticado", data: null },
      { status: 401 }
    )
  }

  const { id, kind } = await context.params
  const formData = await request.formData()

  try {
    const response = await fetch(
      `${BACKEND_URL.replace(/\/+$/, "")}/processos/${id}/documentos/${kind}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
        cache: "no-store"
      }
    )

    const body = await response.json().catch(() => ({
      status: "error",
      message: "Resposta inesperada do backend",
      data: null
    }))
    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error("Erro ao enviar documento do processo:", error)
    return NextResponse.json(
      { status: "error", message: "Erro interno", data: null },
      { status: 500 }
    )
  }
}
